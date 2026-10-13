import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { loadAvailableBands } from "src/auth/server/availableBands";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { hydrateDashboardData } from "src/core/db3/shared/references/dashboardData";
import { instrumentDashboardView, instrumentFunctionalGroupDashboardView } from "src/core/db3/shared/references/dashboardReferences";
import { xBandInstrument } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("account and dashboard bootstrap on migrated MariaDB data", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasources: { db: { url: settingsMysqlTestUrl } } }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (transaction: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) =>
        withSettingsMysqlFixture(database!, work);

    async function authorize(transaction: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index?: number) {
        const auth = await loadAuthorizationForUser(fixture.user, transaction,
            index === undefined ? null : parsePublicId<"Band">(fixture.bands[index]!.publicId));
        return { auth, context: await bindDB3ReadSnapshot(transaction, auth, { isolationLevel: "Serializable" }) };
    }

    async function seedInstrument(transaction: Prisma.TransactionClient, fixture: SettingsMysqlFixture, index: number) {
        const bandId = fixture.bands[index]!.id;
        const name = await transaction.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        await transaction.bandDynamicLocalizedStringValue.create({ data: {
            publicId: generatePublicId(), bandId, stringId: name.id, localeId: fixture.englishId, indexedValue: `Instrument ${index}`,
        } });
        const group = await transaction.bandInstrumentFunctionalGroup.create({ data: {
            publicId: generatePublicId(), bandId, nameId: name.id,
        } });
        const instrument = await transaction.bandInstrument.create({ data: {
            publicId: generatePublicId(), bandId, nameId: name.id, functionalGroupId: group.id,
        } });
        const member = await transaction.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId, userId: fixture.user.id } } });
        await transaction.bandUserInstrument.create({ data: {
            publicId: generatePublicId(), bandUserId: member.id, bandInstrumentId: instrument.id, isPrimary: true,
        } });
        return { member, instrument };
    }

    it("boots platform/account context without executing deferred domain readers", () => withFixture(async (tx, fixture) => {
        const name = await tx.dynamicLocalizedString.create({ data: {
            publicId: generatePublicId(), format: "PlainText",
            values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Historical confirmation" } },
        } });
        const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), format: "Markdown" } });
        const status = await tx.eventStatus.create({ data: {
            publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, isDeleted: true,
        } });
        const eventRead = vi.spyOn(tx.event, "findMany");
        const menuRead = vi.spyOn(tx.menuLink, "findMany");
        const { context, auth } = await authorize(tx, fixture);
        const dto = await loadDashboardData(context, auth, {});
        expect(dto.currentMembership).toBeNull();
        expect(dto.authorization.bandPublicId).toBeNull();
        expect(dto.instrument).toEqual([]);
        expect(dto.relevantEventIds).toEqual([]);
        expect(dto).not.toHaveProperty("role");
        expect(dto.permission.length).toBeGreaterThan(0);
        expect(dto.permission.every(permission => !("id" in permission) && !("roles" in permission))).toBe(true);
        expect(dto.eventStatus).toEqual([expect.objectContaining({ publicId: status.publicId, name: "Historical confirmation", isDeleted: true })]);
        expect(eventRead).not.toHaveBeenCalled();
        expect(menuRead).not.toHaveBeenCalled();
        const hydrated = hydrateDashboardData(dto);
        expect(hydrated.currentMembership).toBeNull();
        expect(hydrated.eventStatus[0]?.name).toBe("Historical confirmation");
    }));

    it("keeps the shared person's instruments in the explicitly selected membership, including a roleless owner", () => withFixture(async (tx, fixture) => {
        const seeds = await Promise.all([seedInstrument(tx, fixture, 0), seedInstrument(tx, fixture, 1)]);
        const groupHydrate = vi.spyOn(instrumentFunctionalGroupDashboardView, "hydrate");
        const instrumentHydrate = vi.spyOn(instrumentDashboardView, "hydrate");
        let previousReferences: ReturnType<typeof hydrateDashboardData>["referenceStore"] | undefined;
        for (const [index, seed] of seeds.entries()) {
            vi.clearAllMocks();
            const { context, auth } = await authorize(tx, fixture, index);
            const dto = await loadDashboardData(context, auth, { bandPublicId: parsePublicId<"Band">(fixture.bands[index]!.publicId) });
            expect(groupHydrate).not.toHaveBeenCalled();
            expect(instrumentHydrate).not.toHaveBeenCalled();
            expect(dto.currentMembership?.publicId).toBe(seed.member.publicId);
            expect(dto.currentMembership?.bandUserInstruments.map(assignment => assignment.bandInstrumentId)).toEqual([seed.instrument.publicId]);
            expect(dto.currentMembership).not.toHaveProperty("id");
            expect(dto.currentMembership).not.toHaveProperty("bandId");
            const hydrated = hydrateDashboardData(dto);
            expect(groupHydrate).toHaveBeenCalledOnce();
            expect(instrumentHydrate).toHaveBeenCalledOnce();
            expect(hydrated.instrument[0]!.functionalGroup).toBe(hydrated.instrumentFunctionalGroup[0]);
            expect(hydrated.referenceStore).not.toBe(previousReferences);
            expect(hydrated.referenceStore.get(xBandInstrument, xBandInstrument.parseIdentity(seeds[1 - index]!.instrument.publicId))).toBeUndefined();
            previousReferences = hydrated.referenceStore;
            expect(hydrated.instrument.map(instrument => instrument.publicId)).toContain(seed.instrument.publicId);
            expect(hydrated.instrument.every(instrument => instrument.publicId !== seeds[1 - index]!.instrument.publicId)).toBe(true);
            expect(dto.instrument[0]).not.toHaveProperty("functionalGroup");
            expect(() => hydrateDashboardData({ ...dto, instrumentFunctionalGroup: [] })).toThrow(/not available/);
        }
    }));

    it("drops a deactivated membership even when the caller retains old authorization", () => withFixture(async (tx, fixture) => {
        const seed = await seedInstrument(tx, fixture, 0);
        const { context, auth } = await authorize(tx, fixture, 0);
        await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: true } });
        const dto = await loadDashboardData(context, auth, { bandPublicId: parsePublicId<"Band">(fixture.bands[0]!.publicId) });
        expect(dto.currentMembership).toBeNull();
        expect(dto.authorization.bandUserPublicId).toBeNull();
        expect((await loadAvailableBands(context, auth, {})).map(band => band.publicId)).toEqual([fixture.bands[1]!.publicId]);
    }));

    it("lists only active memberships and resolves each band's name with that band's locale scope", () => withFixture(async (tx, fixture) => {
        const name = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
        for (const [index, band] of fixture.bands.entries()) {
            await tx.band.update({ where: { id: band.id }, data: { nameId: name.id } });
            await tx.bandDynamicLocalizedStringValue.create({ data: {
                publicId: generatePublicId(), stringId: name.id, bandId: band.id,
                localeId: index === 0 ? fixture.frenchId : fixture.englishId, indexedValue: index === 0 ? "Premiere" : "Second",
            } });
        }
        const { context, auth } = await authorize(tx, fixture);
        const choices = await loadAvailableBands(context, auth, { routeLocale: "fr-BE", browserLanguages: ["en-US"] });
        expect(choices.map(({ publicId, name }) => ({ publicId, name }))).toEqual([
            { publicId: fixture.bands[0]!.publicId, name: "Premiere" },
            { publicId: fixture.bands[1]!.publicId, name: "Second" },
        ]);
        await tx.band.update({ where: { id: fixture.bands[1]!.id }, data: { isDeleted: true } });
        expect(await loadAvailableBands(context, auth, { routeLocale: "fr-BE" })).toEqual([choices[0]]);
    }));

    it("does not enumerate bands for anonymous, deleted or merged accounts", () => withFixture(async (tx, fixture) => {
        const anonymous = await loadAuthorizationForUser(null, tx);
        const anonymousContext = await bindDB3ReadSnapshot(tx, anonymous, { isolationLevel: "Serializable" });
        expect(await loadAvailableBands(anonymousContext, anonymous, {})).toEqual([]);
        const { context, auth } = await authorize(tx, fixture);
        await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } });
        expect(await loadAvailableBands(context, auth, {})).toEqual([]);
        await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: null, isDeleted: true } });
        expect(await loadAvailableBands(context, auth, {})).toEqual([]);
    }));

    it("allows a fresh platform Sysadmin to explicitly choose bands without a membership", () => withFixture(async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx);
        const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const choices = await loadAvailableBands(context, auth, {});
        expect(choices.map(band => band.publicId)).toEqual(expect.arrayContaining(fixture.bands.map(band => band.publicId)));
        expect(choices.every(band => Object.keys(band).sort().join(",") === "name,publicId,supportedLocales")).toBe(true);
        expect(choices.every(band => band.supportedLocales.includes("fr-BE"))).toBe(true);
    }));
    it("returns each destination's active languages for an intentional band switch", () => withFixture(async (tx, fixture) => {
        await tx.bandLocale.deleteMany({ where: { bandId: fixture.bands[1]!.id, localeId: fixture.frenchId } });
        const { context, auth } = await authorize(tx, fixture);
        const choices = await loadAvailableBands(context, auth, {});
        expect(choices.find(choice => choice.publicId === fixture.bands[0]!.publicId)?.supportedLocales).toContain("fr-BE");
        expect(choices.find(choice => choice.publicId === fixture.bands[1]!.publicId)?.supportedLocales).not.toContain("fr-BE");
        expect(choices.find(choice => choice.publicId === fixture.bands[1]!.publicId)?.supportedLocales).toContain("nl-BE");
    }));
});
