import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityDetails, readGeneralActivityDetails } from "src/core/components/featureReports/server/activityDetails";
import { readActivityCsv } from "src/core/components/featureReports/server/activityCsv";
import { prepareActivityReport } from "./support/activityReportMysqlFixture";
import { prepareActivityDetailReferences } from "./support/activityDetailReferenceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { activityCsvRecord, parseActivityCsv } from "./support/activityExportFixture";

async function revokeReportPermission(tx: Prisma.TransactionClient, report: Awaited<ReturnType<typeof prepareActivityReport>>, name: Permission) {
    const permission = await tx.permission.findUniqueOrThrow({ where: { name } });
    const publicRoles = await tx.bandRole.findMany({ where: { isPublicRole: true }, select: { id: true } });
    const where = { permissionId: permission.id, bandRoleId: { in: [report.role.id, ...publicRoles.map(role => role.id)] } };
    const grants = await tx.bandRolePermission.findMany({ where });
    await tx.bandRolePermission.deleteMany({ where });
    return () => tx.bandRolePermission.createMany({ data: grants });
}

describe.skipIf(!settingsMysqlTestUrl)("activity metadata and export on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    const withFixture = (work: Parameters<typeof withSettingsMysqlFixture>[1]) => withSettingsMysqlFixture(database!, work);

    it("shares all authorized public references, localized labels, scoped tokens and safe metadata across all three row readers", () => withFixture(async (tx, fixture) => {
        const auxiliary = await prepareActivityDetailReferences(tx, fixture), { report } = auxiliary;
        const song = await report.song("Chanson été"), wiki = await report.wiki("help/été"), menu = await report.menu("Navigation", "Navigation française"), custom = await report.custom("Visible link");
        await report.add({ ...auxiliary.actionFields, songId: song.id, eventId: auxiliary.event.id, wikiPageId: wiki.id, menuLinkId: menu.id,
            customLinkId: custom.id, feature: "link_follow_internal", context: "App/association", userId: fixture.user.id, queryText: "été",
            uri: `/backstage/song/${song.id}/PrivateName?email=private@example.invalid&token=secret#private` });
        const ledger = await readActivityDetails(report.snapshot, report.auth, { ...report.input, detail: { facet: "total" } });
        const general = await readGeneralActivityDetails(report.snapshot, report.auth, report.input);
        const csv = await readActivityCsv(report.snapshot, report.auth, report.input);
        expect(general.data).toEqual(ledger.rows);
        const row = general.data[0]!;
        expect(row).toMatchObject({ queryText: "été", attendance: { buttonCaption: "Présent" }, songCreditType: { name: "Compositeur" }, instrument: { name: "Trompette globale" } });
        expect(row.uri).toBe(`/backstage/song/${song.publicId}?bandPublicId=${report.band.publicId}&routeLocale=fr-BE`);
        const record = activityCsvRecord(parseActivityCsv(csv.csvContent), 0);
        expect(record.get("id")).toBe(row.rowKey);
        expect(record.get("userHash")).toBe(row.userHash);
        expect(record.get("uri")).toBe(row.uri);
        expect(record.get("queryText")).toBe("été");
        for (const [header, value] of [
            ["songId", song.publicId], ["eventId", auxiliary.event.publicId], ["fileId", auxiliary.file.publicId], ["wikiPageId", wiki.publicId],
            ["menuLinkId", menu.publicId], ["customLinkId", custom.publicId], ["attendanceId", auxiliary.attendance.publicId],
            ["instrumentId", auxiliary.instrument.publicId], ["eventSegmentId", auxiliary.segment.publicId], ["eventSongListId", auxiliary.setlist.publicId],
            ["frontpageGalleryItemId", auxiliary.gallery.publicId], ["setlistPlanId", auxiliary.plan.publicId], ["songCreditTypeId", auxiliary.creditType.publicId],
            ["menuLinkCaption", "Navigation française"], ["attendanceCaption", "Présent"], ["songCreditTypeName", "Compositeur"],
        ]) {
            expect(record.get(header!)).toBe(value);
        }
        expect(JSON.stringify([general, csv])).not.toMatch(/PrivateName|private@example|token=secret|secret-storage|private-download|uploadedByUserId|createdByUserId|"userId"|"bandId"/);
    }));

    it("retains the original ledger/general/export caps and newest-first ordering with an exact total", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        for (let offset = 0; offset < 20003; offset += 1000) {
            await tx.action.createMany({ data: Array.from({ length: Math.min(1000, 20003 - offset) }, (_, index) => ({ bandId: report.band.id,
                isClient: true, feature: `action-${offset + index}`, createdAt: new Date("2026-04-01") })) });
        }
        const ledger = await readActivityDetails(report.snapshot, report.auth, { ...report.input, detail: { facet: "total" } });
        const general = await readGeneralActivityDetails(report.snapshot, report.auth, report.input);
        const csv = await readActivityCsv(report.snapshot, report.auth, report.input);
        expect(ledger.rows).toHaveLength(200);
        expect(general.data).toHaveLength(1000);
        expect(general.data[999]!.feature).toBe("action-19003");
        expect(general.rowLimit).toBe(1000);
        expect(csv.rowLimit).toBe(20000);
        expect(csv.rowCount).toBe(20000);
        expect(csv.metrics.totalRowCount).toBe(20003);
        expect(general.metrics.totalRowCount).toBe(20003);
        const records = parseActivityCsv(csv.csvContent);
        expect(records).toHaveLength(20001);
        expect(activityCsvRecord(records, 0).get("feature")).toBe("action-20002");
        expect(activityCsvRecord(records, 19999).get("feature")).toBe("action-3");
        expect(activityCsvRecord(records, 0).get("id")).toBe(ledger.rows[0]!.rowKey);
        expect(general.data[0]!.rowKey).toBe(ledger.rows[0]!.rowKey);
        expect(csv.filename).toMatch(new RegExp(`^activity-export-${report.band.publicId}-all-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.csv$`));
    }), 60_000);

    it.each(["hidden", "private", "deleted", "foreign"])("withholds %s reference labels and saved metadata while retaining the action", mode => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const overrides = mode === "hidden" ? { visiblePermissionId: report.hiddenPermission.id }
            : mode === "private" ? { visiblePermissionId: null, createdByUserId: fixture.admin.id }
                : mode === "deleted" ? { isDeleted: true } : { bandId: fixture.bands[1]!.id };
        const song = await report.song("PrivateName", overrides);
        await report.add({ songId: song.id, feature: "link_follow_internal", context: "App/association", queryText: "PrivateName", uri: `/backstage/song/${song.id}/PrivateName` });
        const general = await readGeneralActivityDetails(report.snapshot, report.auth, report.input);
        const csv = await readActivityCsv(report.snapshot, report.auth, report.input);
        expect(general.data).toHaveLength(1);
        expect(general.data[0]).toMatchObject({ song: null, uri: null, queryText: null });
        expect(csv.rowCount).toBe(1);
        expect(JSON.stringify([general, csv])).not.toContain("PrivateName");
        const forged = { ...report.input, facetFilters: { ...report.input.facetFilters, includeSongIds: [parsePublicId<"Song">(song.publicId)] } };
        expect((await readGeneralActivityDetails(report.snapshot, report.auth, forged)).data).toEqual([]);
        expect((await readActivityCsv(report.snapshot, report.auth, forged)).rowCount).toBe(0);
    }));

    it("refreshes entity grants before exposing saved routes, query fragments and CSV columns, then permits restoration", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture), song = await report.song("Visible song");
        await report.add({ songId: song.id, feature: "link_follow_internal", context: "App/association", queryText: "song", uri: `/backstage/song/${song.id}` });
        expect((await readActivityCsv(report.snapshot, report.auth, report.input)).csvContent).toContain("Visible song");
        const restore = await revokeReportPermission(tx, report, Permission.view_songs);
        expect((await readGeneralActivityDetails(report.snapshot, report.auth, report.input)).data[0]).toMatchObject({ song: null, uri: null, queryText: null });
        const denied = await readActivityCsv(report.snapshot, report.auth, report.input);
        expect(denied.rowCount).toBe(1);
        expect(denied.csvContent).not.toContain("Visible song");
        expect(activityCsvRecord(parseActivityCsv(denied.csvContent), 0).get("songId")).toBe("");
        await restore();
        expect((await readGeneralActivityDetails(report.snapshot, report.auth, report.input)).data[0]!.queryText).toBe("song");
        expect((await readActivityCsv(report.snapshot, report.auth, report.input)).csvContent).toContain("Visible song");
    }));

    it("rejects freshly revoked report authority and deactivated membership before returning either reader's data", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add();
        const restore = await revokeReportPermission(tx, report, Permission.view_feature_reports);
        await expect(readGeneralActivityDetails(report.snapshot, report.auth, report.input)).rejects.toThrow();
        await expect(readActivityCsv(report.snapshot, report.auth, report.input)).rejects.toThrow();
        await restore();
        expect((await readActivityCsv(report.snapshot, report.auth, report.input)).rowCount).toBe(1);
        await tx.bandUser.update({ where: { id: report.member.id }, data: { isDeleted: true } });
        await expect(readGeneralActivityDetails(report.snapshot, report.auth, report.input)).rejects.toThrow();
        await expect(readActivityCsv(report.snapshot, report.auth, report.input)).rejects.toThrow();
    }));

    it("intersects selected bucket, literal contexts, features, device and reference filters in both readers", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture), song = await report.song("Visible song");
        await report.add({ songId: song.id, feature: "song_view", context: "App/a%_\\/leaf", browserName: "chrome", createdAt: new Date("2026-04-01T10:00:00Z") });
        await report.add({ songId: song.id, feature: "song_view", context: "App/another/leaf", browserName: "chrome", createdAt: new Date("2026-04-01T10:00:00Z") });
        await report.add({ songId: song.id, feature: "song_view", context: "App/a%_\\/leaf", browserName: "firefox", createdAt: new Date("2026-04-01T10:00:00Z") });
        await report.add({ songId: song.id, feature: "song_view", context: "App/a%_\\/leaf", browserName: "chrome", createdAt: new Date("2026-04-02T10:00:00Z") });
        const input = { ...report.input, selectedBucket: "2026-04-01", filterSpec: { ...report.input.filterSpec, bucketSize: ActivityReportTimeBucketSize.day,
            contextBeginsWith: "App/a%_\\/", includeFeatures: ["song_view"] }, facetFilters: { ...report.input.facetFilters, includeBrowserNames: ["chrome"], includeSongIds: [parsePublicId<"Song">(song.publicId)] } };
        expect((await readGeneralActivityDetails(report.snapshot, report.auth, input)).data).toHaveLength(1);
        expect((await readActivityCsv(report.snapshot, report.auth, input)).rowCount).toBe(1);
    }));

    it("uses the selected band's authority, references and tokens for a shared person and excludes foreign/unowned actions", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture), firstSong = await report.song("First band song"), band = fixture.bands[1]!;
        await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: report.role.id } });
        const secondSong = await report.song("Second band song", { bandId: band.id });
        await report.add({ userId: fixture.user.id, songId: firstSong.id });
        await report.add({ bandId: band.id, userId: fixture.user.id, songId: secondSong.id, feature: "link_follow_internal", context: "App/association",
            uri: `/backstage/song/${secondSong.id}?bandPublicId=${report.band.publicId}`, queryText: "Second" });
        await report.add({ bandId: band.id, songId: firstSong.id, feature: "foreign-reference", uri: `/backstage/song/${firstSong.id}/First-band-song`, queryText: "First" });
        await report.add({ bandId: null, feature: "unowned" });
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
        const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const input = { ...report.input, bandPublicId: parsePublicId<"Band">(band.publicId), routeLocale: "nl-BE" };
        const first = await readGeneralActivityDetails(report.snapshot, report.auth, report.input), second = await readGeneralActivityDetails(snapshot, auth, input);
        const csv = await readActivityCsv(snapshot, auth, input);
        expect(second.data).toHaveLength(2);
        const own = second.data.find(row => row.song !== null)!;
        expect(own).toMatchObject({ song: { publicId: secondSong.publicId }, queryText: "Second" });
        expect(own.uri).toBe(`/backstage/song/${secondSong.publicId}?bandPublicId=${band.publicId}&routeLocale=nl-BE`);
        expect(own.userHash).not.toBe(first.data[0]!.userHash);
        expect(csv.rowCount).toBe(2);
        expect(csv.csvContent).not.toMatch(/First band song|unowned/);
        expect(csv.filename).toContain(band.publicId);
        expect((await readActivityCsv(snapshot, auth, { ...input, filterSpec: { ...input.filterSpec, excludeYourself: true } })).rowCount).toBe(1);
    }));

    it("retains platform authority and both sysadmin exclusion policies without disclosing people", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await tx.user.update({ where: { id: fixture.admin.id }, data: { isSysAdmin: false } });
        await report.add({ userId: fixture.admin.id, feature: "platform-role" });
        const legacy = await tx.user.create({ data: { publicId: "LegacyAdmin0001", name: "Private admin", email: "admin@private.invalid", isSysAdmin: true } });
        await report.add({ userId: legacy.id, feature: "platform-flag" });
        await report.add({ feature: "anonymous" });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, report.input.bandPublicId);
        const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        expect((await readGeneralActivityDetails(snapshot, auth, report.input)).data).toHaveLength(3);
        const input = { ...report.input, filterSpec: { ...report.input.filterSpec, excludeSysadmins: true } };
        expect((await readGeneralActivityDetails(snapshot, auth, input)).data.map(row => row.feature)).toEqual(["anonymous"]);
        expect((await readActivityCsv(snapshot, auth, input)).rowCount).toBe(1);
    }));
});
