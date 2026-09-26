import type { SessionContext } from "@blitzjs/auth";
import { findBackstageRouteByPattern } from "../shared/backstageRoutes";
import { loadAuthorization } from "./requestAuthorization";

export async function authorizePageRequest(
    pathname: string,
    session: SessionContext,
): Promise<void> {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    const route = findBackstageRouteByPattern(pathname);
    if (!route) throw new Error(`Backstage page is missing route authorization metadata: ${pathname}`);

    const auth = await loadAuthorization(session);
    auth.requirePermission(route.permission);
}
