import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { isPublicId } from "shared/publicId";
import { assertValidSysadminRole } from "src/auth/server/sessionInvalidation";
import { authorizationTestDb } from "./support/inMemoryPrisma";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

// The in-memory delegates implement the Prisma operations exercised by this assertion.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const permissions = [Permission.sysadmin, Permission.login].map((name, index) => ({ id: index + 1, name, isDeleted: false }));
const role = { id: 30, isSysAdminRole: true, isDeleted: false };

describe("BA-R001 startup Sysadmin-role assertion", () => {
    it.each([[], [role, { ...role, id: 31 }], [{ ...role, isDeleted: true }]].map(roles => ({ roles })))("requires exactly one active designated global role ($roles)", async ({ roles }) => {
        authorizationTestDb.reset({ globalRole: roles, permission: permissions });
        await expect(assertValidSysadminRole(database)).rejects.toThrow("exactly one active designated Sysadmin role");
    });

    it("adds missing required grants to the designated global role", async () => {
        authorizationTestDb.reset({ globalRole: [role], permission: permissions });
        await assertValidSysadminRole(database);
        const created = authorizationTestDb.snapshot("globalRolePermission");
        expect(created).toEqual([
            expect.objectContaining({ globalRoleId: 30, permissionId: 1 }),
            expect.objectContaining({ globalRoleId: 30, permissionId: 2 }),
        ]);
        expect(created.every(entry => isPublicId(entry.publicId))).toBe(true);
    });

    it("accepts existing required grants without duplicating them", async () => {
        const grants = permissions.map(permission => ({ id: permission.id, globalRoleId: role.id, permissionId: permission.id }));
        authorizationTestDb.reset({ globalRole: [role], permission: permissions, globalRolePermission: grants });
        await assertValidSysadminRole(database);
        expect(authorizationTestDb.snapshot("globalRolePermission")).toEqual(grants);
    });

    it("does not count a deleted permission definition or create partial grants", async () => {
        authorizationTestDb.reset({ globalRole: [role], permission: permissions.map(permission => ({ ...permission, isDeleted: permission.name === Permission.login })) });
        await expect(assertValidSysadminRole(database)).rejects.toThrow("Active sysadmin and login permission definitions are required");
        expect(authorizationTestDb.snapshot("globalRolePermission")).toEqual([]);
    });
});
