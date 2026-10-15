import type { SessionContext } from "@blitzjs/auth";
import { loadAuthorization } from "./serverAuthorization";
import type { BandPublicId } from "shared/publicId";
import { CmdbRoutes } from "@/src/route/cmdbRoutes";

export async function loadPageAuthorization(
    pathname: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
) {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    //console.log(`Loading page authorization for pathname: ${pathname}, bandPublicId: ${bandPublicId}`);

    const route = CmdbRoutes.requireRouteByPattern(pathname);

    const auth = await loadAuthorization(session, bandPublicId);
    auth.requirePermission(route.permission);
    return auth;
}


// simple wrapper but with different intention; here it's only for validation, not loading.
// so it doesn't have a return value; it simply throws if authorization fails.
export async function authorizePageRequest(
    pathname: string,
    session: SessionContext,
    bandPublicId?: BandPublicId,
): Promise<void> {
    await loadPageAuthorization(pathname, session, bandPublicId);
}
