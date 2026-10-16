// server

import { NotFoundError } from "blitz";
import db from "db";
import type { IncomingMessage } from "node:http";
import { withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { getServerBandHostingConfig, parsePortalPath, PORTAL_PATH_HEADER, type BandHostingConfig, type RouteBandAndLocale } from "../portalRouting";
import { assertPortalHost, portalPublicOrigin } from "./portalConfig";

export type PortalAvailabilityDatabase = Pick<typeof db, "band" | "locale">;

export interface PortalRequest {
    readonly hosting: BandHostingConfig;
    readonly selection: RouteBandAndLocale;
    readonly pathname: string;
}

// lsmb todo: this is likely reduceable/removable. `selection` and pathname?
export function resolvePortalRequest(request: Pick<IncomingMessage, "url" | "headers">, requestedPath?: string): PortalRequest {
    const hosting = getServerBandHostingConfig();
    const origin = portalPublicOrigin();
    assertPortalHost(request.headers.host, origin);
    const incoming = new URL(request.url ?? "/", origin);
    const hint = request.headers[PORTAL_PATH_HEADER];
    const originalPath = requestedPath ?? (typeof hint === "string" ? hint : incoming.pathname);
    try {
        const original = new URL(originalPath, origin);
        if (original.origin !== origin.origin) {
            throw new RangeError("Expected a local request path.");
        }
        const path = parsePortalPath(original.pathname);
        if (["bandPublicId", "routeLocale"].some(key => incoming.searchParams.getAll(key).length > 1)) {
            throw new RangeError("Ambiguous portal selection.");
        }
        return {
            hosting,
            selection: path,
            pathname: path.pathname
        };
    } catch {
        throw new NotFoundError();
    }
}

// Wraps an operation in a portal req context. (locale + band)
export async function withPortalRequest<T>(request: Pick<IncomingMessage, "url" | "headers">, operation: (portal: PortalRequest) => Promise<T>): Promise<T> {
    const portal = resolvePortalRequest(request);
    // while we could force standalone to always use the configured singleton band,
    // it's simpler to just use the requested band. non-expistent bands get rejected anyway.
    //const boundBand = portal.hosting.kind === "standalone" ? portal.hosting.bandPublicId : portal.selection.bandPublicId ?? null;
    return withAuthorizationBandScope(portal.selection.bandPublicId ?? null, () => operation(portal));
}
