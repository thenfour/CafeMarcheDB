import { createDB3Authorization } from "src/core/db3/shared/db3Authorization";
import type { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { gSSP } from "src/blitz-server";
import type { xTable } from "src/core/db3/shared/db3core";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { CMAuthorize, CreatePublicData } from "types";
import { getRequestAuthorization } from "./requestAuthorization";
import type { TAnyModel } from "@/shared/rootroot";
import { isPublicId } from "shared/publicId";

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

interface LoadAuthorizedPageEntityArgsBase<T> {
    ctx: Ctx;
    permission: Permission;
    table: xTable;
    includeDeleted?: boolean;
    load: (where: TAnyModel) => Promise<T | null>;
}

type LoadAuthorizedPageEntityArgs<T> = LoadAuthorizedPageEntityArgsBase<T> & (
    | { identity: number | string; id?: never }
    | { id: number; identity?: never }
);

/**
 * Loads the small entity payload used to render a page title without creating
 * a second, less-protected lookup path. Page capability, DB3 table access,
 * soft deletion, ownership, and row visibility are all applied before the
 * caller's Prisma selector runs.
 */
export async function loadAuthorizedPageEntity<T>(args: LoadAuthorizedPageEntityArgs<T>): Promise<T | null> {
    const { ctx,//
        permission,
        table,
        includeDeleted = false,
        load,
    } = args;

    const identity = "identity" in args ? args.identity : args.id;

    const { user: currentUser, effectivePermissions } = await getRequestAuthorization(ctx.session);
    const publicData = CreatePublicData({ user: currentUser, permissions: effectivePermissions.names });
    if (!CMAuthorize({ reason: "server-rendered entity metadata", permission, publicData })) {
        return null;
    }
    if (!table.authorizeTableForView(createDB3Authorization(currentUser, effectivePermissions))) return null;

    // validate the id
    if (table.publicIdMember && !isPublicId(identity)) {
        return null;
    } else if (!table.publicIdMember && typeof identity !== "number") {
        return null;
    }

    const identityMember = table.publicIdMember ?? table.pkMember;
    const where = await GetAuthorizedTableReadWhere({
        table,
        currentUser,
        where: { [identityMember]: identity },
        includeDeleted,
    });
    return load(where);
}
