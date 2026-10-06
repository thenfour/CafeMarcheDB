import type { TAnyModel } from "@/shared/rootroot";
import type { Ctx } from "blitz";
import { Permission } from "shared/permissions";
import { gSSP } from "src/blitz-server";
import { GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";
import type { xTable } from "src/core/db3/shared/db3core";
import { loadAuthorization } from "./serverAuthorization";
import type { BandPublicId } from "shared/publicId";

export async function isAuthorizedForServerPage(ctx: Ctx, permission: Permission, bandPublicId?: BandPublicId): Promise<boolean> {
    const auth = await loadAuthorization(ctx.session, bandPublicId);
    if (!auth.hasPermission(permission)) {
        return false;
    }
    return true;
}

export const makeServerSidePermissionGuard = (permission: Permission, bandPublicId?: BandPublicId) => gSSP(async ({ ctx }) => {
    if (!await isAuthorizedForServerPage(ctx, permission, bandPublicId)) {
        return { notFound: true };
    }
    return { props: {} };
});

interface LoadAuthorizedPageEntityArgsBase<T> {
    ctx: Ctx;
    permission: Permission;
    bandPublicId?: BandPublicId;
    table: xTable;
    includeDeleted?: boolean;
    load: (where: TAnyModel) => Promise<T | null>;
}

type LoadAuthorizedPageEntityArgs<T> = LoadAuthorizedPageEntityArgsBase<T> & (
    | {
        // by identity (publicly-visible ID)
        identity: number | string;
        id?: never
    }
    | {
        // by database identity
        id: number;
        identity?: never
    }
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

    const auth = await loadAuthorization(ctx.session, args.bandPublicId);
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
        auth,
        where: { [identityMember]: identity },
        includeDeleted,
    });
    return load(where);
}
