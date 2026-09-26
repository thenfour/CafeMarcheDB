import { resolver } from "@/src/auth/server/cmResolver";
import { NotFoundError } from "blitz";
import db, { Prisma } from "db";
import {
    ChangeAction,
    CreateChangeContext,
    RegisterChange,
} from "shared/activityLog";
import { Permission } from "shared/permissions";
import {
    RoleDesignation,
    type RoleDesignationValue,
    SetRoleDesignationInput,
} from "../roleDesignations";

const designationFields: Record<RoleDesignationValue, "isRoleForNewUsers" | "isPublicRole" | "isSysAdminRole"> = {
    [RoleDesignation.newUsers]: "isRoleForNewUsers",
    [RoleDesignation.public]: "isPublicRole",
    [RoleDesignation.sysadmin]: "isSysAdminRole",
};

export default resolver.pipe(
    resolver.zod(SetRoleDesignationInput),
    resolver.cmauthorize(Permission.sysadmin),
    async ({ designation, roleId }, ctx) => db.$transaction(
        async tx => {
            (await ctx.auth.refresh(tx)).requirePermission(Permission.sysadmin);

            // Lock every existing Role row before inspecting or changing either
            // singleton designation. Concurrent reassignments therefore serialize.
            await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Role\` ORDER BY id FOR UPDATE`);

            const roles = await tx.role.findMany({
                select: {
                    id: true,
                    publicId: true,
                    isRoleForNewUsers: true,
                    isPublicRole: true,
                    isSysAdminRole: true,
                    permissions: {
                        select: { permission: { select: { name: true } } },
                    },
                },
                orderBy: { id: "asc" },
            });
            const selectedRole = roles.find(role => role.publicId === roleId);
            if (!selectedRole) throw new NotFoundError();
            if (designation === RoleDesignation.sysadmin
                && !selectedRole.permissions.some(entry => entry.permission.name === Permission.sysadmin)) {
                throw new Error(`The designated Sysadmin role must grant ${Permission.sysadmin}.`);
            }

            const field = designationFields[designation];
            const changeContext = CreateChangeContext("setRoleDesignation");
            const rolesToClear = roles.filter(role => role.id !== selectedRole.id && role[field]);

            for (const role of rolesToClear) {
                await tx.role.update({
                    where: { id: role.id },
                    data: { [field]: false },
                });
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext,
                    table: "Role",
                    pkid: role.id,
                    oldValues: { [field]: true },
                    newValues: { [field]: false },
                    ctx,
                    db: tx,
                });
            }

            if (!selectedRole[field]) {
                await tx.role.update({
                    where: { id: selectedRole.id },
                    data: { [field]: true },
                });
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext,
                    table: "Role",
                    pkid: selectedRole.id,
                    oldValues: { [field]: false },
                    newValues: { [field]: true },
                    ctx,
                    db: tx,
                });
            }

            const assignmentCount = await tx.role.count({ where: { [field]: true } });
            if (assignmentCount !== 1) {
                throw new Error(`Expected exactly one ${designation} role after reassignment.`);
            }

            return { designation, roleId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
);
