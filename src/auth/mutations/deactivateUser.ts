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
import {
    requireCanManageUser,
    requireContinuityAcknowledgement,
} from "../server/userManagementPolicy";
import {
    findUserManagementPrincipal,
    getUserManagementContinuityWarnings,
} from "../server/userManagementState";

export const DeactivateUserInput = z.object({
    userId: z.number().int().positive(),
    acknowledgeContinuityRisk: z.boolean().default(false),
});

export default resolver.pipe(
    resolver.zod(DeactivateUserInput),
    resolver.authorize(Permission.admin_users),
    async ({ userId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
        async tx => {
            const [actor, target] = await Promise.all([
                findUserManagementPrincipal(tx, ctx.session.userId),
                findUserManagementPrincipal(tx, userId),
            ]);

            if (!target) throw new NotFoundError();
            requireCanManageUser({ actor, target, action: "deactivate" });

            const continuityWarnings = await getUserManagementContinuityWarnings(
                tx,
                target,
                null,
            );
            requireContinuityAcknowledgement(
                continuityWarnings,
                acknowledgeContinuityRisk,
            );

            await tx.user.update({
                where: { id: userId },
                data: { isDeleted: true },
            });
            await tx.session.deleteMany({ where: { userId } });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("deactivateUser"),
                table: "User",
                pkid: userId,
                oldValues: { isDeleted: false },
                newValues: { isDeleted: true },
                ctx,
                db: tx,
            });

            return { userId, continuityWarnings };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
