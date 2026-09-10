import { resolver } from "@blitzjs/rpc";
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
import { requireActualSysadmin } from "../server/actualSysadmin";

const designationFields: Record<RoleDesignationValue, "isRoleForNewUsers" | "isPublicRole"> = {
    [RoleDesignation.newUsers]: "isRoleForNewUsers",
    [RoleDesignation.public]: "isPublicRole",
};

export default resolver.pipe(
    resolver.zod(SetRoleDesignationInput),
    resolver.authorize(Permission.sysadmin),
    async ({ designation, roleId }, ctx) => db.$transaction(
        async tx => {
            await requireActualSysadmin(tx, ctx.session.userId);

            // Lock every existing Role row before inspecting or changing either
            // singleton designation. Concurrent reassignments therefore serialize.
            await tx.$queryRaw(Prisma.sql`SELECT id FROM \`Role\` ORDER BY id FOR UPDATE`);

            const roles = await tx.role.findMany({
                select: {
                    id: true,
                    isRoleForNewUsers: true,
                    isPublicRole: true,
                },
                orderBy: { id: "asc" },
            });
            const selectedRole = roles.find(role => role.id === roleId);
            if (!selectedRole) throw new NotFoundError();

            const field = designationFields[designation];
            const changeContext = CreateChangeContext("setRoleDesignation");
            const rolesToClear = roles.filter(role => role.id !== roleId && role[field]);

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
                    where: { id: roleId },
                    data: { [field]: true },
                });
                await RegisterChange({
                    action: ChangeAction.update,
                    changeContext,
                    table: "Role",
                    pkid: roleId,
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
