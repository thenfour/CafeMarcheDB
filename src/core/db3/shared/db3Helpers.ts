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

export const GetPublicRole = async () => {
    const publicRole = await db.role.findFirst({
        where: {
            isPublicRole: true,
        },
        include: {
            permissions: true,
        }
    });
    assert(!!publicRole, "expecting a public role to be assigned in the db");
    return publicRole;
}


// EventWhereInput for practical type checking.
export const GetPublicVisibilityWhereExpression2 = ({ publicRole }: { publicRole: Prisma.RoleGetPayload<{ include: { permissions: true } }> }) => {
    const spec = {
        // current user has access to the specified visibile permission
        visiblePermissionId: { in: publicRole.permissions.map(p => p.permissionId) }
    };
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
    if (!createdByUserIDColumnName) {
        const r = {
            visiblePermissionId: { in: userRole.permissions.map(p => p.permissionId) }
        };
        const tr: Prisma.EventWhereInput = r; // check type.
        return r;
    }
    const ret = {
        OR: [
            {
                // current user has access to the specified visibile permission
                visiblePermissionId: { in: userRole.permissions.map(p => p.permissionId) }
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
    const retCheck: Prisma.EventWhereInput = ret; // check type.
    return ret;
};


// EventWhereInput for practical type checking.
export const GetPublicVisibilityWhereExpression = async (): Promise<Prisma.EventWhereInput> => {
    return GetPublicVisibilityWhereExpression2({ publicRole: await GetPublicRole() });
};


export const GetUserVisibilityWhereExpression = async (user: { id: number, roleId: number | null } | null, createdByUserIDColumnName?: string | undefined | null) => {
    if (!user || !user.roleId) {
        return await GetPublicVisibilityWhereExpression();
    }
    const userRole = await db.role.findUnique({
        where: {
            id: user.roleId,
        },
        include: {
            permissions: true,
        }
    });
    assert(!!userRole, "role not found in db");

    return GetUserVisibilityWhereExpression2({ user, createdByUserIDColumnName, publicRole: await GetPublicRole(), userRole });
};
