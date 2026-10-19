import { resolver } from "@blitzjs/rpc";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { cmauthorize } from "../server/cmResolver";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { writeAccountAdministratorRole } from "../server/accountRoleWrite";

export const SetUserSysAdminInput = z.object({
    userId: UserPublicIdSchema,
    isSysAdmin: z.boolean(),
});

export default resolver.pipe(
    resolver.zod(SetUserSysAdminInput),
    cmauthorize(Permission.login),
    async ({ userId, isSysAdmin }, ctx) => db.$transaction(
        tx => writeAccountAdministratorRole(tx, ctx.auth, { userId, isSysAdmin }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
