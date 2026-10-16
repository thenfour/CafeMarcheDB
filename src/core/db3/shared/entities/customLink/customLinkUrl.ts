import type { ParsedUrlQuery } from "node:querystring";
import type { BandPublicId } from "shared/publicId";
import { applicationQuery, getBandPortalRoot, type BandHostingConfig } from "src/route/portalRouting";

// Shareable Custom Links are relative to the band's portal and do not choose a language.
// lsmb todo: use cmdb Router system
export function customLinkHref(slug: string, bandPublicId: BandPublicId, hosting: BandHostingConfig): string {
    const path = slug.split("/").filter(Boolean).map(encodeURIComponent).join("/");
    return `${getBandPortalRoot(bandPublicId, hosting)}/${path}`;
}

export function customLinkDestination(destination: string, query: ParsedUrlQuery, forwardQuery: boolean): string {
    if (!forwardQuery) {
        return destination;
    }
    const url = new URL(destination);

    // copy query parameters from the incoming request
    for (const [key, value] of Object.entries(applicationQuery(query))) {
        if (key === "customLinkSlug") {
            // skip this one parameter
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
