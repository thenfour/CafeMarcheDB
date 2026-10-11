import { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import { RoleDesignation, SetRoleDesignationInput, type SetRoleDesignation } from "../roleDesignations";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";
import type { CMServerAuthorization } from "./serverAuthorization";

// writes a role's "special significance" i.e. designation like sysadmin, public, or new users role
export async function writeRoleDesignation(
    database: Prisma.TransactionClient,
    authorization: CMServerAuthorization, // user's auth
    rawEdit: SetRoleDesignation // 
) {
    // gather inputs
    const edit = SetRoleDesignationInput.parse(rawEdit);
    const auth = await authorization.refresh(database);
    auth.requireUser().requirePermission(Permission.sysadmin);

    // lock the relevant role table to prevent concurrent modifications
    // https://stackoverflow.com/questions/27865992/why-use-select-for-update-mysql
    if (edit.scope === "global") {
        await database.$queryRaw(Prisma.sql`SELECT id FROM \`GlobalRole\` ORDER BY id FOR UPDATE`);
    } else {
        await database.$queryRaw(Prisma.sql`SELECT id FROM \`BandRole\` ORDER BY id FOR UPDATE`);
    }

    // select field
    const field = edit.designation === RoleDesignation.sysadmin ? "isSysAdminRole"
        : edit.designation === RoleDesignation.public ? "isPublicRole" : "isRoleForNewUsers";

    // fetch all roles of the relevant scope (with its existing designations)
    const roles = edit.scope === "global"
        ? await database.globalRole.findMany({ orderBy: { id: "asc" } })
        : (await database.bandRole.findMany({ orderBy: { id: "asc" } })).map(role => ({ ...role, isSysAdminRole: false }));

    const selected = roles.find(role => role.publicId === edit.roleId && !role.isDeleted);
    if (!selected) {
        throw new NotFoundError();
    }

    // 
    if (edit.designation === RoleDesignation.sysadmin) {
        const grants = await database.globalRolePermission.findMany({
            where: { globalRoleId: selected.id, permission: { isDeleted: false } },
            select: { permission: { select: { name: true } } }
        });
        if (![Permission.sysadmin, Permission.login].every(name => grants.some(grant => grant.permission.name === name))) {
            throw new Error("The designated Sysadmin role must grant sysadmin and login.");
        }
    }

    // set all modified designations over roles. setting it one place means unsetting it elsewhere.
    const changeContext = CreateChangeContext("setRoleDesignation");
    for (const role of roles) {
        const desired = role.id === selected.id;
        if (role[field] === desired) {
            continue;
        }
        if (edit.scope === "global") {
            await database.globalRole.update({ where: { id: role.id }, data: { [field]: desired } });
        } else {
            await database.bandRole.update({ where: { id: role.id }, data: { [field]: desired } });
        }
        await RegisterChange({
            action: ChangeAction.update, changeContext,
            table: edit.scope === "global" ? "GlobalRole" : "BandRole", pkid: role.id,
            oldValues: { [field]: role[field] }, newValues: { [field]: desired }, auth, db: database
        });
    }
    return edit;
}
