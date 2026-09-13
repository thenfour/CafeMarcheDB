import db from "db";
import { findBackstageRouteByPattern } from "../shared/backstageRoutes";
import { requireFreshAuthorization } from "./permissionAuthorization";

export async function authorizePageRequest(
    pathname: string,
    userId: number | null | undefined,
): Promise<void> {
    // all pages should take the same authorization path, even the root homepage.
    // non-logged in users have explicit access to the homepage and public pages via
    // route metadata, not baked into code.

    const route = findBackstageRouteByPattern(pathname);
    if (!route) throw new Error(`Backstage page is missing route authorization metadata: ${pathname}`);

    await requireFreshAuthorization(db, userId, route.permission);
}
