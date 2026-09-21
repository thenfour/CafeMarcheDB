import { describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { assertValidSysadminRole } from "src/auth/server/sessionInvalidation";
import db3Mutation from "tests/authorization/db3MutationTestResolver";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { forgeDb3Update } from "./support/db3RequestBuilders";
import { invokeResolver } from "./support/resolverHarness";

describe("role permission changes preserve authenticated sessions", () => {
    it.each(["assigned", "public", "sysadmin"])("allows consecutive matrix edits for the %s role", async kind => {
        const actor = createAuthorizationTestUser("sysadmin", { id: 1 });
        const roleId = actor.roleId!;
        const role = {
            ...actor.role!,
            isPublicRole: kind === "public",
            isSysAdminRole: kind === "sysadmin",
        };
        const sessions = [
            { id: 1, userId: actor.id, user: actor, handle: "actor-session" },
            { id: 2, userId: 2, user: { roleId, isSysAdmin: false }, handle: "other-session" },
        ];
        authorizationTestDb.reset({
            user: [actor], role: [role], session: sessions,
            permission: [{ id: 80, name: Permission.manage_site_branding, roles: [] }],
            rolePermission: [], change: [],
        });
        await invokeResolver(db3Mutation, forgeDb3Update("Permission", 80, { roles: [roleId] }), createAuthorizationTestContext(actor));
        expect(authorizationTestDb.snapshot("rolePermission")).toEqual([
            expect.objectContaining({ roleId, permissionId: 80 }),
        ]);
        expect(authorizationTestDb.snapshot("session")).toEqual(sessions);

        await invokeResolver(db3Mutation, forgeDb3Update("Permission", 80, { roles: [] }), createAuthorizationTestContext(actor));
        expect(authorizationTestDb.snapshot("rolePermission")).toEqual([]);
        expect(authorizationTestDb.snapshot("session")).toEqual(sessions);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(2);
    });
});

describe("BA-R001 startup Sysadmin-role assertion", () => {
    it("requires exactly one designated role", async () => {
        authorizationTestDb.reset({ role: [] });
        await expect(assertValidSysadminRole(authorizationTestDb)).rejects.toThrow("exactly one designated Sysadmin role");
    });

    it("adds missing required grants to the designated role", async () => {
        const createMany = vi.fn();
        await assertValidSysadminRole({
            role: { findMany: async () => [{ id: 30, name: "Admin", permissions: [] }] },
            permission: { findMany: async () => [{ id: 1, name: Permission.sysadmin }, { id: 2, name: Permission.login }] },
            rolePermission: { createMany },
        });
        expect(createMany).toHaveBeenCalledWith({ data: [
            { roleId: 30, permissionId: 1 },
            { roleId: 30, permissionId: 2 },
        ] });
    });

    it("accepts one designated role already carrying the required permissions", async () => {
        const permissions = [{ id: 1, name: Permission.sysadmin }, { id: 2, name: Permission.login }];
        authorizationTestDb.reset({
            role: [{ id: 30, name: "Admin", isSysAdminRole: true, permissions: permissions.map(permission => ({ permission })) }],
            permission: permissions,
            rolePermission: [],
        });
        await assertValidSysadminRole(authorizationTestDb);
        expect(authorizationTestDb.snapshot("rolePermission")).toEqual([]);
    });
});
