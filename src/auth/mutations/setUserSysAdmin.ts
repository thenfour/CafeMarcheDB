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
import { requireCanManageUser } from "../server/userManagementPolicy";
import { findUserManagementPrincipal } from "../server/userManagementState";

export const SetUserSysAdminInput = z.object({
    userId: z.number().int().positive(),
    isSysAdmin: z.boolean(),
});

export default resolver.pipe(
    resolver.zod(SetUserSysAdminInput),
    resolver.authorize(Permission.login),
    async ({ userId, isSysAdmin }, ctx) => db.$transaction(
        async tx => {
            const [actor, target] = await Promise.all([
                findUserManagementPrincipal(tx, ctx.session.userId),
                findUserManagementPrincipal(tx, userId),
            ]);

            if (!target) throw new NotFoundError();
            requireCanManageUser({ actor, target, action: "setSysAdmin" });

            if (target.isSysAdmin === isSysAdmin) {
                return { userId, isSysAdmin };
            }

            await tx.user.update({
                where: { id: userId },
                data: { isSysAdmin },
            });
            await tx.session.deleteMany({ where: { userId } });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("setUserSysAdmin"),
                table: "User",
                pkid: userId,
                oldValues: { isSysAdmin: target.isSysAdmin },
                newValues: { isSysAdmin },
                ctx,
                db: tx,
            });

            return { userId, isSysAdmin };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
