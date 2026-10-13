import type { SessionContext } from "@blitzjs/auth";
import { findBackstageRouteByPattern, pageRoutePermission } from "../shared/backstageRoutes";
import { loadAuthorization } from "./serverAuthorization";
import type { BandPublicId } from "shared/publicId";

// Routing supplies explicit validated context; this owner enforces registered page permissions.
export async function authorizePageRequest(
    pathname: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
): Promise<void> {
    await loadPageAuthorization(pathname, session, bandPublicId);
}

export async function loadPageAuthorization(
    pathname: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
) {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    const route = findBackstageRouteByPattern(pathname);
    if (!route) {
        throw new Error(`Backstage page is missing route authorization metadata: ${pathname}`);
    }

    const auth = await loadAuthorization(session, bandPublicId);
    auth.requirePermission(pageRoutePermission(route, bandPublicId));
    return auth;
}
