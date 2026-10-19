
import { Prisma } from "@prisma/client";
import { asPermission } from "shared/permissions";


export const UserWithRolesArgs = Prisma.validator<Prisma.UserArgs>()({
    select: {
        id: true,
        publicId: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        globalRoleId: true,
        mergedIntoUserId: true,
        cssClass: true,
        globalRole: {
            include: {
                permissions: {
                    include: {
                        permission: true,
                    }
                },
            }
        }
    }
});

export type UserWithRolesPayload = Prisma.UserGetPayload<typeof UserWithRolesArgs>;

export const HydrateUserWithRoles = <T extends UserWithRolesPayload>(user: T) => {
    return {
        ...user,
        globalRole: user.globalRole ? {
            isDeleted: user.globalRole.isDeleted,
            permissions: user.globalRole.permissions.map(entry => ({
                permission: {
                    ...entry.permission,
                    name: asPermission(entry.permission.name),
                }
            }))
        } : null,
    };
};

// separate nullable version so the return type of HydrateUserWithRoles can be clean.
export const NullableHydrateUserWithRoles = <T extends UserWithRolesPayload | null>(user: T) => {
    return user ? HydrateUserWithRoles(user) : null;
};

export type HydratedUserWithRolesPayload = ReturnType<typeof HydrateUserWithRoles>;
