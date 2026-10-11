import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityDetails } from "src/core/components/featureReports/server/activityDetails";
import type { ActivityDetailInput } from "src/core/components/featureReports/activityReportTypes";
import { xFile, xFrontpageGalleryItem } from "src/core/db3/shared/schema/file";
import { xEventSegment, xEventSongList } from "src/core/db3/shared/schema/event";
import { xSetlistPlan } from "src/core/db3/shared/schema/setlistPlan";
import { xEventAttendance } from "src/core/db3/shared/entities/event/eventCatalogs";
import { xSongCreditType } from "src/core/db3/shared/entities/song/songCreditTypes";
import { xBandInstrument, xBandInstrumentFunctionalGroup } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { prepareActivityDetailReferences } from "./support/activityDetailReferenceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("activity auxiliary references on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: Parameters<typeof withSettingsMysqlFixture>[1]) => withSettingsMysqlFixture(database!, work);
    const read = (fixture: Awaited<ReturnType<typeof prepareActivityDetailReferences>>, overrides: Partial<ActivityDetailInput> = {}) =>
        readActivityDetails(fixture.report.snapshot, fixture.report.auth, { ...fixture.report.input, detail: { facet: "total" }, ...overrides });

    it("restores all eight references with localized global and inherited catalog text and an explicit safe projection", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await refs.report.add(refs.actionFields);
        const result = await read(refs);
        expect(result.rows[0]).toMatchObject({ userHash: null,
            file: { publicId: refs.file.publicId, fileLeafName: "Score.pdf" },
            eventSegment: { publicId: refs.segment.publicId, name: "Sound check", eventId: refs.event.publicId, startsAt: refs.segment.startsAt },
            eventSongList: { publicId: refs.setlist.publicId, name: "Main set", eventId: refs.event.publicId },
            frontpageGalleryItem: { publicId: refs.gallery.publicId, fileId: refs.file.publicId },
            setlistPlan: { publicId: refs.plan.publicId, name: "Summer plan" },
            songCreditType: { publicId: refs.creditType.publicId, name: "Compositeur", color: "light_blue" },
            attendance: { publicId: refs.attendance.publicId, buttonCaption: "Présent", description: "", color: "light_green", iconName: null },
            instrument: { publicId: refs.instrument.publicId, name: "Trompette globale", color: "light_brown" },
        });
        expect(result.rows[0]).toMatchObject({ uri: null, queryText: null });
        expect(JSON.stringify(result)).not.toMatch(/secret-storage|private-|private |storedLeafName|externalURI|uploadedBy|createdBy|userId|bandId|StringPublicId|Resolution|globalPublicId/);
        expect((await read(refs, { routeLocale: "en-US" })).rows[0]).toMatchObject({ instrument: { name: "Global trumpet" }, attendance: { buttonCaption: "Going" }, songCreditType: { name: "Composer" } });
    }));

    it("withholds an Instrument when its functional group's chip color is denied", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await refs.report.add(refs.actionFields);
        const authorize = xBandInstrumentFunctionalGroup.authorizeColumnForView;
        vi.spyOn(xBandInstrumentFunctionalGroup, "authorizeColumnForView").mockImplementation(args => args.columnName !== "color" && authorize(args));
        expect((await read(refs)).rows[0]!.instrument).toBeNull();
    }));

    it("preserves intentional blank band overrides and never substitutes inherited or English labels", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        const blank = await refs.text("Band trumpet", "");
        await tx.bandInstrument.update({ where: { id: refs.instrument.id }, data: { nameId: blank.id } });
        await tx.dynamicLocalizedStringValue.updateMany({ where: { stringId: refs.attendanceCaption.id, localeId: fixture.frenchId }, data: { indexedValue: "" } });
        await tx.dynamicLocalizedStringValue.updateMany({ where: { stringId: refs.creditName.id, localeId: fixture.frenchId }, data: { indexedValue: "" } });
        await refs.report.add(refs.actionFields);
        expect((await read(refs)).rows[0]).toMatchObject({ instrument: { name: "" }, attendance: { buttonCaption: "" }, songCreditType: { name: "" } });
    }));

    it.each(["hidden", "private", "deleted", "foreign"])("withholds %s Files, their galleries, Event children and plans without losing Actions", mode => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        const common = mode === "hidden" ? { visiblePermissionId: refs.report.hiddenPermission.id }
            : mode === "private" ? { visiblePermissionId: null } : mode === "deleted" ? { isDeleted: true } : { bandId: fixture.bands[1]!.id };
        await tx.file.update({ where: { id: refs.file.id }, data: common });
        await tx.event.update({ where: { id: refs.event.id }, data: { ...common, createdByUserId: fixture.admin.id } });
        await tx.setlistPlan.update({ where: { id: refs.plan.id }, data: common });
        await refs.report.add(refs.actionFields);
        const result = await read(refs);
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]).toMatchObject({ file: null, frontpageGalleryItem: null, eventSegment: null, eventSongList: null, setlistPlan: null });
        expect(JSON.stringify(result)).not.toMatch(/Score.pdf|Sound check|Main set|Summer plan/);
        for (const publicId of [refs.file.publicId, refs.gallery.publicId, refs.segment.publicId, refs.setlist.publicId, refs.event.publicId, refs.plan.publicId]) {
            expect(JSON.stringify(result)).not.toContain(publicId);
        }
    }));

    it.each(["hidden", "private", "deleted"])("withholds a %s gallery even when its File is readable", mode => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await tx.frontpageGalleryItem.update({ where: { id: refs.gallery.id }, data: mode === "hidden" ? { visiblePermissionId: refs.report.hiddenPermission.id }
            : mode === "private" ? { visiblePermissionId: null } : { isDeleted: true } });
        await refs.report.add(refs.actionFields);
        expect((await read(refs)).rows[0]).toMatchObject({ file: { publicId: refs.file.publicId }, frontpageGalleryItem: null });
    }));

    it("redacts hard-deleted references, deleted attendance and hidden instruments and groups", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await refs.report.add(refs.actionFields);
        await tx.eventSegment.delete({ where: { id: refs.segment.id } });
        await tx.eventSongList.delete({ where: { id: refs.setlist.id } });
        await tx.songCreditType.delete({ where: { id: refs.creditType.id } });
        await tx.eventAttendance.update({ where: { id: refs.attendance.id }, data: { isDeleted: true } });
        await tx.bandInstrument.update({ where: { id: refs.instrument.id }, data: { isHidden: true } });
        expect((await read(refs)).rows[0]).toMatchObject({ eventSegment: null, eventSongList: null, songCreditType: null, attendance: null, instrument: null });
        await tx.bandInstrument.update({ where: { id: refs.instrument.id }, data: { isHidden: false } });
        await tx.bandInstrumentFunctionalGroup.update({ where: { id: refs.bandGroup.id }, data: { isHidden: true } });
        expect((await read(refs)).rows[0]!.instrument).toBeNull();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_instruments } });
        const grant = await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: refs.report.role.id, permissionId: permission.id } });
        expect((await read(refs)).rows[0]!.instrument).toMatchObject({ publicId: refs.instrument.publicId, name: "Trompette globale" });
        await tx.bandRolePermission.delete({ where: { id: grant.id } });
        expect((await read(refs)).rows[0]!.instrument).toBeNull();
    }));

    const deniedFields = [
        ["file", xFile, "fileLeafName"], ["frontpageGalleryItem", xFrontpageGalleryItem, "fileId"],
        ["eventSegment", xEventSegment, "name"], ["eventSongList", xEventSongList, "name"], ["setlistPlan", xSetlistPlan, "name"],
        ["attendance", xEventAttendance, "buttonCaption"], ["songCreditType", xSongCreditType, "name"], ["instrument", xBandInstrument, "name"],
    ] as const;
    it.each(deniedFields)("withholds the whole %s reference when its field is denied", (reference, entity, field) => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await refs.report.add(refs.actionFields);
        const authorize = entity.authorizeColumnForView;
        vi.spyOn(entity, "authorizeColumnForView").mockImplementation(args => args.columnName !== field && authorize(args));
        const result = await read(refs);
        expect(result.rows[0]![reference]).toBeNull();
        expect(result.metrics.totalRowCount).toBe(1);
    }));

    it("refreshes independent File/Event/plan grants, including parent references, before each read", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await refs.report.add(refs.actionFields);
        expect((await read(refs)).rows[0]!.file).not.toBeNull();
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_files, Permission.view_events_nonpublic, Permission.setlist_planner_access] } } });
        // Public-role grants are additive, so revocation must remove both sources of File access.
        const grants = await tx.bandRolePermission.findMany({ where: { OR: [{ bandRoleId: refs.report.role.id }, { bandRole: { isPublicRole: true } }],
            permissionId: { in: permissions.map(permission => permission.id) } } });
        await tx.bandRolePermission.deleteMany({ where: { id: { in: grants.map(grant => grant.id) } } });
        expect((await read(refs)).rows[0]).toMatchObject({ file: null, frontpageGalleryItem: null, eventSegment: null, eventSongList: null, setlistPlan: null });
        await tx.bandRolePermission.createMany({ data: grants });
        expect((await read(refs)).rows[0]).toMatchObject({ file: { publicId: refs.file.publicId }, frontpageGalleryItem: { publicId: refs.gallery.publicId },
            eventSegment: { publicId: refs.segment.publicId }, eventSongList: { publicId: refs.setlist.publicId }, setlistPlan: { publicId: refs.plan.publicId } });
    }));

    it("keeps inactive attendance options identifiable and requires a still-active report membership", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        await tx.eventAttendance.update({ where: { id: refs.attendance.id }, data: { isActive: false } });
        await refs.report.add(refs.actionFields);
        expect((await read(refs)).rows[0]!.attendance).toMatchObject({ publicId: refs.attendance.publicId, buttonCaption: "Présent" });
        await tx.bandUser.update({ where: { id: refs.report.member.id }, data: { isDeleted: true } });
        await expect(read(refs)).rejects.toThrow();
    }));

    it("uses the selected band for instrument identity and localized overrides and keeps the global catalog shared", () => withFixture(async (tx, fixture) => {
        const refs = await prepareActivityDetailReferences(tx, fixture);
        const band = fixture.bands[1]!;
        await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: refs.report.role.id } });
        const name = await refs.text("Second trumpet", "Deuxième trompette");
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: name.id } });
        const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id, functionalGroupId: group.id, nameId: name.id } });
        await refs.report.add({ ...refs.actionFields, bandId: band.id, bandInstrumentId: instrument.id });
        await refs.report.add({ bandInstrumentId: instrument.id });
        expect((await read(refs)).rows[0]!.instrument).toBeNull();
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
        const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const result = await readActivityDetails(snapshot, auth, { ...refs.report.input, bandPublicId: parsePublicId<"Band">(band.publicId), detail: { facet: "total" } });
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]).toMatchObject({ instrument: { publicId: instrument.publicId, name: "Deuxième trompette" }, file: null, eventSegment: null,
            eventSongList: null, frontpageGalleryItem: null, setlistPlan: null, attendance: { publicId: refs.attendance.publicId }, songCreditType: { publicId: refs.creditType.publicId } });
        expect(JSON.stringify(result)).not.toContain(refs.instrument.publicId);
    }));
});
