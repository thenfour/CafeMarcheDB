import db from "db";
import { findBackstageRouteByPattern } from "../shared/backstageRoutes";
import { requireFreshAuthorization } from "./permissionAuthorization";

export async function authorizeBackstagePageRequest(
    pathname: string,
    userId: number | null | undefined,
): Promise<void> {
    if (!pathname.startsWith("/backstage")) return;

    const route = findBackstageRouteByPattern(pathname);
    if (!route) throw new Error(`Backstage page is missing route authorization metadata: ${pathname}`);
    await requireFreshAuthorization(db, userId, route.permission);
}
