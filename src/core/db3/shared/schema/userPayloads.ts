import { Prisma } from "db";


export const UserWithRolesArgs = Prisma.validator<Prisma.UserArgs>()({
    select: {
        id: true,
        name: true,
        isSysAdmin: true,
        isDeleted: true,
        email: true,
        phone: true,
        createdAt: true,
        roleId: true,
        cssClass: true,
        accessToken: true,
        role: {
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


