import { concatenateUrlParts, isAbsoluteUri } from "shared/rootroot";

export function serverGetBaseUrl(): string {
    // make this as performant as possible. startup instrumentation validates env so that this doesn't need to check every call
    return process.env.CMDB_BASE_URL!;
}

export function requireValidBaseUrl() {
    const configured = process.env.CMDB_BASE_URL;
    if (!configured) {
        throw new Error("CMDB_BASE_URL is not configured.");
    }
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("CMDB_BASE_URL must be an HTTP(S) URL without credentials, query parameters, or a fragment.");
    }
}

export function serverGetAbsoluteUri(href: string): string {
    return isAbsoluteUri(href) ? href : concatenateUrlParts(serverGetBaseUrl(), href);
}
