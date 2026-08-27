import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
    createJosefinaServiceSet,
    isJosefinaService,
    josefinaServiceIds,
} from "../src/processing/service-scope.js";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const expectedServices = ["instagram", "tiktok", "youtube", "facebook"];

// Import config first to preserve the initialization order used by the API.
const { env } = await import("../src/config.js");
const { loadEnvs } = await import("../src/core/env.js");
const { friendlyServiceName } = await import("../src/processing/service-alias.js");
const { services } = await import("../src/processing/service-config.js");
const { testers } = await import("../src/processing/service-patterns.js");
const { extract, normalizeURL } = await import("../src/processing/url.js");

env.apiURL = "http://127.0.0.1/";

const loadServiceEnvs = (disabledServices) => {
    const source = {
        ...process.env,
        API_URL: "http://127.0.0.1/",
    };

    if (disabledServices === undefined) {
        delete source.DISABLED_SERVICES;
    } else {
        source.DISABLED_SERVICES = disabledServices;
    }

    return loadEnvs(source);
};

const route = (url, enabledServices = createJosefinaServiceSet()) => {
    return extract(normalizeURL(url), enabledServices);
};

const cleanChildEnv = (overrides = {}) => {
    const childEnv = { ...process.env };
    const neutral = {
        ALL_PROXY: "",
        API_AUTH_REQUIRED: "0",
        API_ENV_FILE: "",
        API_EXTERNAL_PROXY: "",
        API_INSTANCE_COUNT: "1",
        API_KEY_URL: "",
        API_REDIS_URL: "",
        COOKIE_PATH: "",
        CUSTOM_INNERTUBE_CLIENT: "",
        DOTENV_CONFIG_PATH: path.join(apiDirectory, "test", ".d0-no-env"),
        DOTENV_CONFIG_QUIET: "true",
        FREEBIND_CIDR: "",
        all_proxy: "",
        http_proxy: "",
        https_proxy: "",
        JWT_SECRET: "",
        no_proxy: "127.0.0.1,localhost",
        TURNSTILE_SECRET: "",
        TURNSTILE_SITEKEY: "",
        YOUTUBE_SESSION_SERVER: "",
    };

    return Object.assign(childEnv, neutral, overrides);
};

const runChild = (args, options = {}) => {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd: apiDirectory,
            env: cleanChildEnv(options.env),
            shell: false,
            windowsHide: true,
        });

        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let forceKill;
        const timeout = setTimeout(() => {
            timedOut = true;
            if (child.exitCode === null && child.signalCode === null) {
                child.kill();
            }
            forceKill = setTimeout(() => {
                if (child.exitCode === null && child.signalCode === null) {
                    child.kill("SIGKILL");
                }
            }, 2000);
        }, options.timeout ?? 10000);

        child.stdout.on("data", chunk => stdout += chunk);
        child.stderr.on("data", chunk => stderr += chunk);
        child.once("error", error => {
            clearTimeout(timeout);
            clearTimeout(forceKill);
            reject(error);
        });
        child.once("close", code => {
            clearTimeout(timeout);
            clearTimeout(forceKill);
            if (timedOut) {
                reject(new Error(`child process timed out\n${stdout}\n${stderr}`));
            } else {
                resolve({ code, stdout, stderr });
            }
        });
    });
};

const apiKeyProbeMarker = "D0_API_KEY_RESULT:";
const configModuleURL = pathToFileURL(
    path.join(apiDirectory, "src", "config.js")
).href;
const apiKeysModuleURL = pathToFileURL(
    path.join(apiDirectory, "src", "security", "api-keys.js")
).href;
const networkGuardPath = path.join(apiDirectory, "test", "network-guard.cjs");
const networkGuardProbeMarker = "D0_NETWORK_GUARD_RESULT:";

const probeApiKeyConfig = async (details, disabledServices = "") => {
    const key = "11111111-2222-3333-4444-555555555555";
    const source = `data:application/json,${encodeURIComponent(
        JSON.stringify({ [key]: details })
    )}`;
    const probeScript = `
        await import(${JSON.stringify(configModuleURL)});
        const apiKeys = await import(${JSON.stringify(apiKeysModuleURL)});
        const key = process.argv[1];
        const source = new URL(process.argv[2]);
        let state;
        let rejection;
        const originalLog = console.log;
        console.log = (...args) => {
            if (args.map(String).join(" ").includes("api keys loaded successfully")) {
                state = "loaded";
            }
        };
        console.error = (...args) => {
            if (args.map(String).join(" ").includes("Failed loading API keys")) {
                state = "rejected";
            }
            if (args[0] === "Error:") {
                rejection = String(args[1]);
            }
        };
        apiKeys.setup(source);
        const deadline = Date.now() + 5000;
        while (!state && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const allowed = apiKeys.getAllowedServices(key);
        originalLog(${JSON.stringify(apiKeyProbeMarker)} + JSON.stringify({
            state: state ?? "timeout",
            allowed: allowed ? [...allowed] : null,
            error: rejection ?? null,
        }));
        process.exit(state ? 0 : 2);
    `;

    const result = await runChild([
        "--input-type=module",
        "--eval",
        probeScript,
        key,
        source,
    ], {
        env: {
            API_URL: "http://127.0.0.1/",
            DISABLED_SERVICES: disabledServices,
        },
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    const resultLine = result.stdout
        .split(/\r?\n/)
        .find(line => line.startsWith(apiKeyProbeMarker));
    assert.ok(resultLine, result.stdout);

    return JSON.parse(resultLine.slice(apiKeyProbeMarker.length));
};

const probeNetworkGuard = async () => {
    const probeScript = `
        const net = require("node:net");
        const tls = require("node:tls");
        let netDelegations = 0;
        let tlsDelegations = 0;

        net.Socket.prototype.connect = function() {
            netDelegations++;
            return this;
        };
        tls.connect = function() {
            tlsDelegations++;
            return {};
        };

        require(${JSON.stringify(networkGuardPath)});

        const blocked = {};
        for (const [name, connect] of [
            ["net", () => new net.Socket().connect({ host: "198.51.100.1", port: 443 })],
            ["tls", () => tls.connect({ host: "198.51.100.1", port: 443 })],
            ["invalidLoopback", () => new net.Socket().connect({ host: "127.999.999.999", port: 443 })],
        ]) {
            try {
                connect();
                blocked[name] = false;
            } catch (error) {
                blocked[name] = error.code === "D0_NETWORK_BLOCKED";
            }
        }

        new net.Socket().connect({ host: "127.0.0.1", port: 1 });
        tls.connect({ host: "localhost", port: 1 });

        console.log(${JSON.stringify(networkGuardProbeMarker)} + JSON.stringify({
            blocked,
            netDelegations,
            tlsDelegations,
        }));
    `;

    const result = await runChild([
        "--input-type=commonjs",
        "--eval",
        probeScript,
    ]);

    assert.equal(result.code, 0, result.stderr || result.stdout);
    const resultLine = result.stdout
        .split(/\r?\n/)
        .find(line => line.startsWith(networkGuardProbeMarker));
    assert.ok(resultLine, result.stdout);

    return {
        probe: JSON.parse(resultLine.slice(networkGuardProbeMarker.length)),
        stderr: result.stderr,
    };
};

const listen = (server, port = 0) => {
    return new Promise((resolve, reject) => {
        const onError = error => reject(error);
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
            server.off("error", onError);
            resolve(server.address().port);
        });
    });
};

const closeServer = server => {
    return new Promise((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close(error => error ? reject(error) : resolve());
    });
};

const reservePort = async () => {
    const server = net.createServer();
    const port = await listen(server);
    await closeServer(server);
    return port;
};

const requestJSON = ({ port, method = "GET", body }) => {
    return new Promise((resolve, reject) => {
        const serializedBody = body === undefined ? undefined : JSON.stringify(body);
        const request = http.request({
            hostname: "127.0.0.1",
            port,
            path: "/",
            method,
            headers: serializedBody === undefined ? {
                Connection: "close",
            } : {
                Accept: "application/json",
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(serializedBody),
                Connection: "close",
            },
        }, response => {
            const chunks = [];
            response.on("data", chunk => chunks.push(chunk));
            response.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                try {
                    resolve({
                        statusCode: response.statusCode,
                        body: JSON.parse(text),
                    });
                } catch (error) {
                    reject(new Error(`invalid JSON response: ${text}`, { cause: error }));
                }
            });
        });

        request.setTimeout(2000, () => {
            request.destroy(new Error("local HTTP request timed out"));
        });
        request.once("error", reject);
        request.end(serializedBody);
    });
};

const waitForAPI = async (port, child, output) => {
    const deadline = Date.now() + 10000;
    let lastError;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(
                `API process exited early (code ${child.exitCode}, signal ${child.signalCode})\n${output()}`
            );
        }

        try {
            return await requestJSON({ port });
        } catch (error) {
            lastError = error;
            await delay(50);
        }
    }

    throw new Error(`API did not start: ${lastError}\n${output()}`);
};

const stopChild = async child => {
    if (
        !child
        || !child.pid
        || child.exitCode !== null
        || child.signalCode !== null
    ) return;

    const closed = once(child, "close");
    if (child.exitCode !== null || child.signalCode !== null) return;

    child.kill();
    const stopped = await Promise.race([
        closed.then(() => true),
        delay(5000, false, { ref: false }),
    ]);

    if (!stopped) {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
        }
        const forceStopped = await Promise.race([
            closed.then(() => true),
            delay(5000, false, { ref: false }),
        ]);
        if (!forceStopped) {
            throw new Error("child process did not stop after SIGKILL");
        }
    }
};

const portIsOpen = port => {
    return new Promise(resolve => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        const finish = result => {
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(250, () => finish(false));
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
    });
};

const waitForClosedPort = async port => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        if (!await portIsOpen(port)) return true;
        await delay(50);
    }
    return false;
};

test("la fuente canónica es exacta, estable e inmutable", () => {
    assert.deepEqual(josefinaServiceIds, expectedServices);
    assert.equal(new Set(josefinaServiceIds).size, expectedServices.length);
    assert.equal(Object.isFrozen(josefinaServiceIds), true);
    assert.throws(() => josefinaServiceIds.push("vimeo"), TypeError);

    const mutableCopy = createJosefinaServiceSet();
    mutableCopy.add("vimeo");
    assert.deepEqual([...createJosefinaServiceSet()], expectedServices);
    assert.equal(isJosefinaService("vimeo"), false);
});

test("el registro heredado conserva 21 servicios y cubre los cuatro públicos", () => {
    assert.equal(Object.keys(services).length, 21);
    assert.equal(Object.keys(testers).length, 21);

    for (const service of josefinaServiceIds) {
        assert.ok(services[service]);
        assert.ok(services[service].patterns.length > 0);
        assert.equal(typeof testers[service], "function");
    }
});

test("la configuración predeterminada proyecta sólo los cuatro servicios", () => {
    const projected = loadServiceEnvs();
    assert.deepEqual([...projected.allServices], expectedServices);
    assert.deepEqual([...projected.enabledServices], expectedServices);
});

test("DISABLED_SERVICES sólo reduce el alcance público", () => {
    const projected = loadServiceEnvs("youtube,facebook");
    assert.deepEqual([...projected.allServices], expectedServices);
    assert.deepEqual([...projected.enabledServices], ["instagram", "tiktok"]);
});

test("DISABLED_SERVICES normaliza espacios, vacíos y duplicados", () => {
    const projected = loadServiceEnvs(
        " youtube, ,facebook,youtube,, facebook, "
    );
    assert.deepEqual([...projected.enabledServices], ["instagram", "tiktok"]);
});

test("deshabilitar servicios heredados excluidos no altera el alcance", () => {
    const projected = loadServiceEnvs("vimeo, twitter, vimeo");
    assert.deepEqual([...projected.allServices], expectedServices);
    assert.deepEqual([...projected.enabledServices], expectedServices);
});

test("allowedServices all significa todos los servicios de Josefina", async () => {
    const result = await probeApiKeyConfig(
        { allowedServices: "all" },
        "youtube,facebook"
    );
    assert.deepEqual(result, {
        state: "loaded",
        allowed: expectedServices,
        error: null,
    });
});

test("las API keys aceptan subconjuntos públicos y rechazan Vimeo", async () => {
    const valid = await probeApiKeyConfig({
        allowedServices: ["instagram", "youtube"],
    });
    assert.deepEqual(valid, {
        state: "loaded",
        allowed: ["instagram", "youtube"],
        error: null,
    });

    const invalid = await probeApiKeyConfig({
        allowedServices: ["instagram", "vimeo"],
    });
    assert.deepEqual(invalid, {
        state: "rejected",
        allowed: null,
        error: "`allowedServices` in details contains an invalid service",
    });
});

test("routing offline de Instagram cubre publicación, reel y alias", () => {
    const publication = route("https://www.instagram.com/p/AbC123/");
    const reel = route("https://instagram.com/reel/ReEl123/");
    const alias = normalizeURL("https://ddinstagram.com/p/Alias123/");

    assert.equal(publication.host, "instagram");
    assert.equal(publication.patternMatch.postId, "AbC123");
    assert.equal(reel.host, "instagram");
    assert.equal(reel.patternMatch.postId, "ReEl123");
    assert.equal(alias.hostname, "instagram.com");
    assert.equal(extract(alias, createJosefinaServiceSet()).host, "instagram");
});

test("routing offline de TikTok cubre video, foto y enlace corto", () => {
    const video = route(
        "https://www.tiktok.com/@joa/video/1234567890123456789"
    );
    const photo = route(
        "https://www.tiktok.com/@joa/photo/9876543210987654321"
    );
    const short = route("https://vm.tiktok.com/ZMshort123/");

    assert.equal(video.host, "tiktok");
    assert.equal(video.patternMatch.postId, "1234567890123456789");
    assert.equal(photo.host, "tiktok");
    assert.equal(photo.patternMatch.postId, "9876543210987654321");
    assert.equal(short.host, "tiktok");
    assert.equal(short.patternMatch.shortLink, "ZMshort123");
});

test("routing offline de YouTube cubre watch, youtu.be, Shorts y live", () => {
    const id = "abcdefghijk";
    const watch = route(`https://www.youtube.com/watch?v=${id}`);
    const shortURL = normalizeURL(`https://youtu.be/${id}/extra/path`);
    const shortsURL = normalizeURL(`https://youtube.com/shorts/${id}`);
    const liveURL = normalizeURL(`https://youtube.com/live/${id}`);

    assert.equal(watch.host, "youtube");
    assert.equal(watch.patternMatch.id, id);

    for (const normalized of [shortURL, shortsURL, liveURL]) {
        assert.equal(normalized.hostname, "youtube.com");
        assert.equal(normalized.pathname, "/watch");
        assert.equal(normalized.searchParams.get("v"), id);
        assert.equal(
            extract(normalized, createJosefinaServiceSet()).host,
            "youtube"
        );
    }
});

test("routing offline de Facebook cubre reel, watch y fb.watch", () => {
    const reel = route("https://www.facebook.com/reel/1234567890/");
    const watchURL = normalizeURL(
        "https://www.facebook.com/watch/?v=1234567890"
    );
    const shortURL = normalizeURL("https://fb.watch/AbCd1234/");

    assert.equal(reel.host, "facebook");
    assert.equal(reel.patternMatch.id, "1234567890");
    assert.equal(watchURL.hostname, "web.facebook.com");
    assert.equal(
        extract(watchURL, createJosefinaServiceSet()).host,
        "facebook"
    );
    assert.equal(shortURL.hostname, "web.facebook.com");
    assert.equal(
        extract(shortURL, createJosefinaServiceSet()).host,
        "facebook"
    );
});

test("el techo de routing bloquea Vimeo aunque el caller lo habilite", () => {
    const expandedByCaller = new Set([...expectedServices, "vimeo"]);
    assert.deepEqual(
        route("https://vimeo.com/123456789", expandedByCaller),
        { error: "service.disabled" }
    );
});

test("routing distingue dominio inválido, ruta no soportada y servicio deshabilitado", () => {
    assert.deepEqual(
        route("https://example.invalid/watch?v=abcdefghijk"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://youtube.com.attacker.example/watch?v=abcdefghijk"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://facebook.invalid/watch/?v=1234567890"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://fb.invalid/watch/?v=1234567890"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://vk.invalid/video?z=video1_2"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://pinterest.invalid/pin/1234567890"),
        { error: "link.invalid" }
    );
    assert.deepEqual(
        route("https://pin.it/PinAlias123"),
        { error: "service.disabled" }
    );
    assert.deepEqual(
        route("https://vk.ru/video?z=video1_2"),
        { error: "service.disabled" }
    );

    const unsupported = route("https://youtube.com/channel/abcdefghijk");
    assert.equal(unsupported.error, "link.unsupported");
    assert.deepEqual(unsupported.context, { service: "youtube" });

    assert.deepEqual(
        route(
            "https://instagram.com/p/AbC123",
            new Set(["tiktok", "youtube", "facebook"])
        ),
        { error: "service.disabled" }
    );

    const previousApiURL = env.apiURL;
    try {
        env.apiURL = "https://api.imput.net/";
        assert.deepEqual(
            route(
                "https://youtube.com/watch?v=abcdefghijk",
                new Set(["instagram", "tiktok", "facebook"])
            ),
            { error: "service.disabled" }
        );
    } finally {
        env.apiURL = previousApiURL;
    }
});

test("la guardia de red bloquea TCP/TLS externo y permite loopback", async () => {
    const result = await probeNetworkGuard();

    assert.deepEqual(result.probe, {
        blocked: {
            net: true,
            tls: true,
            invalidLoopback: true,
        },
        netDelegations: 1,
        tlsDelegations: 1,
    });
    assert.equal(
        result.stderr.match(/D0_NETWORK_BLOCKED:/g)?.length,
        3,
        result.stderr
    );
});

test("el smoke HTTP local anuncia cuatro servicios y bloquea Vimeo sin red", async t => {
    const outboundRequests = [];
    const proxy = http.createServer((request, response) => {
        outboundRequests.push(`${request.method} ${request.url}`);
        response.writeHead(502);
        response.end();
    });
    proxy.on("connect", (request, socket) => {
        outboundRequests.push(`CONNECT ${request.url}`);
        socket.destroy();
    });

    const proxyPort = await listen(proxy);
    t.after(() => closeServer(proxy));
    const apiPort = await reservePort();
    const childEnv = cleanChildEnv({
        API_INSTANCE_COUNT: "1",
        API_LISTEN_ADDRESS: "127.0.0.1",
        API_PORT: String(apiPort),
        API_URL: `http://127.0.0.1:${apiPort}/`,
        DISABLED_SERVICES: "",
        FORCE_LOCAL_PROCESSING: "never",
        ALL_PROXY: `http://127.0.0.1:${proxyPort}/`,
        HTTP_PROXY: `http://127.0.0.1:${proxyPort}/`,
        HTTPS_PROXY: `http://127.0.0.1:${proxyPort}/`,
        NO_PROXY: "127.0.0.1,localhost",
    });
    childEnv.all_proxy = childEnv.ALL_PROXY;
    childEnv.http_proxy = childEnv.HTTP_PROXY;
    childEnv.https_proxy = childEnv.HTTPS_PROXY;
    childEnv.no_proxy = childEnv.NO_PROXY;

    const child = spawn(process.execPath, [
        "--require",
        networkGuardPath,
        "src/cobalt.js",
    ], {
        cwd: apiDirectory,
        env: childEnv,
        shell: false,
        windowsHide: true,
    });
    t.after(() => stopChild(child));

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    const output = () => `${stdout}\n${stderr}`;

    let testError;
    try {
        const health = await waitForAPI(apiPort, child, output);
        assert.equal(health.statusCode, 200);
        assert.deepEqual(health.body.cobalt.services, expectedServices);
        assert.deepEqual(
            health.body.cobalt.services,
            [...loadServiceEnvs().enabledServices].map(friendlyServiceName)
        );

        const blocked = await requestJSON({
            port: apiPort,
            method: "POST",
            body: { url: "https://vimeo.com/123456789" },
        });
        assert.equal(blocked.statusCode, 400);
        assert.equal(blocked.body.status, "error");
        assert.equal(
            blocked.body.error.code,
            "error.api.service.disabled"
        );

        await delay(100);
        assert.deepEqual(outboundRequests, []);
        assert.equal(output().includes("D0_NETWORK_BLOCKED:"), false);

        const outputDeadline = Date.now() + 2000;
        while (
            !/internal tunnel handler running on 127\.0\.0\.1:\d+/.test(output())
            && Date.now() < outputDeadline
        ) {
            await delay(20);
        }
    } catch (error) {
        testError = error;
    }

    await stopChild(child);
    const internalPortMatch = output().match(
        /internal tunnel handler running on 127\.0\.0\.1:(\d+)/
    );
    await closeServer(proxy);

    const apiPortClosed = await waitForClosedPort(apiPort);
    const proxyPortClosed = await waitForClosedPort(proxyPort);
    const internalPortClosed = internalPortMatch
        ? await waitForClosedPort(Number(internalPortMatch[1]))
        : false;

    assert.deepEqual(outboundRequests, []);
    assert.equal(output().includes("D0_NETWORK_BLOCKED:"), false, output());

    if (testError) {
        throw new Error(`${testError.message}\nAPI output:\n${output()}`, {
            cause: testError,
        });
    }

    assert.ok(internalPortMatch, output());
    assert.equal(apiPortClosed, true, `API port ${apiPort} remained open`);
    assert.equal(proxyPortClosed, true, `proxy port ${proxyPort} remained open`);
    assert.equal(
        internalPortClosed,
        true,
        `internal port ${internalPortMatch[1]} remained open`
    );
});
