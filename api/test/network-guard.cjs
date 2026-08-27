const net = require("node:net");
const tls = require("node:tls");
const { syncBuiltinESMExports } = require("node:module");

const marker = "D0_NETWORK_BLOCKED:";

const getTarget = args => {
    const normalizedArgs = Array.isArray(args[0]) ? args[0] : args;
    const first = normalizedArgs[0];

    if (first && typeof first === "object") {
        if (first.socket || first.path) return;
        return {
            host: first.host ?? first.hostname ?? "localhost",
            port: first.port,
        };
    }

    if (typeof first === "number" || /^\d+$/.test(first)) {
        const second = normalizedArgs[1];
        return {
            host: typeof second === "string"
                ? second
                : second?.host ?? second?.hostname ?? "localhost",
            port: first,
        };
    }
};

const isLoopback = host => {
    host = String(host).replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost"
        || host === "::1"
        || host === "::ffff:127.0.0.1"
        || (net.isIP(host) === 4 && host.startsWith("127."));
};

const assertLocalTarget = args => {
    const target = getTarget(args);
    if (!target || isLoopback(target.host)) return;

    const destination = `${target.host}:${target.port ?? "unknown"}`;
    process.stderr.write(`${marker}${destination}\n`);

    const error = new Error(`external network blocked by D0 test: ${destination}`);
    error.code = "D0_NETWORK_BLOCKED";
    throw error;
};

const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
    assertLocalTarget(args);
    return originalSocketConnect.apply(this, args);
};

const originalTLSConnect = tls.connect;
tls.connect = function(...args) {
    assertLocalTarget(args);
    return originalTLSConnect.apply(this, args);
};

syncBuiltinESMExports();
