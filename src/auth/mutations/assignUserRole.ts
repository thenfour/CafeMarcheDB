import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { isPublicId, type GlobalRolePublicId } from "shared/publicId";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import db, { Prisma } from "db";
import { cmauthorize } from "../server/cmResolver";
import { writeAccountRole } from "../server/accountRoleWrite";

export const AssignUserRoleInput = z.object({
    userId: UserPublicIdSchema,
    roleId: z.custom<GlobalRolePublicId>(isPublicId).nullable(),
    acknowledgeContinuityRisk: z.boolean(),
}).strict();

export default resolver.pipe(
    resolver.zod(AssignUserRoleInput),
    cmauthorize({ permission: Permission.manage_global_users, requireUser: true }),
    async (edit, ctx) => db.$transaction(tx => writeAccountRole(tx, ctx.auth, edit),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
);
