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
    findUserManagementRole,
    getUserManagementContinuityWarnings,
} from "../server/userManagementState";

export const AssignUserRoleInput = z.object({
    userId: z.number().int().positive(),
    roleId: z.number().int().positive().nullable(),
    acknowledgeContinuityRisk: z.boolean().default(false),
});

export default resolver.pipe(
    resolver.zod(AssignUserRoleInput),
    resolver.authorize(Permission.assign_user_roles),
    async ({ userId, roleId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
        async tx => {
            const [actor, target, desiredRole] = await Promise.all([
                findUserManagementPrincipal(tx, ctx.session.userId),
                findUserManagementPrincipal(tx, userId),
                findUserManagementRole(tx, roleId),
            ]);

            if (!target) throw new NotFoundError();
            if (roleId != null && !desiredRole) throw new NotFoundError();

            requireCanManageUser({
                actor,
                target,
                action: "assignRole",
                desiredRole,
            });

            if (target.roleId === roleId) {
                return { userId, roleId, continuityWarnings: [] };
            }

            const continuityWarnings = await getUserManagementContinuityWarnings(
                tx,
                target,
                desiredRole,
            );
            requireContinuityAcknowledgement(
                continuityWarnings,
                acknowledgeContinuityRisk,
            );

            await tx.user.update({
                where: { id: userId },
                data: { roleId },
            });
            await tx.session.deleteMany({ where: { userId } });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("assignUserRole"),
                table: "User",
                pkid: userId,
                oldValues: { roleId: target.roleId },
                newValues: { roleId },
                ctx,
                db: tx,
            });

            return { userId, roleId, continuityWarnings };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
