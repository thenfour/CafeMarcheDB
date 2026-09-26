import type { TAnyModel } from "@/shared/rootroot";
import type { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { gSSP } from "src/blitz-server";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import { loadAuthorization } from "./requestAuthorization";
import type { xTable } from "src/core/db3/shared/db3core";

export async function isAuthorizedForServerPage(ctx: Ctx, permission: Permission): Promise<boolean> {
    const auth = await loadAuthorization(ctx.session);
    if (!auth.hasPermission(permission)) {
        return false;
    }
    return true;
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

    const auth = await loadAuthorization(ctx.session);
    if (!auth.hasPermission(permission)) {
        return null;
    }
    if (!table.authorizeTableForView(auth)) {
        return null;
    }

    // validates the id
    const identityRaw = "identity" in args ? args.identity : args.id;
    const identity = table.parseIdentity(identityRaw);

    // TODO: this is not supposed to be here; this should be
    // table.identityMember,
    // or better: where: table.identityPrismaWhereExpression(identity)
    const identityMember = table.publicIdMember ?? table.pkMember;
    const where = await GetAuthorizedTableReadWhere({
        table,
        currentUser: auth.user,
        where: { [identityMember]: identity },
        includeDeleted,
    });
    return load(where);
}
