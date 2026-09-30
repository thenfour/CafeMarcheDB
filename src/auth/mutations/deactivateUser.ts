import { resolver } from "@blitzjs/rpc";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "../schemas";
import { cmauthorize } from "../server/cmResolver";
import { revokeUserSignInState } from "../server/signInMethods";
import {
    requireCanManageUser,
    requireContinuityAcknowledgement,
} from "../server/userManagementPolicy";
import {
    findUserManagementActor,
    findUserManagementTargetByPublicId,
    getUserManagementContinuityWarnings,
} from "../server/userManagementState";
import { PermissionSet } from "../shared/PermissionSet";

export const DeactivateUserInput = z.object({
    userId: UserPublicIdSchema,
    acknowledgeContinuityRisk: z.boolean().default(false),
});

export default resolver.pipe(
    resolver.zod(DeactivateUserInput),
    cmauthorize(Permission.deactivate_users),
    async ({ userId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
        async tx => {
            const [actor, target] = await Promise.all([
                findUserManagementActor(tx, ctx.session.userId),
                findUserManagementTargetByPublicId(tx, userId),
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
                where: { id: target.principal.id },
                data: { isDeleted: true },
            });
            await revokeUserSignInState(tx, target.principal.id);
            // await RegisterChange({
            //     action: ChangeAction.update,
            //     changeContext: CreateChangeContext("deactivateUser"),
            //     table: "User",
            //     pkid: target.principal.id,
            //     oldValues: { isDeleted: false },
            //     newValues: { isDeleted: true },
            //     auth: ctx.auth,
            //     db: tx,
            // });

            return { userId, continuityWarnings };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
