import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl, synchronizePermissions } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("permission registry synchronization on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it.each([false, true])("deletes unknown permissions and mappings, including deleted=%s", isDeleted =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const retired = await tx.permission.create({ data: { publicId: generatePublicId(), name: "retired_permission", isDeleted } });
            const globalRole = await tx.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
            const bandRole = await tx.bandRole.findFirstOrThrow({ where: { isPublicRole: true } });
            await tx.globalRolePermission.create({ data: { publicId: generatePublicId(), globalRoleId: globalRole.id, permissionId: retired.id } });
            await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: bandRole.id, permissionId: retired.id } });
            const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
                name: "Retired song visibility", description: "", visiblePermissionId: retired.id, createdByUserId: fixture.user.id } });
            const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
                name: "Retired event visibility", revision: 0, visiblePermissionId: retired.id, createdByUserId: fixture.user.id } });
            const known = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
            await tx.permission.update({ where: { id: known.id }, data: { isDeleted: true } });
            const knownMappings = await tx.bandRolePermission.findMany({ where: { permissionId: known.id } });

            await synchronizePermissions(tx, fixture.englishId);

            expect(await tx.permission.findUnique({ where: { id: retired.id } })).toBeNull();
            expect(await tx.globalRolePermission.count({ where: { permissionId: retired.id } })).toBe(0);
            expect(await tx.bandRolePermission.count({ where: { permissionId: retired.id } })).toBe(0);
            expect(await tx.song.findUniqueOrThrow({ where: { id: song.id } })).toMatchObject({ visiblePermissionId: null, createdByUserId: fixture.user.id });
            expect(await tx.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ visiblePermissionId: null, createdByUserId: fixture.user.id });
            expect(await tx.permission.findUniqueOrThrow({ where: { id: known.id } })).toMatchObject({ name: known.name, isDeleted: true });
            expect(await tx.bandRolePermission.findMany({ where: { permissionId: known.id } })).toEqual(knownMappings);

            const identities = await tx.permission.findMany({ select: { id: true, name: true, publicId: true }, orderBy: { id: "asc" } });
            expect(identities).toHaveLength(gPermissionRegistry.length);
            await synchronizePermissions(tx, fixture.englishId);
            expect(await tx.permission.findMany({ select: { id: true, name: true, publicId: true }, orderBy: { id: "asc" } })).toEqual(identities);
        }));

    it.each(["VISIBILITY_MEMBERS", "visibility_members ", "visíbility_members"])("replaces the non-exact registry key %s", name =>
        withSettingsMysqlFixture(database, async (tx, fixture) => {
            const stale = await tx.permission.update({ where: { name: Permission.visibility_members }, data: { name } });
            const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
                name: "Non-exact visibility key", description: "", visiblePermissionId: stale.id } });
            await synchronizePermissions(tx, fixture.englishId);
            expect(await tx.permission.findUnique({ where: { id: stale.id } })).toBeNull();
            const replacement = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
            expect(replacement.name).toBe(Permission.visibility_members);
            expect(replacement.id).not.toBe(stale.id);
            expect(await tx.bandRolePermission.count({ where: { permissionId: stale.id } })).toBe(0);
            expect((await tx.song.findUniqueOrThrow({ where: { id: song.id } })).visiblePermissionId).toBeNull();
        }));

    it("rolls deletion back if startup configuration validation fails", async () => {
        const retired = await database.permission.create({ data: { publicId: generatePublicId(), name: "retired_rollback_permission" } });
        const role = await database.globalRole.findFirstOrThrow({ where: { isSysAdminRole: true } });
        try {
            await database.globalRole.update({ where: { id: role.id }, data: { isSysAdminRole: false } });
            await expect(initializeAccessControl(database)).rejects.toThrow("designated Sysadmin role");
            expect(await database.permission.findUnique({ where: { id: retired.id } })).not.toBeNull();
        } finally {
            await database.globalRole.update({ where: { id: role.id }, data: { isSysAdminRole: true } });
            await database.permission.deleteMany({ where: { id: retired.id } });
        }
    });
});
