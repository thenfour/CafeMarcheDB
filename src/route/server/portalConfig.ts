import { NotFoundError } from "blitz";

export function portalPublicOrigin(): URL {
    const configured = process.env.CMDB_BASE_URL;
    if (!configured) {
        throw new Error("Portal routing requires CMDB_BASE_URL.");
    }
    const origin = new URL(configured);
    if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash) {
        throw new Error("CMDB_BASE_URL must be an HTTP(S) public URL without credentials or query parameters.");
    }
    return origin;
}

/** Forwarded hosts are hints; only the configured deployment host selects this application. */
export function assertPortalHost(host: string | undefined, origin: URL): void {
    if (!host || /[\s,/@\\]/.test(host)) {
        throw new NotFoundError();
    }
    try {
        const requested = new URL(`${origin.protocol}//${host}`);
        if (requested.host.toLowerCase() === origin.host.toLowerCase()) {
            return;
        }
    } catch {
        // Invalid host syntax is unavailable just like an unknown deployment host.
    }
    throw new NotFoundError();
}
