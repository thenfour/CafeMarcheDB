import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPermissionDefinition, isPermission, Permission } from "shared/permissions";
import { initializeAccessControl } from "src/setup/accessControl";
import { assertValidRoleConfiguration } from "src/auth/server/sessionInvalidation";
import { generatePublicId } from "src/server/publicId";
import { settingsMysqlTestUrl } from "./support/settingsMysqlFixture";

function migrationDatabaseUrl(): string | undefined {
    if (!settingsMysqlTestUrl) {
        return undefined;
    }
    const url = new URL(settingsMysqlTestUrl);
    // Temporary tables in the migration require one connection.
    url.searchParams.set("connection_limit", "1");
    return url.toString();
}

const testUrl = migrationDatabaseUrl();
const database = new PrismaClient(testUrl ? { datasourceUrl: testUrl } : undefined);

async function applyMigration(): Promise<void> {
    const sql = readFileSync(resolve("db/migrations/20261019120000_explicit_authorization_roles/migration.sql"), "utf8");
    // This repository migration contains no statement delimiters in SQL literals.
    const statements = sql.replace(/^\s*--.*$/gm, "").split(";").map(statement => statement.trim()).filter(Boolean);
    for (const statement of statements) {
        // Execute reviewed repository SQL against the guarded disposable target.
        await database.$executeRawUnsafe(statement);
    }
}

describe.skipIf(!testUrl)("explicit role migration on MariaDB/MySQL", () => {
    beforeAll(async () => {
        await applyMigration();
        await initializeAccessControl(database);
    }, 30_000);
    afterAll(() => database.$disconnect());

    it("initializes both scopes and preserves a revoked ordinary grant on repeated startup", async () => {
        await assertValidRoleConfiguration(database);
        const [globalRoles, bandRoles] = await Promise.all([
            database.globalRole.findMany({ include: { permissions: { include: { permission: true } } } }),
            database.bandRole.findMany({ include: { bandRolePermissions: { include: { permission: true } } } }),
        ]);
        for (const role of globalRoles) {
            for (const grant of role.permissions) {
                expect(isPermission(grant.permission.name) && getPermissionDefinition(grant.permission.name).scope).toBe("global");
            }
        }
        for (const role of bandRoles) {
            for (const grant of role.bandRolePermissions) {
                expect(isPermission(grant.permission.name) && getPermissionDefinition(grant.permission.name).scope).toBe("band");
            }
        }
        const accountRole = globalRoles.find(role => role.isRoleForNewUsers)!;
        const login = await database.permission.findUniqueOrThrow({ where: { name: Permission.login } });
        await database.globalRolePermission.deleteMany({ where: { globalRoleId: accountRole.id, permissionId: login.id } });
        await initializeAccessControl(database);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: accountRole.id, permissionId: login.id } })).toBe(0);
        await database.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: accountRole.id, permissionId: login.id } });
        const sysadmin = globalRoles.find(role => role.isSysAdminRole)!;
        const bandAdminPermission = await database.permission.findUniqueOrThrow({ where: { name: Permission.global_band_admin } });
        await database.globalRolePermission.deleteMany({ where: { globalRoleId: sysadmin.id, permissionId: bandAdminPermission.id } });
        await initializeAccessControl(database);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: sysadmin.id, permissionId: bandAdminPermission.id } })).toBe(0);
        await database.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: sysadmin.id, permissionId: bandAdminPermission.id } });
    });

    it("materializes old defaults and Public inheritance while retiring mismatched grants", async () => {
        const admin = await database.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        const bandPublic = await database.bandRole.findFirstOrThrow({ where: { isPublicRole: true } });
        const bandDefault = await database.bandRole.findFirstOrThrow({ where: { isRoleForNewUsers: true } });
        const permissionRows = await database.permission.findMany();
        const permissionId = (name: Permission): number => permissionRows.find(permission => permission.name === name)!.id;
        await database.globalRole.deleteMany({ where: { isSysAdminRole: false } });
        await database.permission.delete({ where: { name: Permission.global_band_admin } });
        await database.bandRolePermission.createMany({ data: [
            Permission.always_grant, Permission.public, Permission.practice_tools_use, Permission.login,
            Permission.sysadmin, Permission.manage_global_users,
        ]
            .map(name => ({ publicId: generatePublicId(), bandRoleId: bandPublic.id, permissionId: permissionId(name) })) });
        const unknown = await database.permission.create({ data: { publicId: generatePublicId(), name: "unknown_historical_capability" } });
        await database.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: bandPublic.id, permissionId: unknown.id } });
        await database.permission.update({ where: { name: Permission.public }, data: { isDeleted: true } });
        await database.globalRolePermission.create({ data: {
            publicId: generatePublicId(), globalRoleId: admin.id, permissionId: permissionId(Permission.manage_events),
        } });
        const customBandRole = await database.bandRole.create({ data: {
            publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            bandRolePermissions: { create: { publicId: generatePublicId(), permissionId: permissionId(Permission.manage_songs) } },
        } });
        const customGlobalRole = await database.globalRole.create({ data: {
            publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            isPublicRole: true, isRoleForNewUsers: true,
            permissions: { create: [Permission.merge_users, Permission.sysadmin, Permission.manage_global_users].map(name => ({
                publicId: generatePublicId(), permissionId: permissionId(name),
            })) },
        } });
        const customAccount = await database.user.create({ data: {
            publicId: generatePublicId(), name: "Custom role account", email: "custom@test.invalid", globalRoleId: customGlobalRole.id,
        } });
        const account = await database.user.create({ data: { publicId: generatePublicId(), name: "Roleless account", email: "roleless@test.invalid" } });
        const oldSysadmin = await database.user.create({ data: { publicId: generatePublicId(), name: "Legacy administrator", email: "admin@test.invalid", isSysAdmin: true } });
        const band = await database.band.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } } } });
        const member = await database.bandUser.create({ data: { publicId: generatePublicId(), userId: account.id, bandId: band.id } });

        await applyMigration();
        await assertValidRoleConfiguration(database);
        const globalPublic = await database.globalRole.findFirstOrThrow({ where: { isPublicRole: true } });
        const accountDefault = await database.globalRole.findFirstOrThrow({ where: { isRoleForNewUsers: true } });
        expect((await database.user.findUniqueOrThrow({ where: { id: account.id } })).globalRoleId).toBe(accountDefault.id);
        expect((await database.user.findUniqueOrThrow({ where: { id: oldSysadmin.id } })).globalRoleId).toBe(admin.id);
        expect((await database.user.findUniqueOrThrow({ where: { id: customAccount.id } })).globalRoleId).toBe(customGlobalRole.id);
        expect((await database.globalRole.findUniqueOrThrow({ where: { id: customGlobalRole.id } }))).toMatchObject({
            isPublicRole: false, isRoleForNewUsers: false,
        });
        expect(globalPublic.id).not.toBe(customGlobalRole.id);
        expect(accountDefault.id).not.toBe(customGlobalRole.id);
        expect((await database.bandUser.findUniqueOrThrow({ where: { id: member.id } })).bandRoleId).toBe(bandDefault.id);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: globalPublic.id, permissionId: permissionId(Permission.practice_tools_use) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: {
            globalRoleId: globalPublic.id,
            permissionId: { in: [Permission.sysadmin, Permission.manage_global_users, Permission.login, Permission.public].map(permissionId) },
        } })).toBe(0);
        expect(await database.globalRolePermission.count({ where: {
            globalRoleId: accountDefault.id, permissionId: { in: [Permission.sysadmin, Permission.manage_global_users].map(permissionId) },
        } })).toBe(0);
        expect(await database.globalRolePermission.count({ where: { permissionId: unknown.id } })).toBe(0);
        expect(await database.bandRolePermission.count({ where: { bandRoleId: bandPublic.id, permissionId: unknown.id } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: customGlobalRole.id, permissionId: permissionId(Permission.practice_tools_use) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: customGlobalRole.id, permissionId: permissionId(Permission.merge_users) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: customGlobalRole.id, permissionId: permissionId(Permission.sysadmin) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: customGlobalRole.id, permissionId: permissionId(Permission.manage_global_users) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { globalRoleId: customGlobalRole.id, permissionId: permissionId(Permission.login) } })).toBe(1);
        expect(await database.bandRolePermission.count({ where: { bandRoleId: customBandRole.id, permissionId: permissionId(Permission.manage_songs) } })).toBe(1);
        expect(await database.bandRolePermission.count({ where: { bandRoleId: customBandRole.id, permissionId: permissionId(Permission.view_events) } })).toBe(1);
        expect(await database.globalRolePermission.count({ where: { permissionId: permissionId(Permission.manage_events) } })).toBe(0);
        expect(await database.bandRolePermission.count({ where: { permissionId: permissionId(Permission.practice_tools_use) } })).toBe(0);
        expect(await database.bandRolePermission.count({ where: { bandRoleId: bandPublic.id, permissionId: permissionId(Permission.visibility_logged_in_users) } })).toBe(0);
        await database.permission.update({ where: { name: Permission.public }, data: { isDeleted: false } });
        await initializeAccessControl(database);
    }, 30_000);

    it("rejects ambiguous existing designations before permanent migration writes", async () => {
        const duplicatePublic = await database.bandRole.create({ data: {
            publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } }, isPublicRole: true,
        } });
        try {
            const before = await Promise.all([
                database.globalRole.count(), database.permission.count(), database.globalRolePermission.count(),
            ]);
            await expect(applyMigration()).rejects.toThrow("Exactly one active Band Public role is required");
            expect(await Promise.all([
                database.globalRole.count(), database.permission.count(), database.globalRolePermission.count(),
            ])).toEqual(before);
        } finally {
            await database.bandRole.delete({ where: { id: duplicatePublic.id } });
            await database.$executeRaw`DROP TEMPORARY TABLE IF EXISTS _ExplicitRoleAssertions`;
            await database.$executeRaw`DROP TEMPORARY TABLE IF EXISTS _ExplicitRoleContext`;
            await database.$executeRaw`DROP TEMPORARY TABLE IF EXISTS _ExplicitRolePermissionScopes`;
        }
    });
});
