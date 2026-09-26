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
import { isPublicId, type RolePublicId } from "shared/publicId";
import {
    requireCanManageUser,
    requireContinuityAcknowledgement,
} from "../server/userManagementPolicy";
import {
    findUserManagementActor,
    findUserManagementTargetByPublicId,
    findUserManagementRole,
    getUserManagementContinuityWarnings,
    makePermissionSetFromRole,
} from "../server/userManagementState";
import { PermissionSet } from "../shared/PermissionSet";
import { UserPublicIdSchema } from "../schemas";

export const AssignUserRoleInput = z.object({
    userId: UserPublicIdSchema,
    roleId: z.custom<RolePublicId>(isPublicId).nullable(),
    acknowledgeContinuityRisk: z.boolean().default(false),
});

export default resolver.pipe(
    resolver.zod(AssignUserRoleInput),
    resolver.authorize(Permission.assign_user_roles),
    async ({ userId, roleId, acknowledgeContinuityRisk }, ctx) => db.$transaction(
        async tx => {
            // desiredRole perm set is NOT "effective" perms, on purpose.
            // we only care about perms under the assigning role.

            // resolve public id just resolves an ID, it doesn't return the full row; this is intentional.
            const desiredRoleIdentity = roleId == null
                ? null
                : await tx.role.findUnique({
                    where: { publicId: roleId },
                    select: { id: true },
                });
            const desiredRoleDatabaseId = desiredRoleIdentity?.id ?? null;
            const [actor, target, desiredRole] = await Promise.all([
                findUserManagementActor(tx, ctx.session.userId),
                findUserManagementTargetByPublicId(tx, userId),
                findUserManagementRole(tx, desiredRoleDatabaseId),
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

            if (target.principal.roleId === desiredRoleDatabaseId) {
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
                where: { id: target.principal.id },
                data: { roleId: desiredRoleDatabaseId },
            });
            await RegisterChange({
                action: ChangeAction.update,
                changeContext: CreateChangeContext("assignUserRole"),
                table: "User",
                pkid: target.principal.id,
                oldValues: { roleId: target.principal.roleId },
                newValues: { roleId: desiredRoleDatabaseId },
                ctx,
                db: tx,
            });

            return { userId, roleId, continuityWarnings };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
