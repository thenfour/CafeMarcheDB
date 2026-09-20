import {
    permissionEntity,
    roleEntity,
    setRolePermissionCommand,
} from "../../db3";
import { defineCommandHandler } from "../db3CommandCore";

// server-side handler for setRolePermissionCommand
export const rolePermissionSetCommandHandler = defineCommandHandler(
    setRolePermissionCommand,
    async (dto, context) => {
        const permission = await context.rowServices.requireVisible(
            permissionEntity,
            dto.localIdentity,
        );
        const role = await context.rowServices.requireVisible(
            roleEntity,
            dto.foreignIdentity,
        );
        const permissionId = permission[permissionEntity.schema.pkMember] as number;
        const roleId = role[roleEntity.schema.pkMember] as number;
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
            permissionEntity,
            dto.localIdentity,
            { roles: desiredRoleIds },
        );
        return dto;
    },
);
