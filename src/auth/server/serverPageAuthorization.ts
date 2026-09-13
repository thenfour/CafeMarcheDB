import { createDB3Authorization } from "src/core/db3/shared/db3Authorization";
import type { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { gSSP } from "src/blitz-server";
import type { xTable } from "src/core/db3/shared/db3core";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { CMAuthorize, CreatePublicData } from "types";
import { getRequestAuthorization } from "./requestAuthorization";
import type { TAnyModel } from "@/shared/rootroot";

export async function isAuthorizedForServerPage(ctx: Ctx, permission: Permission): Promise<boolean> {
    const { user, effectivePermissions } = await getRequestAuthorization(ctx.session);
    const publicData = CreatePublicData({ user, permissions: effectivePermissions.names });
    return CMAuthorize({
        reason: "server-rendered page",
        permission,
        publicData,
    });
}

export const makeServerSidePermissionGuard = (permission: Permission) => gSSP(async ({ ctx }) => {
    if (!await isAuthorizedForServerPage(ctx, permission)) {
        return { notFound: true };
    }
    return { props: {} };
});

interface LoadAuthorizedPageEntityArgs<T> {
    ctx: Ctx;
    permission: Permission;
    table: xTable;
    id: number;
    load: (where: TAnyModel) => Promise<T | null>;
}

/**
 * Loads the small entity payload used to render a page title without creating
 * a second, less-protected lookup path. Page capability, DB3 table access,
 * soft deletion, ownership, and row visibility are all applied before the
 * caller's Prisma selector runs.
 */
export async function loadAuthorizedPageEntity<T>({
    ctx,
    permission,
    table,
    id,
    load,
}: LoadAuthorizedPageEntityArgs<T>): Promise<T | null> {
    const { user: currentUser, effectivePermissions } = await getRequestAuthorization(ctx.session);
    const publicData = CreatePublicData({ user: currentUser, permissions: effectivePermissions.names });
    if (!CMAuthorize({ reason: "server-rendered entity metadata", permission, publicData })) {
        return null;
    }
    if (!table.authorizeTableForView(createDB3Authorization(currentUser, effectivePermissions))) return null;

    const where = await GetAuthorizedTableReadWhere({
        table,
        currentUser,
        where: { [table.pkMember]: id },
    });
    return load(where);
}
