import type { SessionContext } from "@blitzjs/auth";
import { findBackstageRouteByPattern } from "../shared/backstageRoutes";
import { loadAuthorization } from "./serverAuthorization";
import type { BandPublicId } from "shared/publicId";

// todo: more advanced routing logic needs to be  used to parse out
// - requested locale by route
// - requested band by route
export async function authorizePageRequest(
    pathname: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
): Promise<void> {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    const route = findBackstageRouteByPattern(pathname);
    if (!route) throw new Error(`Backstage page is missing route authorization metadata: ${pathname}`);

    const auth = await loadAuthorization(session, bandPublicId);
    auth.requirePermission(route.permission);
}
