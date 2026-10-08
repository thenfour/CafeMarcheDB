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

// MIGRATION_RESTORE: role-administration
// Source: 09914973c9b78c61740b465524f7ba48ccbe47c9:tests/authorization/sessionAuthorizationHardening.test.ts:1-94
// Reason: The single-band role matrix is isolated; its session-preservation scenarios require target global/band role commands.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: e1714128247b79d713384dfdd22cf29d778b025296853f51fce2f5443ea4e4d7
// MIGRATION_REFERENCE_BEGIN
// import { describe, expect, it, vi } from "vitest";
// import { Permission } from "shared/permissions";
// import { isPublicId, parsePublicId } from "shared/publicId";
//
// vi.mock("db", async () => {
//     const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
//     const { authorizationTestDb } = await import("./support/inMemoryPrisma");
//     return { ...prisma, default: authorizationTestDb };
// });
//
// import { assertValidSysadminRole } from "src/auth/server/sessionInvalidation";
// import db3Mutation from "tests/authorization/db3MutationTestResolver";
// import { authorizationTestDb } from "./support/inMemoryPrisma";
// import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
// import { forgeDb3PublicUpdate } from "./support/db3RequestBuilders";
// import { invokeResolver } from "./support/resolverHarness";
//
// describe("role permission changes preserve authenticated sessions", () => {
//     it.each(["assigned", "public", "sysadmin"])("allows consecutive matrix edits for the %s role", async kind => {
//         const actor = createAuthorizationTestUser("sysadmin", { id: 1 });
//         const roleId = actor.roleId!;
//         const role = {
//             ...actor.role!,
//             isPublicRole: kind === "public",
//             isSysAdminRole: kind === "sysadmin",
//         };
//         const permissionPublicId = parsePublicId<"Permission">("SessionPerm00080");
//         const sessions = [
//             { id: 1, userId: actor.id, user: actor, handle: "actor-session" },
//             { id: 2, userId: 2, user: { roleId, isSysAdmin: false }, handle: "other-session" },
//         ];
//         authorizationTestDb.reset({
//             user: [actor], role: [role], session: sessions,
//             permission: [{
//                 id: 80,
//                 publicId: permissionPublicId,
//                 name: Permission.manage_site_branding,
//                 roles: [],
//             }],
//             rolePermission: [], change: [],
//         });
//         await invokeResolver(db3Mutation, forgeDb3PublicUpdate(
//             "Permission",
//             permissionPublicId,
//             { roles: [role.publicId] },
//         ), createAuthorizationTestContext(actor));
//         expect(authorizationTestDb.snapshot("rolePermission")).toEqual([
//             expect.objectContaining({ roleId, permissionId: 80 }),
//         ]);
//         expect(authorizationTestDb.snapshot("session")).toEqual(sessions);
//
//         await invokeResolver(db3Mutation, forgeDb3PublicUpdate(
//             "Permission",
//             permissionPublicId,
//             { roles: [] },
//         ), createAuthorizationTestContext(actor));
//         expect(authorizationTestDb.snapshot("rolePermission")).toEqual([]);
//         expect(authorizationTestDb.snapshot("session")).toEqual(sessions);
//         expect(authorizationTestDb.snapshot("change")).toHaveLength(2);
//     });
// });
//
// describe("BA-R001 startup Sysadmin-role assertion", () => {
//     it("requires exactly one designated role", async () => {
//         authorizationTestDb.reset({ role: [] });
//         await expect(assertValidSysadminRole(authorizationTestDb)).rejects.toThrow("exactly one designated Sysadmin role");
//     });
//
//     it("adds missing required grants to the designated role", async () => {
//         const createMany = vi.fn();
//         await assertValidSysadminRole({
//             role: { findMany: async () => [{ id: 30, name: "Admin", permissions: [] }] },
//             permission: { findMany: async () => [{ id: 1, name: Permission.sysadmin }, { id: 2, name: Permission.login }] },
//             rolePermission: { createMany },
//         });
//         const created = createMany.mock.calls[0]![0].data;
//         expect(created).toEqual([
//             expect.objectContaining({ roleId: 30, permissionId: 1 }),
//             expect.objectContaining({ roleId: 30, permissionId: 2 }),
//         ]);
//         expect(created.every(entry => isPublicId(entry.publicId))).toBe(true);
//     });
//
//     it("accepts one designated role already carrying the required permissions", async () => {
//         const permissions = [{ id: 1, name: Permission.sysadmin }, { id: 2, name: Permission.login }];
//         authorizationTestDb.reset({
//             role: [{ id: 30, name: "Admin", isSysAdminRole: true, permissions: permissions.map(permission => ({ permission })) }],
//             permission: permissions,
//             rolePermission: [],
//         });
//         await assertValidSysadminRole(authorizationTestDb);
//         expect(authorizationTestDb.snapshot("rolePermission")).toEqual([]);
//     });
// });
// MIGRATION_REFERENCE_END
