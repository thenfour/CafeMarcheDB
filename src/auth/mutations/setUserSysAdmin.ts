import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    ChangeAction,
    CreateChangeContext,
    RegisterChange,
} from "shared/activityLog";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { requireCanManageUser } from "../server/userManagementPolicy";
import { findUserManagementActor, findUserManagementTargetByPublicId } from "../server/userManagementState";

export const SetUserSysAdminInput = z.object({
    userId: UserPublicIdSchema,
    isSysAdmin: z.boolean(),
});

export default resolver.pipe(
    resolver.zod(SetUserSysAdminInput),
    resolver.authorize(Permission.login),
    async ({ userId, isSysAdmin }, ctx) => db.$transaction(
        async tx => {
            const [actor, target] = await Promise.all([
                findUserManagementActor(tx, ctx.session.userId),
                findUserManagementTargetByPublicId(tx, userId),
            ]);

            if (!target) throw new NotFoundError();
            requireCanManageUser({ actor, target, action: "setSysAdmin" });

            if (target.principal.isSysAdmin === isSysAdmin) {
                return { userId, isSysAdmin };
            }

            await tx.user.update({
                where: { id: target.principal.id },
                data: { isSysAdmin },
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("setUserSysAdmin"),
                table: "User",
                pkid: target.principal.id,
                oldValues: { isSysAdmin: target.principal.isSysAdmin },
                newValues: { isSysAdmin },
                ctx,
                db: tx,
            });

            return { userId, isSysAdmin };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
