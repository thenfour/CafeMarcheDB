import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readActivityFacets } from "src/core/components/featureReports/server/facetProcessor";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import { activityFacetKeys, type ActivityFacetFilter, type FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_feature_reports, Permission.view_songs,
        Permission.view_events_nonpublic, Permission.view_wiki_pages, Permission.view_custom_links] } } });
    const role = await tx.bandRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId(),
        values: { create: { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Activity reader" } } } },
        bandRolePermissions: { create: permissions.map(permission => ({ publicId: generatePublicId(), permissionId: permission.id })) } } });
    const member = await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } }, data: { bandRoleId: role.id } });
    const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(band.publicId));
    const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
    const input: FacetedBreakdownInput = { bandPublicId: parsePublicId<"Band">(band.publicId), routeLocale: "fr-BE",
        startDate: new Date("2026-01-01T00:00:00Z"), endDateExclusive: new Date("2027-01-01T00:00:00Z"), selectedBucket: "all",
        filterSpec: { bucketSize: ActivityReportTimeBucketSize.all, excludeYourself: false, excludeSysadmins: false,
            includeFeatures: [], excludeFeatures: [], contextBeginsWith: null }, facetFilters: emptyActivityFacetFilters() };
    const add = (data: Partial<Prisma.ActionUncheckedCreateInput> = {}) => tx.action.create({ data: {
        bandId: band.id, isClient: true, feature: "facet-fixture", context: "fixture/report", createdAt: new Date("2026-04-01T00:00:00Z"), ...data,
    } });
    const read = (args = input) => readActivityFacets(snapshot, auth, args);
    const publicPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.public } });
    const hiddenPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.never_grant } });
    const song = (name: string, overrides: Partial<Prisma.SongUncheckedCreateInput> = {}) => tx.song.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, description: "", visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const event = (name: string, overrides: Partial<Prisma.EventUncheckedCreateInput> = {}) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, revision: 1, visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const wiki = (slug: string, overrides: Partial<Prisma.WikiPageUncheckedCreateInput> = {}) => tx.wikiPage.create({ data: {
        publicId: generatePublicId(), bandId: band.id, slug, visiblePermissionId: publicPermission.id, ...overrides,
    } });
    const menu = async (caption: string, translated: string, overrides: Partial<Prisma.MenuLinkUncheckedCreateInput> = {}) => {
        const text = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: caption },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: translated },
        ] } } });
        return tx.menuLink.create({ data: { publicId: generatePublicId(), bandId: band.id, captionId: text.id, groupName: "fixture",
            groupCssClass: "", itemCssClass: "", linkType: "external", visiblePermissionId: publicPermission.id, externalURI: "https://private.invalid", ...overrides } });
    };
    const custom = (name: string, overrides: Partial<Prisma.CustomLinkUncheckedCreateInput> = {}) => tx.customLink.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, description: "private", slug: generatePublicId(), redirectType: "Temporary", ...overrides,
    } });
    return { band, member, role, auth, snapshot, input, add, read, song, event, wiki, menu, custom, publicPermission, hiddenPermission };
}

describe.skipIf(!settingsMysqlTestUrl)("activity facets on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => initializeAccessControl(database!), 30_000);
    afterAll(() => database?.$disconnect());
    afterEach(() => { vi.restoreAllMocks(); });
    const withFixture = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database!, work);

    it("restores all sixteen groups with public references, localized captions and anonymous tokens", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const song = await report.song("Authored song");
        const event = await report.event("Authored event");
        const wiki = await report.wiki("authored-page");
        const menu = await report.menu("Menu caption", "Navigation française");
        const custom = await report.custom("Authored custom link");
        const dimensions = { songId: song.id, eventId: event.id, wikiPageId: wiki.id, menuLinkId: menu.id, customLinkId: custom.id,
            pointerType: "mouse", browserName: "chrome", deviceClass: "desktop", operatingSystem: "windows", language: "fr", locale: "fr-be",
            timezone: "Europe/Brussels", screenWidth: 1920, screenHeight: 1080, uri: "/private/user/42", queryText: "private search" };
        await report.add({ ...dimensions, userId: fixture.user.id });
        await report.add(dimensions);
        await report.add({ bandId: fixture.bands[1]!.id, feature: "foreign action" });
        await report.add({ bandId: null, feature: "unowned action" });
        const result = await report.read();
        expect(result.total.count).toBe(2);
        for (const key of activityFacetKeys) {
            expect(result.facets[key], key).toHaveLength(1);
        }
        expect(result.facets.menuLinks).toEqual([{ key: menu.publicId, label: "Navigation française", count: 2 }]);
        expect(result.facets.songs).toEqual([{ key: song.publicId, label: song.name, count: 2 }]);
        expect(result.facets.screenSizes).toEqual([{ key: "1920x1080", label: "1920 × 1080", count: 2 }]);
        expect(result.facets.users[0]).toMatchObject({ key: expect.stringMatching(/^[a-f0-9]{64}$/), count: 1 });
        expect(JSON.stringify(result)).not.toMatch(/userId|bandId|uri|queryText|private|foreign action|unowned action|email/);
    }));

    it("keeps report totals while redacting private, deleted and foreign-band references independently", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        for (const overrides of [{ visiblePermissionId: report.hiddenPermission.id }, { isDeleted: true }, { bandId: fixture.bands[1]!.id },
            { visiblePermissionId: null, createdByUserId: fixture.admin.id }]) {
            const song = await report.song("Secret song", overrides);
            const event = await report.event("Secret event", overrides);
            await report.add({ songId: song.id, eventId: event.id });
        }
        const wiki = await report.wiki("secret-wiki", { visiblePermissionId: report.hiddenPermission.id });
        const menu = await report.menu("Secret menu", "Secret navigation", { visiblePermissionId: report.hiddenPermission.id });
        const foreignCustom = await report.custom("Foreign custom", { bandId: fixture.bands[1]!.id });
        await report.add({ wikiPageId: wiki.id, menuLinkId: menu.id, customLinkId: foreignCustom.id });
        const result = await report.read();
        expect(result.total.count).toBe(5);
        expect(result.facets.songs).toEqual([]);
        expect(result.facets.events).toEqual([]);
        expect(result.facets.wikiPages).toEqual([]);
        expect(result.facets.menuLinks).toEqual([]);
        expect(result.facets.customLinks).toEqual([]);
        expect(JSON.stringify(result)).not.toMatch(/Secret|secret|Foreign/);
    }));

    it("preserves intentional blank translations and removes hard-deleted references", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const menu = await report.menu("English caption", "");
        const wiki = await report.wiki("deleted-page");
        const custom = await report.custom("Deleted link");
        await report.add({ menuLinkId: menu.id, wikiPageId: wiki.id, customLinkId: custom.id });
        await tx.wikiPage.delete({ where: { id: wiki.id } });
        await tx.customLink.delete({ where: { id: custom.id } });
        const result = await report.read();
        expect(result.facets.menuLinks).toEqual([{ key: menu.publicId, label: "", count: 1 }]);
        expect(result.facets.wikiPages).toEqual([]);
        expect(result.facets.customLinks).toEqual([]);
        expect(result.total.count).toBe(1);
    }));

    const dimensionCases: Array<{ field: keyof Pick<Prisma.ActionUncheckedCreateInput, "operatingSystem" | "pointerType" | "browserName" | "deviceClass" | "language" | "locale" | "timezone">;
        include: keyof ActivityFacetFilter; exclude: keyof ActivityFacetFilter }> = [
        { field: "operatingSystem", include: "includeOperatingSystems", exclude: "excludeOperatingSystems" },
        { field: "pointerType", include: "includePointerTypes", exclude: "excludePointerTypes" },
        { field: "browserName", include: "includeBrowserNames", exclude: "excludeBrowserNames" },
        { field: "deviceClass", include: "includeDeviceClasses", exclude: "excludeDeviceClasses" },
        { field: "language", include: "includeLanguages", exclude: "excludeLanguages" },
        { field: "locale", include: "includeLocales", exclude: "excludeLocales" },
        { field: "timezone", include: "includeTimezones", exclude: "excludeTimezones" },
    ];
    it.each(dimensionCases)("combines $field include/exclude filters and retains missing dimensions", ({ field, include, exclude }) => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add({ [field]: "keep" });
        await report.add({ [field]: "remove" });
        await report.add();
        const read = (filters: ActivityFacetFilter) => report.read({ ...report.input, facetFilters: filters });
        expect((await read({ ...report.input.facetFilters, [include]: ["keep", "remove"], [exclude]: ["remove"] })).total.count).toBe(1);
        expect((await read({ ...report.input.facetFilters, [exclude]: ["remove"] })).total.count).toBe(2);
        expect((await read({ ...report.input.facetFilters, [include]: ["missing"] })).total.count).toBe(0);
    }));

    it("matches feature precedence and literal contexts, including SQL metacharacters", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add({ feature: "keep", context: "a%_\\/child" });
        await report.add({ feature: "remove", context: "a%_\\/child" });
        await report.add({ feature: "keep", context: "anything/child" });
        await report.add({ feature: "' OR 1=1 --", context: "' OR 1=1 --" });
        const read = (filter: Partial<FacetedBreakdownInput["filterSpec"]>) => report.read({ ...report.input, filterSpec: { ...report.input.filterSpec, ...filter } });
        expect((await read({ includeFeatures: ["keep", "remove"], excludeFeatures: ["remove"], contextBeginsWith: "a%_\\" })).total.count).toBe(1);
        expect((await read({ includeFeatures: ["' OR 1=1 --"], contextBeginsWith: "' OR 1=1 --" })).total.count).toBe(1);
    }));

    it("filters every entity facet by authorized public identity without losing unreferenced activity", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const song = await report.song("Song");
        const event = await report.event("Event");
        const wiki = await report.wiki("page");
        const menu = await report.menu("Menu", "Menu FR");
        const custom = await report.custom("Link");
        await report.add({ songId: song.id, eventId: event.id, wikiPageId: wiki.id, menuLinkId: menu.id, customLinkId: custom.id });
        await report.add();
        const pairs = [
            { include: "includeSongIds", exclude: "excludeSongIds", id: song.publicId },
            { include: "includeEventIds", exclude: "excludeEventIds", id: event.publicId },
            { include: "includeWikiPageIds", exclude: "excludeWikiPageIds", id: wiki.publicId },
            { include: "includeMenuLinkIds", exclude: "excludeMenuLinkIds", id: menu.publicId },
            { include: "includeCustomLinkIds", exclude: "excludeCustomLinkIds", id: custom.publicId },
        ];
        for (const pair of pairs) {
            expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, [pair.include]: [pair.id] } })).total.count, pair.include).toBe(1);
            expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, [pair.exclude]: [pair.id] } })).total.count).toBe(1);
            expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, [pair.include]: [pair.id], [pair.exclude]: [pair.id] } })).total.count).toBe(0);
        }
    }));

    it("cannot probe hidden, foreign or missing reference counts through forged filters", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const visible = await report.song("Visible");
        const hidden = await report.song("Hidden", { visiblePermissionId: report.hiddenPermission.id });
        const foreign = await report.song("Foreign", { bandId: fixture.bands[1]!.id });
        for (const song of [visible, hidden, foreign]) {
            await report.add({ songId: song.id });
        }
        for (const publicId of [hidden.publicId, foreign.publicId, generatePublicId()]) {
            const id = parsePublicId<"Song">(publicId);
            expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, includeSongIds: [id] } })).total.count).toBe(0);
            expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, excludeSongIds: [id] } })).total.count).toBe(3);
        }
        expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters,
            includeSongIds: [parsePublicId<"Song">(visible.publicId), parsePublicId<"Song">(hidden.publicId)] } })).total.count).toBe(1);
    }));

    it("refreshes reference authority independently of report authority", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const song = await report.song("Authorized song");
        await report.add({ songId: song.id });
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: report.role.id, permissionId: permission.id } });
        const result = await report.read();
        expect(result.total.count).toBe(1);
        expect(result.facets.songs).toEqual([]);
        expect((await report.read({ ...report.input, facetFilters: { ...report.input.facetFilters, includeSongIds: [parsePublicId<"Song">(song.publicId)] } })).total.count).toBe(0);
    }));

    it("excludes shared people and both platform administrator policies while retaining anonymous actions", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        const flagged = await tx.user.create({ data: { publicId: generatePublicId(), name: "Flagged", email: "flagged@test.invalid", isSysAdmin: true } });
        const ordinary = await tx.user.create({ data: { publicId: generatePublicId(), name: "Ordinary", email: "ordinary@test.invalid" } });
        for (const userId of [null, fixture.user.id, fixture.admin.id, flagged.id, ordinary.id]) {
            await report.add({ userId });
        }
        const result = await report.read({ ...report.input, filterSpec: { ...report.input.filterSpec, excludeYourself: true, excludeSysadmins: true } });
        expect(result.total.count).toBe(2);
        expect(result.facets.users).toHaveLength(1);
        expect(result.facets.users[0]?.count).toBe(1);
    }));

    it("preserves timeline bucket meaning and exact boundaries in fresh band time zones", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: report.band.id, name: "dateTime.bandTimeZone", value: "Europe/Brussels" } });
        for (const timestamp of ["2026-10-25T00:00:00Z", "2026-10-25T00:59:59.999Z", "2026-10-25T01:00:00Z", "2026-10-25T02:00:00Z"]) {
            await report.add({ createdAt: new Date(timestamp) });
        }
        const filterSpec = { ...report.input.filterSpec, bucketSize: ActivityReportTimeBucketSize.hour };
        expect((await report.read({ ...report.input, filterSpec, selectedBucket: "2026-10-25 02:00:00" })).total.count).toBe(3);
        expect((await report.read({ ...report.input, filterSpec, selectedBucket: "2026-03-29 02:00:00" })).total.count).toBe(0);
        await tx.bandSetting.update({ where: { bandId_name: { bandId: report.band.id, name: "dateTime.bandTimeZone" } }, data: { value: "Asia/Tokyo" } });
        expect((await report.read({ ...report.input, filterSpec, selectedBucket: "2026-10-25 09:00:00" })).total.count).toBe(2);
    }));

    it.each(["grant", "permission", "membership", "role", "account", "merge", "band"] as const)("rejects fresh %s revocation before aggregating", kind => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add();
        if (kind === "grant" || kind === "permission") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_feature_reports } });
            if (kind === "grant") {
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: report.role.id, permissionId: permission.id } });
            } else {
                await tx.permission.update({ where: { id: permission.id }, data: { isDeleted: true } });
            }
        } else if (kind === "membership") {
            await tx.bandUser.update({ where: { id: report.member.id }, data: { isDeleted: true } });
        } else if (kind === "role") {
            await tx.bandRole.update({ where: { id: report.role.id }, data: { isDeleted: true } });
        } else if (kind === "account" || kind === "merge") {
            await tx.user.update({ where: { id: fixture.user.id }, data: kind === "merge" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        } else {
            await tx.band.update({ where: { id: report.band.id }, data: { isDeleted: true } });
        }
        const query = vi.spyOn(tx.action, "groupBy");
        await expect(report.read()).rejects.toThrow();
        expect(query).not.toHaveBeenCalled();
    }));

    it("isolates a shared person's two memberships, resets token scope and requires explicit platform band selection", () => withFixture(async (tx, fixture) => {
        const report = await prepare(tx, fixture);
        await report.add({ userId: fixture.user.id });
        await report.add({ bandId: fixture.bands[1]!.id, userId: fixture.user.id });
        await report.add({ bandId: fixture.bands[1]!.id });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: report.role.id } });
        const otherInput = { ...report.input, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) };
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, otherInput.bandPublicId);
        const otherSnapshot = await bindDB3ReadSnapshot(tx, otherAuth, { isolationLevel: "Serializable" });
        const first = await report.read();
        const second = await readActivityFacets(otherSnapshot, otherAuth, otherInput);
        expect(first.total.count).toBe(1);
        expect(second.total.count).toBe(2);
        expect(first.facets.users[0]?.key).not.toBe(second.facets.users[0]?.key);
        expect((await readActivityFacets(otherSnapshot, otherAuth, { ...otherInput, filterSpec: { ...otherInput.filterSpec, excludeYourself: true } })).total.count).toBe(1);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, report.input.bandPublicId);
        const platformSnapshot = await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" });
        expect((await readActivityFacets(platformSnapshot, platform, report.input)).total.count).toBe(1);
        for (const auth of [await loadAuthorizationForUser(fixture.admin, tx), await loadAuthorizationForUser(null, tx, report.input.bandPublicId), otherAuth]) {
            const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(readActivityFacets(context, auth, report.input)).rejects.toThrow();
        }
    }));
});
