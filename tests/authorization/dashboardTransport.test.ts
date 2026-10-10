import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { gGeneralPaletteList } from "src/core/components/color/palette";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { xBandInstrument } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { hydrateDashboardData, type DashboardDataDto } from "src/core/db3/shared/references/dashboardData";
import { eventAttendanceDashboardView, instrumentDashboardView, instrumentFunctionalGroupDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { xEventAttendance } from "src/core/db3/shared/schema/event";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "../support/settingsMysqlFixture";

async function seedDashboard(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const bandId = fixture.bands[0]!.id;
    const bandPublicId = parsePublicId<"Band">(fixture.bands[0]!.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const name = (indexedValue: string) => tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
        publicId: generatePublicId(), localeId: fixture.englishId, indexedValue,
    } } } });
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId, color: "orange", nameId: (await name("Brass")).id } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId, functionalGroupId: group.id, nameId: (await name("Trumpet")).id } });
    const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const menu = await tx.menuLink.create({ data: { publicId: generatePublicId(), bandId, captionId: (await name("Scores")).id,
        groupName: "scores", groupCssClass: "", itemCssClass: "", linkType: "ExternalURL", externalURI: "https://example.test/scores",
        createdByUserId: fixture.user.id, visiblePermissionId: permission.id } });
    const read = async () => loadDashboardData(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, { bandPublicId, routeLocale: "en-US" });
    return { group, instrument, permission, menu, read };
}

describe.skipIf(!settingsMysqlTestUrl)("dashboard transport boundary on migrated MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("delivers public DTOs and hydrates normalized references once at the consumer without mutating the payload", () => run(async (tx, fixture) => {
        const seed = await seedDashboard(tx, fixture);
        const groupHydrate = vi.spyOn(instrumentFunctionalGroupDashboardView, "hydrate");
        const instrumentHydrate = vi.spyOn(instrumentDashboardView, "hydrate");
        const dto = await seed.read();
        expectTypeOf(dto).toEqualTypeOf<DashboardDataDto>();
        expect(groupHydrate).not.toHaveBeenCalled();
        expect(instrumentHydrate).not.toHaveBeenCalled();
        expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
        expect(dto.instrument[0]).toMatchObject({ functionalGroupId: seed.group.publicId });
        expect(dto.instrument[0]).not.toHaveProperty("id");
        expect(dto.instrument[0]).not.toHaveProperty("functionalGroup");
        expect(dto.dynMenuLinks[0]).toMatchObject({ visiblePermissionId: seed.permission.publicId });
        expect(dto.dynMenuLinks[0]).not.toHaveProperty("visiblePermission");
        expect(dto).not.toHaveProperty("referenceStore");
        expect(instrumentDashboardView.parseDto(dto.instrument[0])).toEqual(dto.instrument[0]);

        const client = hydrateDashboardData(dto);
        expect(groupHydrate).toHaveBeenCalledOnce();
        expect(instrumentHydrate).toHaveBeenCalledOnce();
        expect(client.instrumentFunctionalGroup[0]!.color).toEqual(gGeneralPaletteList.findEntry("orange"));
        expect(client.instrument[0]!.functionalGroup).toBe(client.instrumentFunctionalGroup[0]);
        expect(client.dynMenuLinks[0]!.visiblePermission).toBe(client.permission.find(permission => permission.publicId === seed.permission.publicId));
        expect(client.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.publicId))).toBe(client.instrument[0]);
        expect(dto.instrumentFunctionalGroup[0]!.color).toBe("orange");
        expect(dto.instrument[0]).not.toHaveProperty("functionalGroup");
    }));

    it("rebuilds the reference store for each snapshot and rejects missing required references", () => run(async (tx, fixture) => {
        const seed = await seedDashboard(tx, fixture);
        const dto = await seed.read();
        const first = hydrateDashboardData(dto);
        const refreshed = hydrateDashboardData({ ...dto, instrument: [], instrumentFunctionalGroup: [] });
        expect(refreshed.referenceStore).not.toBe(first.referenceStore);
        expect(refreshed.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seed.instrument.publicId))).toBeUndefined();
        expect(() => hydrateDashboardData({ ...dto, instrumentFunctionalGroup: [] })).toThrow(/not available/);
    }));

    it("keeps partial attendance options and freshly inaccessible rows out of complete client option lists", () => run(async (tx, fixture) => {
        const seed = await seedDashboard(tx, fixture);
        const dto = await seed.read();
        const missing = xEventAttendance.parseIdentity("DashboardAttend1");
        // The migrated DTO requires complete fields; a partial option fails before hydration.
        expect(() => eventAttendanceDashboardView.parseDto({ publicId: missing })).toThrow();
        const client = hydrateDashboardData(dto);
        expect(client.referenceStore.get(xEventAttendance, missing)).toBeUndefined();
        await tx.bandInstrumentFunctionalGroup.update({ where: { id: seed.group.id }, data: { isHidden: true } });
        await tx.menuLink.update({ where: { id: seed.menu.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } }, data: { bandRoleId: null } });
        const refreshed = hydrateDashboardData(await seed.read());
        expect(refreshed.instrument).toEqual([]);
        expect(refreshed.dynMenuLinks).toEqual([]);
        // The migrated role designation is a server-derived notice; role administration stays separate.
        expect(refreshed.hasLimitedAccess).toBe(true);
        expect(refreshed).not.toHaveProperty("role");
    }));
});
