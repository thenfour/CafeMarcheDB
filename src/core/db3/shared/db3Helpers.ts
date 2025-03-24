import { assert } from "blitz";
import db, { Prisma } from "db";

// PermissionSignificance.Visibility_Members
export const GetPermissionIdBySignificance = async (significance: string): Promise<number | null> => {
    const p = await db.permission.findFirst({
        where: { significance }
    });
    return p?.id || null;
};

export const GetSoftDeleteWhereExpression = (isDeletedColumnName?: string | undefined | null) => {
    return { [isDeletedColumnName || "isDeleted"]: false };
};

// EventWhereInput for practical type checking.
export const GetPublicVisibilityWhereExpression = async (): Promise<Prisma.EventWhereInput> => {
    const publicRole = await db.role.findFirst({
        where: {
            isPublicRole: true,
        },
        include: {
            permissions: true,
        }
    });
    assert(!!publicRole, "expecting a public role to be assigned in the db");
    const spec: Prisma.EventWhereInput = {
        // current user has access to the specified visibile permission
        visiblePermissionId: { in: publicRole.permissions.map(p => p.permissionId) }
    };
    return spec;
};

export const GetUserVisibilityWhereExpression = async (user: { id: number, roleId: number | null } | null, createdByUserIDColumnName?: string | undefined | null) => {
    if (!user || !user.roleId) {
        return await GetPublicVisibilityWhereExpression();
    }
    const role = await db.role.findUnique({
        where: {
            id: user.roleId,
        },
        include: {
            permissions: true,
        }
    });
    assert(!!role, "role not found in db");
    if (!createdByUserIDColumnName) {
        return {
            visiblePermissionId: { in: role.permissions.map(p => p.permissionId) }
        };
    }
    return {
        OR: [
            {
                // current user has access to the specified visibile permission
                visiblePermissionId: { in: role.permissions.map(p => p.permissionId) }
            },
            {
                // private visibility and you are the creator
                AND: [
                    { visiblePermissionId: null },
                    { [createdByUserIDColumnName]: user.id }
                ]
            }
        ]
    };
};
