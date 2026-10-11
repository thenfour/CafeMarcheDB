import { Permission } from "shared/permissions";
import { xPermission } from "../../shared/schema/user";
import { xBandRole } from "../../shared/entities/user/bandRoleViews";
import { xGlobalRole } from "../../shared/entities/user/roleViews";
import { setBandRolePermissionCommand, setGlobalRolePermissionCommand } from "../../shared/entities/user/rolePermissionCommands";
import { defineCommandHandler } from "../db3CommandCore";

// commands invoked by the role-permission matrix

export const globalRolePermissionSetCommandHandler = defineCommandHandler(
    setGlobalRolePermissionCommand,
    async (edit, context) => {
        context.authorization.requirePermission(Permission.sysadmin);
        const permission = await context.rowServices.requireVisible(xPermission, edit.localIdentity);
        const role = await context.rowServices.requireVisible(xGlobalRole, edit.foreignIdentity);
        const current = await context.transaction.globalRolePermission.findMany({
            where: { globalRoleId: role.id },
            select: { permission: { select: { publicId: true } } },
        });
        const desired = new Set(current.map(grant => grant.permission.publicId));
        if (edit.isAssociated) {
            desired.add(permission.publicId);
        } else {
            desired.delete(permission.publicId);
        }
        await context.rowServices.update(xGlobalRole, edit.foreignIdentity, { permissions: [...desired] });
        return edit;
    }
);

export const bandRolePermissionSetCommandHandler = defineCommandHandler(
    setBandRolePermissionCommand,
    async (edit, context) => {
        context.authorization.requirePermission(Permission.sysadmin);
        const permission = await context.rowServices.requireVisible(xPermission, edit.localIdentity);
        const role = await context.rowServices.requireVisible(xBandRole, edit.foreignIdentity);
        const current = await context.transaction.bandRolePermission.findMany({
            where: { bandRoleId: role.id },
            select: { permission: { select: { publicId: true } } },
        });
        const desired = new Set(current.map(grant => grant.permission.publicId));
        if (edit.isAssociated) {
            desired.add(permission.publicId);
        } else {
            desired.delete(permission.publicId);
        }
        await context.rowServices.update(xBandRole, edit.foreignIdentity, { bandRolePermissions: [...desired] });
        return edit;
    }
);
