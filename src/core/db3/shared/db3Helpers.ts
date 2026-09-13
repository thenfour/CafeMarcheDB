import { assert } from "blitz";
import db, { Prisma, PrismaClient } from "db";
import { PermissionSignificance, type TransactionalPrismaClient } from "./apiTypes";

// PermissionSignificance.Visibility_Members
export const GetDefaultVisibilityPermission = async (dbt: TransactionalPrismaClient) => {
    return await GetPermissionBySignificance(dbt, PermissionSignificance.Visibility_Members);
};

// PermissionSignificance.Visibility_Members
export const GetPermissionBySignificance = async (dbt: TransactionalPrismaClient, significance: string) => {
    const p = await (dbt as PrismaClient).permission.findFirst({
        where: { significance }
    });
    return p;
};

export const GetSoftDeleteWhereExpression = (isDeletedColumnName?: string | undefined | null) => {
    return { [isDeletedColumnName || "isDeleted"]: false };
};

interface GetVisibilityWhereExpressionArgs {
    permissionIds: readonly number[];
    visiblePermissionIdColumnName?: string | undefined | null;
    ownerUserId?: number | undefined | null;
    ownerUserIdColumnName?: string | undefined | null;
}

// Builds Prisma visibility WHERE clause.
// null visibility value is private and is visible only to its owner
// all other rows require the corresponding permission ID.
export const GetVisibilityWhereExpression = ({
    permissionIds, // array of permission IDs that the current user has
    visiblePermissionIdColumnName,
    ownerUserId,
    ownerUserIdColumnName,
}: GetVisibilityWhereExpressionArgs) => {
    const visibilityColumn = visiblePermissionIdColumnName || "visiblePermissionId";
    const permissionWhere = {
        [visibilityColumn]: { in: [...permissionIds] },
    };

    if (ownerUserId == null || !ownerUserIdColumnName) return permissionWhere;

    return {
        OR: [
            permissionWhere,
            {
                AND: [
                    { [visibilityColumn]: null },
                    { [ownerUserIdColumnName]: ownerUserId },
                ],
            },
        ],
    };
};

export const GetPublicRole = async () => {
    const publicRoles = await db.role.findMany({
        where: {
            isPublicRole: true,
        },
        include: {
            permissions: true,
        },
        take: 2,
    });
    assert(publicRoles.length === 1, `Expected exactly one public role; found ${publicRoles.length}.`);
    return publicRoles[0]!;
}


// EventWhereInput for practical type checking.
export const GetPublicVisibilityWhereExpression2 = ({ publicRole }: { publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }> }) => {
    const spec = GetVisibilityWhereExpression({
        permissionIds: publicRole.permissions.map(p => p.permissionId),
    });
    const t: Prisma.EventWhereInput = spec; // check type.
    return spec;
};

interface GetUserVisibilityWhereExpression2Args {
    user: { id: number, roleId: number | null } | null;
    createdByUserIDColumnName?: string | undefined | null;
    publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }>;
    userRole: Prisma.RoleGetPayload<{ include: { permissions: true } }> | null;
};

export const GetUserVisibilityWhereExpression2 = ({ user, userRole, createdByUserIDColumnName, publicRole }: GetUserVisibilityWhereExpression2Args) => {
    if (!userRole || !user) {
        return GetPublicVisibilityWhereExpression2({ publicRole });
    }
    const ret = GetVisibilityWhereExpression({
        permissionIds: userRole.permissions.map(p => p.permissionId),
        ownerUserId: user.id,
        ownerUserIdColumnName: createdByUserIDColumnName,
    });
    const retCheck: Prisma.EventWhereInput = ret; // check type.
    return ret;
};
