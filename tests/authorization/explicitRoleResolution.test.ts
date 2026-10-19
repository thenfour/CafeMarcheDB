import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { authorizationTestDb } from "./support/inMemoryPrisma";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";

// The double implements the standard Prisma reads used by authorization.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const bandA = parsePublicId<"Band">("ExplicitBand0001");
const bandB = parsePublicId<"Band">("ExplicitBand0002");
const permissionId = (name: Permission) => gPermissionRegistry.findIndex(definition => definition.key === name) + 1;
const user = { id: 42, publicId: "ExplicitUser0001", globalRoleId: 20, isDeleted: false,
    mergedIntoUserId: null, isSysAdmin: false };
const load = (principal: { id: number } | null = user, band: typeof bandA | null = null) =>
    loadAuthorizationForUser(principal, database, band);

beforeEach(() => {
    authorizationTestDb.reset({
        user: [user],
        band: [{ id: 1, publicId: bandA, isDeleted: false }, { id: 2, publicId: bandB, isDeleted: false }],
        permission: gPermissionRegistry.map((definition, index) => ({ id: index + 1, name: definition.key, isDeleted: false })),
        globalRole: [{ id: 1, isPublicRole: true, isDeleted: false }, { id: 20, isDeleted: false }, { id: 21, isDeleted: false }],
        globalRolePermission: [
            { id: 1, globalRoleId: 1, permissionId: permissionId(Permission.public) },
            { id: 2, globalRoleId: 20, permissionId: permissionId(Permission.login) },
            { id: 3, globalRoleId: 21, permissionId: permissionId(Permission.global_band_admin) },
        ],
        bandRole: [{ id: 10, isPublicRole: true, isDeleted: false }, { id: 11, isDeleted: false }, { id: 12, isDeleted: false }],
        bandRolePermission: [
            { id: 1, bandRoleId: 10, permissionId: permissionId(Permission.view_events) },
            { id: 2, bandRoleId: 11, permissionId: permissionId(Permission.manage_events) },
            { id: 3, bandRoleId: 12, permissionId: permissionId(Permission.view_songs) },
        ],
        bandUser: [
            { id: 1, publicId: "ExplicitMember01", userId: 42, bandId: 1, bandRoleId: 11, isDeleted: false },
            { id: 2, publicId: "ExplicitMember02", userId: 42, bandId: 2, bandRoleId: 12, isDeleted: false },
        ],
    });
});

describe("explicit role selection", () => {
    it("uses Global Public alone without a band and both Public roles with a band", async () => {
        expect((await load(null)).effectivePermissions.names).toEqual([Permission.public]);
        const auth = await load(null, bandA);
        expect(auth.effectivePermissions.names).toEqual([Permission.public, Permission.view_events]);
        expect(auth.sessionPermissions.names).toEqual([Permission.public]);
        expect(auth.membership).toBeNull();
    });

    it("does not inherit either Public role alongside assigned roles", async () => {
        expect((await load()).effectivePermissions.names).toEqual([Permission.login]);
        expect((await load(user, bandA)).effectivePermissions.names).toEqual([Permission.login, Permission.manage_events]);
        expect((await load(user, bandB)).effectivePermissions.names).toEqual([Permission.login, Permission.view_songs]);
    });

    it.each(["no membership", "inactive membership", "unassigned role"])("selects Band Public for %s", async scenario => {
        const memberships = authorizationTestDb.getDelegate("bandUser");
        if (scenario === "no membership") {
            await memberships.delete({ where: { id: 1 } });
        } else {
            await memberships.update({ where: { id: 1 }, data: scenario === "inactive membership"
                ? { isDeleted: true } : { bandRoleId: null } });
        }
        const auth = await load(user, bandA);
        expect(auth.effectivePermissions.names).toEqual([Permission.login, Permission.view_events]);
        expect(auth.membership !== null).toBe(scenario === "unassigned role");
    });

    it("selects Global Public for an unassigned global slot without inventing account grants", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { globalRoleId: null, isSysAdmin: true } });
        const auth = await load();
        expect(auth.userId).toBe(42);
        expect(auth.effectivePermissions.names).toEqual([Permission.public]);
    });

    it("allows database-configured Public grants without turning them into identity or membership", async () => {
        await authorizationTestDb.getDelegate("globalRolePermission").create({ data: {
            globalRoleId: 1, permissionId: permissionId(Permission.login),
        } });
        await authorizationTestDb.getDelegate("bandRolePermission").create({ data: {
            bandRoleId: 10, permissionId: permissionId(Permission.manage_events),
        } });
        const auth = await load(null, bandA);
        expect(auth.hasPermission(Permission.login)).toBe(true);
        expect(auth.hasPermission(BandPermission.manage_events)).toBe(true);
        expect(() => auth.requireUser()).toThrow("active user");
        expect(() => auth.requireMembership()).toThrow("active user");
    });

    it.each(["global", "band"])("rejects an unavailable explicitly assigned %s role", async scope => {
        await authorizationTestDb.getDelegate(scope === "global" ? "globalRole" : "bandRole").update({
            where: { id: scope === "global" ? 20 : 11 }, data: { isDeleted: true },
        });
        await expect(load(user, bandA)).rejects.toThrow(`assigned ${scope} role is unavailable`);
    });

    it.each(["global", "band"])("rejects mismatched grants on a %s role", async scope => {
        if (scope === "global") {
            await authorizationTestDb.getDelegate("globalRolePermission").create({ data: {
                globalRoleId: 20, permissionId: permissionId(Permission.manage_events),
            } });
        } else {
            await authorizationTestDb.getDelegate("bandRolePermission").create({ data: {
                bandRoleId: 11, permissionId: permissionId(Permission.login),
            } });
        }
        await expect(load(user, bandA)).rejects.toThrow(`A ${scope} role cannot grant`);
    });

    it.each(["global", "band"])("rejects ambiguous %s Public selection", async scope => {
        await authorizationTestDb.getDelegate(scope === "global" ? "globalRole" : "bandRole").create({
            data: { isPublicRole: true, isDeleted: false },
        });
        await expect(load(null, bandA)).rejects.toThrow(`exactly one active ${scope === "global" ? "Global" : "Band"} Public role`);
    });

    it("accepts global band administration only with a target band and keeps exact grants visible", async () => {
        await authorizationTestDb.getDelegate("user").update({ where: { id: 42 }, data: { globalRoleId: 21 } });
        await authorizationTestDb.getDelegate("bandUser").deleteMany();
        const platform = await load();
        expect(platform.hasPermission(BandPermission.manage_events)).toBe(false);
        for (const band of [bandA, bandB]) {
            const auth = await load(user, band);
            expect(auth.hasPermission(BandPermission.manage_events)).toBe(true);
            expect(auth.hasPermission(Permission.manage_events)).toBe(false);
            expect(auth.effectivePermissions.names).toEqual([Permission.global_band_admin, Permission.view_events]);
            expect(auth.membership).toBeNull();
            expect(() => auth.requireBandResource(band === bandA ? 2 : 1)).toThrow("another band");
            expect(() => auth.requireMembership()).toThrow("active membership");
            const client = new CMClientAuthorization(auth.user, new PermissionSet(auth.effectivePermissions.names), null, band);
            expect(client.hasPermission(BandPermission.manage_events)).toBe(true);
        }
        const client = new CMClientAuthorization(platform.user, new PermissionSet(platform.effectivePermissions.names));
        expect(client.hasPermission(BandPermission.manage_events)).toBe(false);
    });
});
