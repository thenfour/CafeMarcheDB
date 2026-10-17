import type { SessionContext } from "@blitzjs/auth";
import { loadAuthorization } from "./serverAuthorization";
import type { BandPublicId } from "shared/publicId";
import { CmdbRouteRegistry, type CmdbRouteDefinition } from "src/route/cmdbRoutes";
import { NotFoundError } from "blitz";
import { isBandPagePathname } from "src/route/portalRouting";

export async function loadPageAuthorization(
    route: CmdbRouteDefinition,
    session: SessionContext,
    bandPublicId?: BandPublicId,
) {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    if (isBandPagePathname(route.nextPattern) !== Boolean(bandPublicId)) {
        throw new NotFoundError();
    }

    const auth = await loadAuthorization(session, bandPublicId);
    auth.requirePermission(route.permission);
    return auth;
}


/** Authorize callers that already have a Next page pattern, without returning its context. */
export async function authorizePageRequest(
    nextPattern: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
): Promise<void> {
    const route = CmdbRouteRegistry.requireRouteByPattern(nextPattern);
    await loadPageAuthorization(route, session, bandPublicId);
}
