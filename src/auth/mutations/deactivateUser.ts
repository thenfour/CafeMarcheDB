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
    findUserManagementActor,
    findUserManagementTarget,
    getUserManagementContinuityWarnings,
} from "../server/userManagementState";
import { revokeUserSignInState } from "../server/signInMethods";
import { PermissionSet } from "../shared/PermissionSet";

export const DeactivateUserInput = z.object({
    userId: z.number().int().positive(),
    acknowledgeContinuityRisk: z.boolean().default(false),
});

export default resolver.pipe(
    resolver.zod(DeactivateUserInput),
    resolver.authorize(Permission.deactivate_users),
    async ({ userId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
        async tx => {
            const [actor, target] = await Promise.all([
                findUserManagementActor(tx, ctx.session.userId),
                findUserManagementTarget(tx, userId),
            ]);

            if (!target) throw new NotFoundError();
            requireCanManageUser({ actor, target, action: "deactivate" });

            const continuityWarnings = await getUserManagementContinuityWarnings(
                tx,
                target,
                new PermissionSet([]),
            );
            requireContinuityAcknowledgement(
                continuityWarnings,
                acknowledgeContinuityRisk,
            );

            await tx.user.update({
                where: { id: userId },
                data: { isDeleted: true },
            });
            await revokeUserSignInState(tx, userId);
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
