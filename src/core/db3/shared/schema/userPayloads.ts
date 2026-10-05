import { Prisma } from "@prisma/client";


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


