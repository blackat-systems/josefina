import test from "node:test";
import assert from "node:assert/strict";

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const networkGuardPath = path.join(apiDirectory, "test", "network-guard.cjs");

await import("./network-guard.cjs");

const { env } = await import("../src/config.js");
env.apiURL = "http://127.0.0.1:43119/";
env.streamLifespan = 1;

const { default: instagram } = await import("../src/processing/services/instagram.js");
const { default: matchAction } = await import("../src/processing/match-action.js");

const originalFetch = globalThis.fetch;

const jsonResponse = (body, status = 200, headers = {}) => new Response(
    JSON.stringify(body),
    {
        status,
        headers: {
            "content-type": "application/json",
            ...headers,
        },
    }
);

const textResponse = (body, status = 200, headers = {}) => new Response(body, {
    status,
    headers: {
        "content-type": "text/html; charset=utf-8",
        ...headers,
    },
});

const emptyEmbedHTML = '"init",[],[{}]],';

const landingHTML = [
    '["InstagramSecurityConfig",0,{"csrf_token":"synthetic-csrf"},1]',
    '["PolarisSiteData",0,{"device_id":"synthetic-device","machine_id":"synthetic-machine"},1]',
    '["LSD",0,{"token":"synthetic-lsd"},1]',
].join("\n");

function createPostFetchMock(options = {}) {
    const calls = [];

    const mock = async (input, init = {}) => {
        const url = input instanceof URL ? input : new URL(String(input));
        calls.push({
            hostname: url.hostname,
            pathname: url.pathname,
            method: init.method ?? "GET",
            headers: init.headers,
        });

        if (url.hostname === "i.instagram.com" && url.pathname === "/api/v1/oembed/") {
            return jsonResponse(options.oembed ?? {});
        }

        if (
            url.hostname === "i.instagram.com"
            && /^\/api\/v1\/media\/[^/]+\/info\/$/.test(url.pathname)
        ) {
            return jsonResponse(options.mobile ?? {});
        }

        if (url.pathname.endsWith("/embed/captioned/")) {
            return textResponse(options.embedHTML ?? emptyEmbedHTML);
        }

        if (url.pathname === "/graphql/query") {
            return jsonResponse(options.graphql ?? { data: null });
        }

        if (url.pathname === "/ajax/bulk-route-definitions/") {
            return textResponse(options.bulkRoute ?? "no matching route metadata");
        }

        if (url.pathname === "/api/v1/web/get_ruling_for_media_content_logged_out") {
            return jsonResponse(options.ruling ?? {});
        }

        if (/^\/p\/[^/]+\/$/.test(url.pathname)) {
            return textResponse(options.landingHTML ?? landingHTML);
        }

        throw new Error(`unexpected mocked Instagram request: ${url.hostname}${url.pathname}`);
    };

    return { mock, calls };
}

async function withFetchMock(mock, callback) {
    globalThis.fetch = mock;
    try {
        return await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

const mobilePhoto = url => ({
    image_versions2: {
        candidates: [{ width: 1080, height: 1080, url }],
    },
});

const mobileVideo = (smallURL, largeURL) => ({
    image_versions2: {
        candidates: [{ width: 1080, height: 1920, url: "https://media.invalid/video-thumb.jpg" }],
    },
    video_versions: [
        { width: 480, height: 854, url: smallURL },
        { width: 1080, height: 1920, url: largeURL },
    ],
});

const oldPhoto = url => ({ display_url: url, is_video: false });
const oldVideo = (url, thumb = "https://media.invalid/old-video-thumb.jpg") => ({
    display_url: thumb,
    is_video: true,
    video_url: url,
});

test("la API móvil extrae foto y el video de mayor área", async () => {
    const photoFetch = createPostFetchMock({
        oembed: { media_id: "synthetic-photo-id" },
        mobile: { items: [mobilePhoto("https://media.invalid/photo.jpg")] },
    });
    const photo = await withFetchMock(photoFetch.mock, () => instagram({
        postId: "PHOTO1",
        alwaysProxy: false,
    }));

    assert.deepEqual(photo, {
        urls: "https://media.invalid/photo.jpg",
        isPhoto: true,
        filename: "instagram_PHOTO1.jpg",
    });

    const videoMedia = mobileVideo(
        "https://media.invalid/video-small.mp4",
        "https://media.invalid/video-large.mp4"
    );
    videoMedia.video_versions.push({
        width: 2160,
        height: 3840,
        url: "",
    });
    const videoFetch = createPostFetchMock({
        oembed: { media_id: "synthetic-video-id" },
        mobile: {
            items: [videoMedia],
        },
    });
    const video = await withFetchMock(videoFetch.mock, () => instagram({
        postId: "VIDEO1",
        alwaysProxy: false,
    }));

    assert.equal(video.urls, "https://media.invalid/video-large.mp4");
    assert.equal(video.filename, "instagram_VIDEO1.mp4");
    assert.equal(video.audioFilename, "instagram_VIDEO1_audio");
});

test("la API móvil conserva orden, tipos, URLs y thumbnails del carrusel", async () => {
    const carousel = {
        carousel_media: [
            mobilePhoto("https://media.invalid/carousel-photo.jpg"),
            mobileVideo(
                "https://media.invalid/carousel-video-small.mp4",
                "https://media.invalid/carousel-video-large.mp4"
            ),
        ],
    };
    const directFetch = createPostFetchMock({
        oembed: { media_id: "synthetic-carousel-id" },
        mobile: { items: [carousel] },
    });
    const direct = await withFetchMock(directFetch.mock, () => instagram({
        postId: "CAROUSEL1",
        alwaysProxy: false,
    }));

    assert.deepEqual(direct.picker.map(item => ({ type: item.type, url: item.url })), [
        { type: "photo", url: "https://media.invalid/carousel-photo.jpg" },
        { type: "video", url: "https://media.invalid/carousel-video-large.mp4" },
    ]);
    assert.equal(direct.picker.every(item => item.thumb.startsWith(env.apiURL)), true);

    const proxyFetch = createPostFetchMock({
        oembed: { media_id: "synthetic-carousel-id" },
        mobile: { items: [carousel] },
    });
    const proxied = await withFetchMock(proxyFetch.mock, () => instagram({
        postId: "CAROUSEL1",
        alwaysProxy: true,
    }));

    assert.equal(proxied.picker.every(item => item.url.startsWith(env.apiURL)), true);
    assert.equal(proxied.picker.every(item => item.thumb.startsWith(env.apiURL)), true);
});

test("la API móvil conserva un carrusel compuesto sólo por fotos", async () => {
    const scenario = createPostFetchMock({
        oembed: { media_id: "synthetic-photo-carousel-id" },
        mobile: {
            items: [{
                carousel_media: [
                    mobilePhoto("https://media.invalid/photo-carousel-1.jpg"),
                    mobilePhoto("https://media.invalid/photo-carousel-2.jpg"),
                ],
            }],
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "PHOTOCAROUSEL1",
        alwaysProxy: false,
    }));

    assert.deepEqual(result.picker.map(item => ({ type: item.type, url: item.url })), [
        { type: "photo", url: "https://media.invalid/photo-carousel-1.jpg" },
        { type: "photo", url: "https://media.invalid/photo-carousel-2.jpg" },
    ]);
});

test("GraphQL heredado extrae shortcode_media, xdt, video y carrusel mixto", async () => {
    for (const [id, field, media, check] of [
        [
            "OLDPHOTO",
            "shortcode_media",
            oldPhoto("https://media.invalid/old-photo.jpg"),
            result => assert.equal(result.isPhoto, true),
        ],
        [
            "OLDVIDEO",
            "xdt_shortcode_media",
            oldVideo("https://media.invalid/old-video.mp4"),
            result => assert.equal(result.urls, "https://media.invalid/old-video.mp4"),
        ],
        [
            "OLDCAROUSEL",
            "xdt_shortcode_media",
            {
                edge_sidecar_to_children: {
                    edges: [
                        { node: oldPhoto("https://media.invalid/old-carousel-photo.jpg") },
                        { node: oldVideo("https://media.invalid/old-carousel-video.mp4") },
                    ],
                },
            },
            result => assert.deepEqual(
                result.picker.map(item => item.type),
                ["photo", "video"]
            ),
        ],
    ]) {
        const scenario = createPostFetchMock({
            graphql: { data: { [field]: media } },
        });
        const result = await withFetchMock(scenario.mock, () => instagram({
            postId: id,
            alwaysProxy: false,
        }));
        check(result);
    }
});

test("una respuesta móvil incompleta continúa hasta GraphQL", async () => {
    const scenario = createPostFetchMock({
        oembed: { media_id: "synthetic-incomplete-id" },
        mobile: { items: [{ caption: { text: "sin multimedia" } }] },
        graphql: {
            data: {
                xdt_shortcode_media: oldVideo("https://media.invalid/fallback-video.mp4"),
            },
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "INCOMPLETE1",
        alwaysProxy: false,
    }));

    assert.equal(result.urls, "https://media.invalid/fallback-video.mp4");
    assert.equal(
        scenario.calls.some(call => call.pathname === "/graphql/query"),
        true
    );
});

test("un carrusel móvil incompleto continúa al fallback sin devolver un picker truncado", async () => {
    const scenario = createPostFetchMock({
        oembed: { media_id: "synthetic-incomplete-carousel-id" },
        mobile: {
            items: [{
                carousel_media: [
                    mobilePhoto("https://media.invalid/incomplete-carousel-photo.jpg"),
                    {
                        image_versions2: { candidates: [] },
                        video_versions: [{
                            width: 1080,
                            height: 1920,
                            url: "https://media.invalid/incomplete-carousel-video.mp4",
                        }],
                    },
                ],
            }],
        },
        graphql: {
            data: {
                xdt_shortcode_media: {
                    edge_sidecar_to_children: {
                        edges: [
                            { node: oldPhoto("https://media.invalid/fallback-carousel-photo.jpg") },
                            { node: oldVideo("https://media.invalid/fallback-carousel-video.mp4") },
                        ],
                    },
                },
            },
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "INCOMPLETECAROUSEL1",
        alwaysProxy: false,
    }));

    assert.equal(
        scenario.calls.some(call => call.pathname === "/graphql/query"),
        true
    );
    assert.deepEqual(
        result.picker.map(item => ({ type: item.type, url: item.url })),
        [
            { type: "photo", url: "https://media.invalid/fallback-carousel-photo.jpg" },
            { type: "video", url: "https://media.invalid/fallback-carousel-video.mp4" },
        ]
    );
});

test("un carrusel incompleto sin fallback falla íntegramente", async () => {
    const scenario = createPostFetchMock({
        oembed: { media_id: "synthetic-unrecoverable-carousel-id" },
        mobile: {
            items: [{
                carousel_media: [
                    mobilePhoto("https://media.invalid/unrecoverable-carousel-photo.jpg"),
                    { image_versions2: { candidates: [] } },
                ],
            }],
        },
        graphql: { data: {} },
        bulkRoute: "sin carrusel completo",
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "UNRECOVERABLECAROUSEL1",
        alwaysProxy: false,
    }));

    assert.deepEqual(result, { error: "fetch.empty" });
});

test("GraphQL conserva como foto un nodo de video sin video_url", async () => {
    const fallbackImageURL = "https://media.invalid/video-fallback-photo.jpg";
    const scenario = createPostFetchMock({
        graphql: {
            data: {
                xdt_shortcode_media: {
                    edge_sidecar_to_children: {
                        edges: [{
                            node: {
                                display_url: fallbackImageURL,
                                is_video: true,
                            },
                        }],
                    },
                },
            },
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "VIDEOFALLBACK1",
        alwaysProxy: false,
    }));

    assert.equal(result.picker.length, 1);
    assert.equal(result.picker[0].type, "photo");
    assert.equal(result.picker[0].url, fallbackImageURL);
});

test("un embed HTML malformado no impide el fallback GraphQL", async () => {
    const scenario = createPostFetchMock({
        embedHTML: "<html><body>respuesta incompleta</body></html>",
        graphql: {
            data: {
                xdt_shortcode_media: oldPhoto("https://media.invalid/fallback-photo.jpg"),
            },
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "MALFORMED1",
        alwaysProxy: false,
    }));

    assert.equal(result.urls, "https://media.invalid/fallback-photo.jpg");
    assert.equal(result.isPhoto, true);
});

test("respuestas GraphQL incompletas terminan en fetch.empty sin error crítico", async () => {
    const scenario = createPostFetchMock({
        graphql: { data: {} },
        bulkRoute: "sin contenido utilizable",
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "EMPTYGQL1",
        alwaysProxy: false,
    }));

    assert.deepEqual(result, { error: "fetch.empty" });
});

test("candidates con forma inválida continúa los fallbacks sin lanzar", async () => {
    const scenario = createPostFetchMock({
        oembed: { media_id: "synthetic-invalid-candidates-id" },
        mobile: {
            items: [{
                image_versions2: { candidates: {} },
            }],
        },
        graphql: { data: {} },
        bulkRoute: "sin contenido utilizable",
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "INVALIDCANDIDATES1",
        alwaysProxy: false,
    }));

    assert.deepEqual(result, { error: "fetch.empty" });
});

test("el diagnóstico distingue fetch.empty, privado y restricción por edad", async () => {
    const scenarios = [
        {
            expected: "fetch.empty",
            options: { bulkRoute: "sin metadatos" },
        },
        {
            expected: "content.post.private",
            options: { bulkRoute: '{"tracePolicy":"polaris.privatePostPage"}' },
        },
        {
            expected: "content.post.age",
            options: {
                bulkRoute: '{"media_id":"123","media_owner_id":"456"}',
                ruling: { title: "Restricted Content" },
            },
        },
    ];

    for (const [index, item] of scenarios.entries()) {
        const scenario = createPostFetchMock(item.options);
        const result = await withFetchMock(scenario.mock, () => instagram({
            postId: `ERROR${index}`,
            alwaysProxy: false,
        }));
        assert.deepEqual(result, { error: item.expected });
    }
});

test("una story sin cookie se rechaza sin intentar red", async () => {
    let fetchCalls = 0;
    const result = await withFetchMock(async () => {
        fetchCalls++;
        throw new Error("la story sin cookie no debe usar red");
    }, () => instagram({
        username: "synthetic-user",
        storyId: "synthetic-story",
    }));

    assert.deepEqual(result, { error: "link.unsupported" });
    assert.equal(fetchCalls, 0);
});

const runStoryProbe = async cookieFiles => {
    const cookieManagerURL = pathToFileURL(
        path.join(apiDirectory, "src", "processing", "cookie", "manager.js")
    ).href;
    const instagramURL = pathToFileURL(
        path.join(apiDirectory, "src", "processing", "services", "instagram.js")
    ).href;
    const marker = "D1_STORY_PROBE:";
    const script = `
        const { loadFromFile } = await import(${JSON.stringify(cookieManagerURL)});
        const { default: instagram } = await import(${JSON.stringify(instagramURL)});
        let homeRequests = 0;
        const submittedTokens = [];
        globalThis.fetch = async (input, init = {}) => {
            const url = input instanceof URL ? input : new URL(String(input));
            if (url.pathname === "/api/v1/users/web_profile_info/") {
                return new Response(JSON.stringify({ data: { user: { id: "synthetic-user-id" } } }));
            }
            if (url.pathname === "/") {
                homeRequests++;
                return new Response(JSON.stringify({
                    dtsg: { token: "synthetic-dtsg-" + homeRequests }
                }));
            }
            if (url.pathname === "/api/graphql/") {
                submittedTokens.push(new URLSearchParams(init.body).get("fb_dtsg"));
                return new Response(JSON.stringify({
                    data: {
                        xdt_api__v1__feed__reels_media: {
                            reels_media: [{ id: "synthetic-user-id", items: {} }]
                        }
                    }
                }));
            }
            throw new Error("unexpected story request: " + url.hostname + url.pathname);
        };

        const outcomes = [];
        for (const cookieFile of process.argv.slice(1)) {
            await loadFromFile(cookieFile);
            try {
                outcomes.push(await instagram({
                    username: "synthetic-user",
                    storyId: "synthetic-story"
                }));
            } catch (error) {
                outcomes.push({ threw: true, name: error?.name });
            }
        }

        console.log(${JSON.stringify(marker)} + JSON.stringify({
            outcomes,
            homeRequests,
            submittedTokens
        }));
        process.exit(0);
    `;

    const childEnv = {
        API_URL: "http://127.0.0.1:43119/",
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
    };
    const child = spawn(process.execPath, [
        "--require",
        networkGuardPath,
        "--input-type=module",
        "--eval",
        script,
        ...cookieFiles,
    ], {
        cwd: apiDirectory,
        env: childEnv,
        shell: false,
        windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    const [code] = await once(child, "close");
    assert.equal(code, 0, stderr || stdout);
    assert.equal(stderr.includes("D0_NETWORK_BLOCKED:"), false, stderr);

    const resultLine = stdout.split(/\r?\n/).find(line => line.startsWith(marker));
    assert.ok(resultLine, stdout);
    return JSON.parse(resultLine.slice(marker.length));
};

test("una story con items inválidos no lanza y el DTSG no se comparte entre cookies", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "josefina-d1-story-"));
    try {
        const cookieFiles = ["a", "b"].map(name => path.join(tempDirectory, `${name}.json`));
        await Promise.all(cookieFiles.map((file, index) => writeFile(file, JSON.stringify({
            instagram: [`sessionid=synthetic-${index}; csrftoken=synthetic-${index}`],
        }))));

        const result = await runStoryProbe(cookieFiles);
        assert.deepEqual(result.outcomes, [
            { error: "fetch.empty" },
            { error: "fetch.empty" },
        ]);
        assert.equal(result.homeRequests, 2);
        assert.deepEqual(result.submittedTokens, [
            "synthetic-dtsg-1",
            "synthetic-dtsg-2",
        ]);
    } finally {
        await rm(tempDirectory, { recursive: true, force: true });
    }
});

test("GraphQL preserva la cookie anónima cuando no hay cookie configurada", async () => {
    const scenario = createPostFetchMock({
        graphql: {
            data: {
                xdt_shortcode_media: oldPhoto("https://media.invalid/anonymous-photo.jpg"),
            },
        },
    });

    const result = await withFetchMock(scenario.mock, () => instagram({
        postId: "ANONCOOKIE",
        alwaysProxy: false,
    }));

    const graphqlCall = scenario.calls.find(call => call.pathname === "/graphql/query");
    assert.ok(graphqlCall);
    assert.match(graphqlCall.headers.cookie, /csrftoken=synthetic-csrf/);
    assert.equal(JSON.stringify(result).includes("synthetic-csrf"), false);
    assert.equal(JSON.stringify(result).includes("synthetic-lsd"), false);
});

test("audio, mute y picker conservan las prioridades heredadas de Instagram", () => {
    const common = {
        host: "instagram",
        audioFormat: "mp3",
        disableMetadata: false,
        filenameStyle: "basic",
        convertGif: true,
        audioBitrate: "128",
        alwaysProxy: false,
        localProcessing: "disabled",
    };

    const audio = matchAction({
        ...common,
        r: {
            urls: "https://media.invalid/source-video.mp4",
            filename: "instagram_VIDEO.mp4",
            audioFilename: "instagram_VIDEO_audio",
        },
        isAudioOnly: true,
        isAudioMuted: false,
    });
    assert.equal(audio.body.status, "tunnel");
    assert.equal(audio.body.filename, "instagram_VIDEO_audio.mp3");

    const mute = matchAction({
        ...common,
        r: {
            urls: "https://media.invalid/source-video.mp4",
            filename: "instagram_VIDEO.mp4",
        },
        isAudioOnly: false,
        isAudioMuted: true,
    });
    assert.equal(mute.body.status, "tunnel");
    assert.equal(mute.body.filename, "instagram_VIDEO_mute.mp4");

    const photoAudio = matchAction({
        ...common,
        r: {
            urls: "https://media.invalid/photo.jpg",
            isPhoto: true,
            filename: "instagram_PHOTO.jpg",
        },
        isAudioOnly: true,
        isAudioMuted: false,
    });
    assert.equal(photoAudio.body.status, "tunnel");
    assert.equal(photoAudio.body.filename, "instagram_PHOTO.jpg");

    const pickerMute = matchAction({
        ...common,
        r: {
            picker: [{ type: "photo", url: "https://media.invalid/picker.jpg" }],
        },
        isAudioOnly: false,
        isAudioMuted: true,
    });
    assert.equal(pickerMute.body.status, "picker");
});

test("la guardia bloquea red externa y permite el loopback de control", async () => {
    const server = http.createServer((request, response) => {
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("loopback-ok");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
        const address = server.address();
        const localResponse = await originalFetch(`http://127.0.0.1:${address.port}/`);
        assert.equal(await localResponse.text(), "loopback-ok");

        await assert.rejects(
            originalFetch("https://198.51.100.1/"),
            error => error?.code === "D0_NETWORK_BLOCKED"
                || error?.cause?.code === "D0_NETWORK_BLOCKED"
        );
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
});
