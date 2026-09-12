import { describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import {
    assertValidSysadminRole,
    invalidateSessionsForRolePermissionChanges,
} from "src/auth/server/sessionInvalidation";
import { CallMutateEventHooks } from "src/core/db3/server/db3mutationCore";

describe("BA-R002 role permission revocation", () => {
    it("derives every affected role from a batched RolePermission mutation hook", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const db = {
            role: { findMany },
            session: { deleteMany: vi.fn() },
        } as any;

        await CallMutateEventHooks({
            tableNameOrSpecialMutationKey: "RolePermission",
            model: { id: 1, roleId: 10 },
            oldModel: { id: 1, roleId: 9 },
            additionalModels: [{ id: 2, roleId: 11 }],
            db,
        });

        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: { in: [10, 9, 11] } },
        }));
    });

    it("invalidates every session for a public-role grant change", async () => {
        const deleteMany = vi.fn();
        const db = {
            role: { findMany: vi.fn().mockResolvedValue([{ id: 10, isPublicRole: true, isSysAdminRole: false }]) },
            session: { deleteMany },
        } as any;

        await invalidateSessionsForRolePermissionChanges(db, [10]);

        expect(deleteMany).toHaveBeenCalledWith({});
    });

    it("invalidates assigned users and User.isSysAdmin principals for a Sysadmin-role grant change", async () => {
        const deleteMany = vi.fn();
        const db = {
            role: { findMany: vi.fn().mockResolvedValue([{ id: 20, isPublicRole: false, isSysAdminRole: true }]) },
            session: { deleteMany },
        } as any;

        await invalidateSessionsForRolePermissionChanges(db, [20]);

        expect(deleteMany).toHaveBeenCalledWith({
            where: {
                user: {
                    OR: [
                        { roleId: { in: [20] } },
                        { isSysAdmin: true },
                    ],
                },
            },
        });
    });
});

describe("BA-R001 startup Sysadmin-role assertion", () => {
    it("requires exactly one designated role", async () => {
        const db = { role: { findMany: vi.fn().mockResolvedValue([]) } } as any;
        await expect(assertValidSysadminRole(db)).rejects.toThrow("exactly one designated Sysadmin role");
    });

    it("requires the designated role to carry the Sysadmin permission", async () => {
        const db = {
            role: {
                findMany: vi.fn().mockResolvedValue([{ id: 30, name: "Admin", permissions: [] }]),
            },
        } as any;
        await expect(assertValidSysadminRole(db)).rejects.toThrow(`must grant ${Permission.sysadmin}`);
    });

    it("accepts one designated role carrying the Sysadmin permission", async () => {
        const db = {
            role: {
                findMany: vi.fn().mockResolvedValue([{
                    id: 30,
                    name: "Admin",
                    permissions: [{ permission: { name: Permission.sysadmin } }],
                }]),
            },
        } as any;
        await expect(assertValidSysadminRole(db)).resolves.toBeUndefined();
    });
});
