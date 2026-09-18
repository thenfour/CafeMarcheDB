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
    findUserManagementRole,
    getUserManagementContinuityWarnings,
    makePermissionSetFromRole,
} from "../server/userManagementState";
import { PermissionSet } from "../shared/PermissionSet";

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
            // desiredRole perm set is NOT "effective" perms, on purpose.
            // we only care about perms under the assigning role.

            const [actor, target, desiredRole] = await Promise.all([
                findUserManagementActor(tx, ctx.session.userId),
                findUserManagementTarget(tx, userId),
                findUserManagementRole(tx, roleId),
            ]);

            if (!target) throw new NotFoundError();
            if (roleId != null && !desiredRole) throw new NotFoundError();

            const desiredRolePerms = desiredRole ? makePermissionSetFromRole(desiredRole) : new PermissionSet([]);

            requireCanManageUser({
                actor,
                target,
                action: "assignRole",
                desiredRole: desiredRolePerms,
            });

            if (target.principal.roleId === roleId) {
                return { userId, roleId, continuityWarnings: [] };
            }

            const continuityWarnings = await getUserManagementContinuityWarnings(
                tx,
                target,
                desiredRolePerms,
            );
            requireContinuityAcknowledgement(
                continuityWarnings,
                acknowledgeContinuityRisk,
            );

            await tx.user.update({
                where: { id: userId },
                data: { roleId },
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("assignUserRole"),
                table: "User",
                pkid: userId,
                oldValues: { roleId: target.principal.roleId },
                newValues: { roleId },
                ctx,
                db: tx,
            });

            return { userId, roleId, continuityWarnings };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
