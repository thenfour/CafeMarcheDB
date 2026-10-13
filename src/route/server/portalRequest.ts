// server

import type { IncomingMessage } from "node:http";
import { NotFoundError } from "blitz";
import db from "db";
import { withAuthorizationBandScope } from "src/auth/server/requestAuthorizationScope";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { parsePortalPath, PORTAL_PATH_HEADER, selectPortalContext, type BandHostingConfig, type RouteBandAndLocale } from "../portalRouting";
import { assertPortalHost, portalPublicOrigin, serverPortalHosting } from "./portalConfig";

export type PortalAvailabilityDatabase = Pick<typeof db, "band" | "locale">;

export interface PortalRequest {
    readonly hosting: BandHostingConfig;
    readonly selection: RouteBandAndLocale;
    readonly pathname: string;
}


export function resolvePortalRequest(request: Pick<IncomingMessage, "url" | "headers">, requestedPath?: string): PortalRequest {
    const hosting = serverPortalHosting();
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
        const query = pagePresentationInput({
            bandPublicId: incoming.searchParams.get("bandPublicId") ?? undefined,
            routeLocale: incoming.searchParams.get("routeLocale") ?? undefined,
        });
        return {
            hosting,
            selection: selectPortalContext(path, query, hosting),
            pathname: path.pathname
        };
    } catch {
        throw new NotFoundError();
    }
}

// lsmb todo: evaluate if this is strictly necessary.
// issues:
// - it adds multiple db queries just to check availability. anti-pattern; assume it exists and fail later
// - embeds soft-delete logic, skips auth & vis checks.
// - embeds locale splitting / matching logic.
export async function requirePortalAvailability(portal: PortalRequest, database: PortalAvailabilityDatabase): Promise<void> {
    const band = portal.selection.bandPublicId ? await database.band.findFirst({
        where: {
            publicId: portal.selection.bandPublicId,
            isDeleted: false
        },
        select: { id: true },
    }) : null;

    if (portal.selection.bandPublicId && !band) {
        throw new NotFoundError();
    }

    const locale = portal.selection.routeLocale;
    if (locale) {
        const language = locale.split("-")[0]!;
        const available = await database.locale.findFirst({
            where: {
                isDeleted: false,
                ...(band ? { bandLocales: { some: { bandId: band.id } } } : {}),
                OR: [
                    { ietfTag: locale },
                    { ietfTag: { startsWith: `${language}-` } }],
            }, select: { id: true },
        });
        if (!available) {
            throw new NotFoundError();
        }
    }
}

// Wraps an operation in  a portal req context. (locale + band)
export async function withPortalRequest<T>(request: Pick<IncomingMessage, "url" | "headers">, operation: (portal: PortalRequest) => Promise<T>): Promise<T> {
    const portal = resolvePortalRequest(request);
    await requirePortalAvailability(portal, db);
    const boundBand = portal.hosting.kind === "standalone" ? portal.hosting.bandPublicId : portal.selection.bandPublicId ?? null;
    return withAuthorizationBandScope(boundBand, () => operation(portal));
}
