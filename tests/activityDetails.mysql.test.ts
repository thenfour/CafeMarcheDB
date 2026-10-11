import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { initializeAccessControl } from "src/setup/accessControl";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityDetails } from "src/core/components/featureReports/server/activityDetails";
import type { ActivityDetailInput, ActivityDetailSelection } from "src/core/components/featureReports/activityReportTypes";
import { prepareActivityReport } from "./support/activityReportMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("activity details on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: Parameters<typeof withSettingsMysqlFixture>[1]) => withSettingsMysqlFixture(database!, work);
    const read = (report: Awaited<ReturnType<typeof prepareActivityReport>>, detail: ActivityDetailSelection = { facet: "total" }, overrides: Partial<ActivityDetailInput> = {}) =>
        readActivityDetails(report.snapshot, report.auth, { ...report.input, detail, ...overrides });

    it("preserves the newest 200 rows with an exact total and a stable timestamp tie-break", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await tx.action.createMany({ data: Array.from({ length: 205 }, (_, index) => ({ bandId: report.band.id, isClient: true,
            feature: `action-${index}`, createdAt: new Date("2026-04-01"), context: "fixture/report" })) });
        await report.add({ bandId: fixture.bands[1]!.id, feature: "foreign" });
        await report.add({ bandId: null, feature: "unowned" });
        const result = await read(report);
        expect(result.metrics.totalRowCount).toBe(205);
        expect(result.rowLimit).toBe(200);
        expect(result.rows.map(row => row.feature)).toEqual(Array.from({ length: 200 }, (_, index) => `action-${204 - index}`));
        expect(new Set(result.rows.map(row => row.rowKey)).size).toBe(200);
        expect(result.rows.every(row => row.userHash === null)).toBe(true);
    }));

    it("shares authorized localized references and person tokens with aggregate and per-item projections", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const song = await report.song("Visible song");
        const event = await report.event("Visible event", { startsAt: new Date("2026-04-01T17:00:00Z") });
        const wiki = await report.wiki("visible-page");
        const menu = await report.menu("English caption", "Navigation française");
        const custom = await report.custom("Visible custom link");
        await report.add({ userId: fixture.user.id, songId: song.id, eventId: event.id, wikiPageId: wiki.id, menuLinkId: menu.id, customLinkId: custom.id,
            context: `App/profile/${(await tx.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).publicId}/PrivateName`,
            uri: "/backstage/user/867/PrivateName?email=private@example.invalid", queryText: "PrivateName search" });
        await report.add({ context: "App/profile/867/AnotherPrivateName" });
        const facets = await report.read(), ledger = await read(report);
        expect(facets.facets.contexts).toEqual([{ key: "App/profile/", label: "App/profile/", count: 2 }]);
        expect(ledger.rows.find(row => row.userHash !== null)).toMatchObject({ userHash: facets.facets.users[0]!.key,
            song: { publicId: song.publicId, name: song.name }, event: { publicId: event.publicId, startsAt: event.startsAt },
            wikiPage: { publicId: wiki.publicId, slug: wiki.slug }, menuLink: { publicId: menu.publicId, caption: "Navigation française" },
            customLink: { publicId: custom.publicId, name: custom.name } });
        const detail = await read(report, { facet: "songs", key: parsePublicId<"Song">(song.publicId) });
        expect(detail.metrics.totalRowCount).toBe(1);
        expect(detail.rows[0]!.userHash).toBe(facets.facets.users[0]!.key);
        expect(detail.rows[0]!.rowKey).toBe(ledger.rows.find(row => row.userHash !== null)!.rowKey);
        expect((await read(report, { facet: "contexts", key: "App/profile/" })).metrics.totalRowCount).toBe(2);
        expect(ledger.rows.every(row => row.uri === null && row.queryText === null)).toBe(true);
        expect(JSON.stringify([facets, ledger, detail])).not.toMatch(/PrivateName|\/profile\/867|userId|bandId|email|private@example/);
    }));

    it.each(["hidden", "private", "deleted", "foreign"])("redacts %s references without losing ledger actions or revealing them through a forged drill-down", mode => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const overrides = mode === "hidden" ? { visiblePermissionId: report.hiddenPermission.id }
            : mode === "private" ? { visiblePermissionId: null, createdByUserId: fixture.admin.id }
                : mode === "deleted" ? { isDeleted: true } : { bandId: fixture.bands[1]!.id };
        const song = await report.song("Private song", overrides), event = await report.event("Private event", overrides);
        await report.add({ songId: song.id, eventId: event.id });
        const result = await read(report);
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]).toMatchObject({ song: null, event: null });
        expect(JSON.stringify(result)).not.toMatch(/Private song|Private event/);
        expect((await read(report, { facet: "songs", key: parsePublicId<"Song">(song.publicId) })).metrics.totalRowCount).toBe(0);
        expect((await read(report, { facet: "events", key: parsePublicId<"Event">(event.publicId) })).metrics.totalRowCount).toBe(0);
    }));

    it("redacts hidden wiki/menu and foreign custom references and honors every public reference drill-down", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const wiki = await report.wiki("private-page", { visiblePermissionId: report.hiddenPermission.id });
        const menu = await report.menu("Private menu", "Private caption", { visiblePermissionId: report.hiddenPermission.id });
        const custom = await report.custom("Foreign custom", { bandId: fixture.bands[1]!.id });
        await report.add({ wikiPageId: wiki.id, menuLinkId: menu.id, customLinkId: custom.id });
        const result = await read(report);
        expect(result.rows[0]).toMatchObject({ wikiPage: null, menuLink: null, customLink: null });
        const selections: ActivityDetailSelection[] = [{ facet: "wikiPages", key: parsePublicId<"WikiPage">(wiki.publicId) },
            { facet: "menuLinks", key: parsePublicId<"MenuLink">(menu.publicId) }, { facet: "customLinks", key: parsePublicId<"CustomLink">(custom.publicId) }];
        for (const detail of selections) {
            expect((await read(report, detail)).metrics.totalRowCount).toBe(0);
        }
    }));

    it("preserves blank menu translations and drops hard-deleted references", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const menu = await report.menu("English caption", ""), wiki = await report.wiki("deleted-page"), custom = await report.custom("Deleted custom");
        await report.add({ menuLinkId: menu.id, wikiPageId: wiki.id, customLinkId: custom.id });
        await tx.wikiPage.delete({ where: { id: wiki.id } });
        await tx.customLink.delete({ where: { id: custom.id } });
        expect((await read(report)).rows[0]).toMatchObject({ menuLink: { caption: "", publicId: menu.publicId }, wikiPage: null, customLink: null });
    }));

    it.each([
        ["operatingSystems", "operatingSystem"], ["pointerTypes", "pointerType"], ["browsers", "browserName"],
        ["deviceClasses", "deviceClass"], ["languages", "language"], ["locales", "locale"], ["timezones", "timezone"],
    ] as const)("narrows %s while retaining the existing selected-bucket filters", (facet, field) => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add({ [field]: "keep", feature: "included" });
        await report.add({ [field]: "remove", feature: "included" });
        await report.add({ [field]: "keep", feature: "excluded" });
        await report.add();
        const result = await read(report, { facet, key: "keep" }, { filterSpec: { ...report.input.filterSpec, includeFeatures: ["included"], excludeFeatures: ["excluded"] } });
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]!.feature).toBe("included");
    }));

    it("intersects reference and scalar includes/exclusions rather than replacing them with drill-down filters", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const first = await report.song("First"), second = await report.song("Second");
        await report.add({ songId: first.id, browserName: "chrome" });
        await report.add({ songId: first.id, browserName: "firefox" });
        await report.add({ songId: second.id, browserName: "chrome" });
        const facetFilters = { ...report.input.facetFilters, includeSongIds: [parsePublicId<"Song">(first.publicId)], excludeBrowserNames: ["firefox"] };
        expect((await read(report, { facet: "browsers", key: "chrome" }, { facetFilters })).metrics.totalRowCount).toBe(1);
        expect((await read(report, { facet: "songs", key: parsePublicId<"Song">(second.publicId) }, { facetFilters })).metrics.totalRowCount).toBe(0);
        expect((await read(report, { facet: "songs", key: parsePublicId<"Song">(first.publicId) }, { facetFilters })).metrics.totalRowCount).toBe(1);
    }));

    it("retains literal SQL metacharacters in feature/context drill-downs", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add({ feature: "' OR 1=1 --", context: "a%_\\/child" });
        await report.add({ feature: "other", context: "anything/child" });
        expect((await read(report, { facet: "contexts", key: "a%_\\" })).metrics.totalRowCount).toBe(1);
        expect((await read(report, { facet: "features", key: "' OR 1=1 --" })).metrics.totalRowCount).toBe(1);
    }));

    it("keeps anonymous authors while excluding the shared person and both kinds of platform administrator", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const flagged = await tx.user.create({ data: { publicId: "FlaggedAdmin0001", name: "Flagged", email: "flagged@fixture.invalid", isSysAdmin: true } });
        await report.add({ userId: fixture.user.id });
        await report.add({ userId: fixture.admin.id });
        await report.add({ userId: flagged.id });
        await report.add();
        const result = await read(report, { facet: "total" }, { filterSpec: { ...report.input.filterSpec, excludeYourself: true, excludeSysadmins: true } });
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]!.userHash).toBeNull();
    }));

    it("checks report revocation before any Action query and permits a freshly restored grant", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add();
        expect((await read(report)).rows).toHaveLength(1);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_feature_reports } });
        const grant = await tx.bandRolePermission.findUniqueOrThrow({ where: { bandRoleId_permissionId: { bandRoleId: report.role.id, permissionId: permission.id } } });
        await tx.bandRolePermission.delete({ where: { id: grant.id } });
        await expect(read(report)).rejects.toThrow();
        await tx.bandRolePermission.create({ data: grant });
        expect((await read(report)).rows).toHaveLength(1);
        await tx.bandRolePermission.delete({ where: { id: grant.id } });
        // Prisma's proxy cannot restore a spied delegate for another read. Keep this probe last.
        const actions = vi.spyOn(tx.action, "groupBy");
        await expect(read(report)).rejects.toThrow();
        expect(actions).not.toHaveBeenCalled();
    }));

    it("refreshes reference grants independently of the report grant", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        const song = await report.song("Visible song");
        await report.add({ songId: song.id });
        expect((await read(report)).rows[0]!.song).not.toBeNull();
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: report.role.id, permissionId: permission.id } });
        const result = await read(report);
        expect(result.metrics.totalRowCount).toBe(1);
        expect(result.rows[0]!.song).toBeNull();
        expect((await read(report, { facet: "songs", key: parsePublicId<"Song">(song.publicId) })).metrics.totalRowCount).toBe(0);
    }));

    it("requires a selected band for platform readers and rejects anonymous, roleless and mismatched contexts", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add();
        const input: ActivityDetailInput = { ...report.input, detail: { facet: "total" } };
        const platform = await loadAuthorizationForUser(fixture.admin, tx, input.bandPublicId);
        const snapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
        expect((await readActivityDetails(snapshot, platform, input)).rows).toHaveLength(1);
        for (const auth of [await loadAuthorizationForUser(null, tx, input.bandPublicId), await loadAuthorizationForUser(fixture.admin, tx),
            await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId))]) {
            const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(readActivityDetails(context, auth, input)).rejects.toThrow();
        }
        await expect(read(report, { facet: "total" }, { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) })).rejects.toThrow();
    }));

    it("scopes shared-person tokens to each band and honors self exclusion in either membership", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add({ userId: fixture.user.id });
        await report.add({ bandId: fixture.bands[1]!.id, userId: fixture.user.id });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: report.role.id } });
        const first = await read(report);
        const secondBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const auth = await loadAuthorizationForUser(fixture.user, tx, secondBand);
        const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const input: ActivityDetailInput = { ...report.input, bandPublicId: secondBand, detail: { facet: "total" } };
        const second = await readActivityDetails(snapshot, auth, input);
        expect(first.rows).toHaveLength(1);
        expect(second.rows).toHaveLength(1);
        expect(second.rows[0]!.userHash).not.toBe(first.rows[0]!.userHash);
        expect((await read(report, { facet: "total" }, { filterSpec: { ...report.input.filterSpec, excludeYourself: true } })).rows).toEqual([]);
        expect((await readActivityDetails(snapshot, auth, { ...input, filterSpec: { ...input.filterSpec, excludeYourself: true } })).rows).toEqual([]);
    }));

    it("clips to half-open dates and includes both repeated hours, but no skipped hour", () => withFixture(async (tx, fixture) => {
        const report = await prepareActivityReport(tx, fixture);
        await report.add({ createdAt: new Date("2026-10-25T00:15:00Z") });
        await report.add({ createdAt: new Date("2026-10-25T01:15:00Z") });
        await report.add({ createdAt: new Date("2026-10-25T02:00:00Z") });
        const filterSpec = { ...report.input.filterSpec, bucketSize: ActivityReportTimeBucketSize.hour };
        expect((await read(report, { facet: "total" }, { selectedBucket: "2026-10-25 02:00:00", filterSpec })).metrics.totalRowCount).toBe(2);
        expect((await read(report, { facet: "total" }, { selectedBucket: "2026-03-29 02:00:00", filterSpec })).metrics.totalRowCount).toBe(0);
        expect((await read(report, { facet: "total" }, { startDate: new Date("2026-10-25T01:15:00Z"), endDateExclusive: new Date("2026-10-25T02:00:00Z") })).metrics.totalRowCount).toBe(1);
    }));
});
