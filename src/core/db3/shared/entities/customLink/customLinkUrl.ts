import type { ParsedUrlQuery } from "node:querystring";
import { isPublicId, parsePublicId, type BandPublicId } from "shared/publicId";

export function customLinkBand(query: ParsedUrlQuery): BandPublicId | null {
    return isPublicId(query.bandPublicId) ? parsePublicId<"Band">(query.bandPublicId) : null;
}

// Recovery routing uses explicit ownership until the band's portal root is available.
export function customLinkHref(slug: string, bandPublicId: BandPublicId): string {
    const path = slug.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return `/${path}?bandPublicId=${encodeURIComponent(bandPublicId)}`;
}

export function customLinkDestination(destination: string, query: ParsedUrlQuery, forwardQuery: boolean): string {
    if (!forwardQuery) {
        return destination;
    }
    const url = new URL(destination);
    for (const [key, value] of Object.entries(query)) {
        if (key === "customLinkSlug" || key === "bandPublicId" || key === "routeLocale") {
            continue;
        }
        for (const part of Array.isArray(value) ? value : [value]) {
            if (part !== undefined) {
                url.searchParams.append(key, part);
            }
        }
    }
    return url.toString();
}

export function customLinkClientDestination(destination: string, incomingHash: string, forwardQuery: boolean): string {
    if (!forwardQuery || !incomingHash) {
        return destination;
    }
    const url = new URL(destination);
    url.hash = incomingHash;
    return url.toString();
}
