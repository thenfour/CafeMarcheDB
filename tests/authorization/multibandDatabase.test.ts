import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { resolveRequestLocale } from "src/locale/server/requestLocale";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";

const testUrl = process.env.CMDB_PHASE1_TEST_DATABASE_URL;
if (testUrl) {
    const url = new URL(testUrl);
    if (url.hostname !== "127.0.0.1" || !["32693", "32694"].includes(url.port)
        || !url.pathname.startsWith("/lsmb_phase1_")) {
        throw new Error("Phase-1 database tests require an isolated loopback test database.");
    }
}

describe.skipIf(!testUrl)("access-control foundations on the target database", () => {
    const database = new PrismaClient(testUrl ? { datasources: { db: { url: testUrl } } } : undefined);
    beforeAll(async () => { await initializeAccessControl(database); }, 30_000);
    afterAll(async () => { await database.$disconnect(); });

    it("initializes three locales, one global role, band roles, and localized permission metadata", async () => {
        expect((await database.locale.findMany({ orderBy: { sortOrder: "asc" } })).map(locale => locale.ietfTag))
            .toEqual(["en-US", "fr-BE", "nl-BE"]);
        expect(await database.globalRole.count()).toBe(1);
        expect(await database.bandRole.count()).toBe(6);
        const permission = await database.permission.findUniqueOrThrow({
            where: { name: Permission.manage_global_users },
            include: { description: { include: { values: true } } },
        });
        expect(permission.description?.format).toBe("Markdown");
        expect(permission.description?.values[0]?.blobValue).toContain("shared accounts");
        const brandingRoles = await database.bandRole.findMany({
            where: { bandRolePermissions: { some: { permission: { name: Permission.manage_site_branding } } } },
            include: { bandRolePermissions: { include: { permission: true } } },
        });
        expect(brandingRoles).toHaveLength(1);
        expect(brandingRoles[0]?.bandRolePermissions.map(grant => grant.permission.name))
            .toEqual(expect.arrayContaining([Permission.manage_band_settings, Permission.manage_band_localization]));
    });

    it("is repeatable and preserves existing descriptions, unknown permissions, and matrices", async () => {
        const english = await database.locale.findUniqueOrThrow({ where: { ietfTag: "en-US" } });
        const permission = await database.permission.findUniqueOrThrow({ where: { name: Permission.public } });
        const original = await database.dynamicLocalizedStringValue.findUniqueOrThrow({
            where: { localeId_stringId: { localeId: english.id, stringId: permission.descriptionId! } },
        });
        const custom = await database.permission.create({ data: {
            publicId: generatePublicId<"Permission">(), name: `retired_test_${generatePublicId()}`, isDeleted: true,
        } });
        await database.dynamicLocalizedStringValue.update({ where: { id: original.id }, data: { blobValue: "Custom English description" } });
        const counts = {
            strings: await database.dynamicLocalizedString.count(),
            globalGrants: await database.globalRolePermission.count(),
            bandGrants: await database.bandRolePermission.count(),
        };
        try {
            await initializeAccessControl(database);
            expect(await database.dynamicLocalizedString.count()).toBe(counts.strings);
            expect(await database.globalRolePermission.count()).toBe(counts.globalGrants);
            expect(await database.bandRolePermission.count()).toBe(counts.bandGrants);
            expect((await database.permission.findUniqueOrThrow({ where: { id: custom.id } })).isDeleted).toBe(true);
            expect((await database.dynamicLocalizedStringValue.findUniqueOrThrow({ where: { id: original.id } })).blobValue)
                .toBe("Custom English description");
        } finally {
            await database.dynamicLocalizedStringValue.update({ where: { id: original.id }, data: { blobValue: original.blobValue } });
            await database.permission.delete({ where: { id: custom.id } });
        }
    });

    it("enforces membership scope with real relations and keeps account access after band offboarding", async () => {
        const rollback = new Error("rollback isolated fixture");
        try {
            await database.$transaction(async transaction => {
                const english = await transaction.locale.findUniqueOrThrow({ where: { ietfTag: "en-US" } });
                const memberRole = await transaction.bandRole.findFirstOrThrow({
                    where: { name: { values: { some: { localeId: english.id, indexedValue: "Normal Users" } } } },
                });
                const adminRole = await transaction.bandRole.findFirstOrThrow({
                    where: { name: { values: { some: { localeId: english.id, indexedValue: "Band Admin" } } } },
                });
                const user = await transaction.user.create({ data: {
                    publicId: generatePublicId<"User">(), name: "Shared fixture person", email: "fixture@test.invalid",
                } });
                const bands: Array<{ id: number; publicId: string }> = [];
                for (const bandRoleId of [adminRole.id, memberRole.id]) {
                    const name = await transaction.dynamicLocalizedString.create({ data: {
                        publicId: generatePublicId<"DynamicLocalizedString">(), format: "PlainText",
                    } });
                    const band = await transaction.band.create({ data: {
                        publicId: generatePublicId<"Band">(), nameId: name.id,
                        locales: { create: { localeId: english.id } },
                    } });
                    await transaction.bandUser.create({ data: {
                        publicId: generatePublicId<"BandUser">(), bandId: band.id, userId: user.id, bandRoleId,
                    } });
                    bands.push(band);
                }
                const first = bands[0]!, second = bands[1]!;
                const firstBandPublicId = parsePublicId<"Band">(first.publicId);
                const secondBandPublicId = parsePublicId<"Band">(second.publicId);
                const firstAuth = await loadAuthorizationForUser(user, transaction, firstBandPublicId);
                const secondAuth = await loadAuthorizationForUser(user, transaction, secondBandPublicId);
                expect(firstAuth.hasPermission(Permission.manage_band_settings)).toBe(true);
                expect(secondAuth.hasPermission(Permission.manage_band_settings)).toBe(false);
                expect(firstAuth.hasPermission(Permission.manage_global_users)).toBe(false);
                expect(() => firstAuth.requireBandResource(second.id)).toThrow("another band");

                const french = await transaction.locale.findUniqueOrThrow({ where: { ietfTag: "fr-BE" } });
                await transaction.bandLocale.create({ data: { bandId: first.id, localeId: french.id } });
                expect((await resolveRequestLocale(transaction, first.id, "fr-FR")).ietfTag).toBe("fr-BE");
                expect((await resolveRequestLocale(transaction, second.id, "fr-FR")).ietfTag).toBe("en-US");
                await transaction.bandLocale.deleteMany({ where: { bandId: first.id } });
                await expect(resolveRequestLocale(transaction, first.id)).rejects.toThrow("No active locale");
                expect((await firstAuth.refresh(transaction)).hasPermission(Permission.manage_band_settings)).toBe(true);

                await transaction.bandUser.update({ where: { id: firstAuth.requireMembership().id }, data: { isDeleted: true } });
                const offboarded = await firstAuth.refresh(transaction);
                expect(offboarded.membership).toBeNull();
                expect(offboarded.hasPermission(Permission.manage_band_settings)).toBe(false);
                expect(offboarded.hasPermission(Permission.login)).toBe(true);
                expect((await secondAuth.refresh(transaction)).requireMembership().bandId).toBe(second.id);
                expect((await loadAuthorizationForUser(user, transaction)).hasPermission(Permission.manage_events)).toBe(false);
                throw rollback;
            }, { timeout: 30_000 });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    });
});
