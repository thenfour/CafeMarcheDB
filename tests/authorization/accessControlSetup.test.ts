import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { DefaultRolePermissionAssignments, DefaultRoles } from "shared/defaultRolePermissionAssignments";
import { getPermissionDefinition, Permission } from "shared/permissions";
import { assertValidRoleConfiguration } from "src/auth/server/sessionInvalidation";
import { authorizationTestDb } from "./support/inMemoryPrisma";

// This double implements the read-only delegates used by configuration validation.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const permissions = [Permission.sysadmin, Permission.login, Permission.global_band_admin]
    .map((name, index) => ({ id: index + 1, name, isDeleted: false }));
const globalRoles = [
    { id: 1, isPublicRole: true, isRoleForNewUsers: false, isSysAdminRole: false, isDeleted: false },
    { id: 2, isPublicRole: false, isRoleForNewUsers: true, isSysAdminRole: false, isDeleted: false },
    { id: 3, isPublicRole: false, isRoleForNewUsers: false, isSysAdminRole: true, isDeleted: false },
];
const bandRoles = [
    { id: 4, isPublicRole: true, isRoleForNewUsers: false, isDeleted: false },
    { id: 5, isPublicRole: false, isRoleForNewUsers: true, isDeleted: false },
];

function resetConfiguration(): void {
    authorizationTestDb.reset({
        globalRole: globalRoles,
        bandRole: bandRoles,
        permission: permissions,
        globalRolePermission: permissions.map(permission => ({ id: permission.id, globalRoleId: 3, permissionId: permission.id })),
    });
}

describe("explicit access-control configuration", () => {
    it("seeds a Public role and a default role in each scope with matching grants", () => {
        for (const scope of ["global", "band"] as const) {
            expect(DefaultRoles.filter(role => role.scope === scope && role.isPublicRole)).toHaveLength(1);
            expect(DefaultRoles.filter(role => role.scope === scope && role.isRoleForNewUsers)).toHaveLength(1);
        }
        for (const [roleName, permission] of DefaultRolePermissionAssignments) {
            const role = DefaultRoles.find(candidate => candidate.name === roleName);
            expect(role, roleName).toBeDefined();
            expect(getPermissionDefinition(permission).scope, `${roleName}/${permission}`).toBe(role!.scope);
        }
        expect(DefaultRolePermissionAssignments).toContainEqual(["Admin", Permission.global_band_admin]);
        expect(DefaultRolePermissionAssignments).not.toContainEqual(["Admin", Permission.manage_events]);
    });

    it("validates configured roles without altering their grants", async () => {
        resetConfiguration();
        const before = authorizationTestDb.snapshot("globalRolePermission");
        await assertValidRoleConfiguration(database);
        expect(authorizationTestDb.snapshot("globalRolePermission")).toEqual(before);
    });

    it.each([
        { table: "globalRole", id: 1, designation: "Global Public" },
        { table: "globalRole", id: 2, designation: "new-account" },
        { table: "bandRole", id: 4, designation: "Band Public" },
        { table: "bandRole", id: 5, designation: "new-member" },
    ])("rejects missing or duplicate $designation configuration", async ({ table, id, designation }) => {
        resetConfiguration();
        const delegate = authorizationTestDb.getDelegate(table);
        const original = await delegate.findUniqueOrThrow({ where: { id } });
        await delegate.update({ where: { id }, data: { isDeleted: true } });
        await expect(assertValidRoleConfiguration(database)).rejects.toThrow(`designated ${designation} role; found 0`);
        await delegate.update({ where: { id }, data: { isDeleted: false } });
        await delegate.create({ data: { ...original, id: 99 } });
        await expect(assertValidRoleConfiguration(database)).rejects.toThrow(`designated ${designation} role; found 2`);
    });
});
