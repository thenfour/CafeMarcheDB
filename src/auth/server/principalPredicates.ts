import { Prisma } from "@prisma/client";
import { Permission } from "shared/permissions";

/** Platform authority can come from the account flag or its active global role. */
export const platformSysadminWhere = Prisma.validator<Prisma.UserWhereInput>()({
    OR: [
        { isSysAdmin: true },
        {
            globalRole: {
                isDeleted: false,
                permissions: { some: { permission: { name: Permission.sysadmin, isDeleted: false } } },
            },
        },
    ],
});
