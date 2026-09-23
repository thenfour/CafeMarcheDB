import {
    xPermission,
    xRole,
    setRolePermissionCommand,
} from "../../db3";
import { defineCommandHandler } from "../db3CommandCore";

// server-side handler for setRolePermissionCommand
export const rolePermissionSetCommandHandler = defineCommandHandler(
    setRolePermissionCommand,
    async (dto, context) => {
        const permission = await context.rowServices.requireVisible(
            xPermission,
            dto.localIdentity,
        );
        const role = await context.rowServices.requireVisible(
            xRole,
            dto.foreignIdentity,
        );
        const permissionId = permission[xPermission.pkMember] as number;
        const roleId = role[xRole.pkMember] as number;
        const currentAssociations = await context.transaction.rolePermission.findMany({
            where: { permissionId },
        });
        const currentRoleIds = currentAssociations.map(association => association.roleId);
        const desiredRoleIds = dto.isAssociated
            ? [...new Set([...currentRoleIds, roleId])]
            : currentRoleIds.filter(currentRoleId => currentRoleId !== roleId);

        // Use the parent association field so its field/row authorization,
        // auditing, and RolePermission mutation hooks remain authoritative.
        await context.rowServices.update(
            xPermission,
            dto.localIdentity,
            { roles: desiredRoleIds },
        );
        return dto;
    },
);
