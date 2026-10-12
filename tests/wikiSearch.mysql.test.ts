import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { wikiPageSearchView } from "src/core/db3/db3";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { GetSearchResultsCore } from "src/core/db3/server/searchServerCore";
import { DiscreteCriterionFilterType as Behavior, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const membership = await tx.bandUser.findFirstOrThrow({ where: { userId: fixture.user.id, bandId: band.id } });
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const text = (english: string, french: string, dutch: string) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
            { publicId: generatePublicId(), localeId: fixture.dutchId, indexedValue: dutch },
        ] },
    } });
    const name = await text("Guide", "Documentation", "Handleiding");
    const description = await text("Guide description", "Description du guide", "Beschrijving");
    const globalTag = await tx.globalWikiPageTag.create({ data: {
        publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, color: "green", sortOrder: 7,
    } });
    // Public-ID order opposes catalog order so accidental identity sorting always fails.
    const firstTag = await tx.bandWikiPageTag.create({ data: { publicId: "A" + generatePublicId().slice(1), bandId: band.id, globalWikiPageTagId: globalTag.id } });
    const localName = await text("Practice", "Repetition", "Repetitie");
    const secondTag = await tx.bandWikiPageTag.create({ data: { publicId: "z" + generatePublicId().slice(1), bandId: band.id, nameId: localName.id, sortOrder: 2 } });
    const hiddenTag = await tx.bandWikiPageTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: localName.id, isHidden: true } });
    const foreignTag = await tx.bandWikiPageTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, globalWikiPageTagId: globalTag.id } });
    const page = async (slug: string, bandId = band.id, visiblePermissionId: number | null = visibility.id) => {
        const created = await tx.wikiPage.create({ data: {
            publicId: generatePublicId(), bandId, slug, namespace: slug.includes("/") ? slug.split("/")[0] : null,
            createdByUserId: fixture.admin.id, visiblePermissionId, createdAt: new Date("2026-10-10T12:00:00Z"),
        } });
        const revision = await tx.wikiPageRevision.create({ data: {
            publicId: generatePublicId(), wikiPageId: created.id, name: "Current title", content: `Authored ${slug} ensemble safety`,
        } });
        return tx.wikiPage.update({ where: { id: created.id }, data: { currentRevisionId: revision.id } });
    };
    const pages = await Promise.all(["alpha-handbook", "music/repertoire", "notes", "EventDescription/example"].map(slug => page(slug)));
    for (const [index, row] of pages.entries()) {
        const tags = index === 0 ? [firstTag] : index === 1 ? [firstTag, secondTag] : index === 2 ? [hiddenTag] : [];
        await tx.wikiPageTagAssignment.createMany({ data: tags.map(tag => ({ publicId: generatePublicId(), wikiPageId: row.id, bandWikiPageTagId: tag.id })) });
    }
    const foreign = await page("foreign-secret", fixture.bands[1]!.id);
    const privatePage = await page("private-secret", band.id, null);
    const query = (patch: Partial<GetSearchResultsInput> = {}): GetSearchResultsInput => ({
        tableID: wikiPageSearchView.tableID, viewID: wikiPageSearchView.viewID, bandPublicId,
        offset: 0, take: 20, quickFilter: "", sort: [{ db3Column: "slug", direction: "asc" }],
        discreteCriteria: [
            { db3Column: "tags", behavior: Behavior.alwaysMatch, options: [] },
            { db3Column: "namespace", behavior: Behavior.alwaysMatch, options: [] },
        ], ...patch,
    });
    const search = async (patch: Partial<GetSearchResultsInput> = {}) => GetSearchResultsCore(query(patch), auth,
        await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    return { band, bandPublicId, auth, membership, visibility, name, firstTag, secondTag, hiddenTag, foreignTag, pages, foreign, privatePage, page, query, search };
}

describe.skipIf(!settingsMysqlTestUrl)("restored Wiki search on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("matches inherited Wiki tags using ordered preferences and suppresses overridden or hidden text", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const names = async (quickFilter: string, browserLanguages = ["de-DE", "fr-FR", "nl-NL"]) =>
            (await c.search({ quickFilter, browserLanguages })).results.map(row => row.slug);
        expect(await names("Documentation")).toEqual(["alpha-handbook", "music/repertoire"]);
        expect(await names("Guide")).toEqual([]);
        expect(await names("Handleiding", ["de-DE", "nl-NL", "fr-FR"])).toEqual(["alpha-handbook", "music/repertoire"]);
        expect(await names("Documentation", ["de-DE", "nl-NL", "fr-FR"])).toEqual([]);
        expect(await names("music Documentation")).toEqual(["music/repertoire"]);
        const override = await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(),
            bandId: c.band.id, stringId: c.name.id, localeId: fixture.englishId, indexedValue: "Bandfirstneedle" } });
        expect(await names("Bandfirstneedle")).toEqual(["alpha-handbook", "music/repertoire"]);
        expect(await names("Documentation")).toEqual([]);
        await tx.bandDynamicLocalizedStringValue.update({ where: { id: override.id }, data: { indexedValue: "" } });
        expect(await names("Bandfirstneedle")).toEqual([]);
        expect(await names("Guide")).toEqual([]);
        await tx.bandDynamicLocalizedStringValue.delete({ where: { id: override.id } });
        await tx.bandWikiPageTag.update({ where: { id: c.firstTag.id }, data: { isHidden: true } });
        expect(await names("Documentation")).toEqual([]);
        expect(await names("alpha-handbook")).toEqual(["alpha-handbook"]);
    }));

    it("keeps public rows/counts and localized inherited facets in one band snapshot", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.search({ routeLocale: "fr-BE" });
        expect(result.rowCount).toBe(4);
        expect(result.results.map(row => row.publicId).sort()).toEqual(c.pages.map(row => row.publicId).sort());
        expect(result.facets.find(facet => facet.db3Column === "tags")!.items).toEqual([
            expect.objectContaining({ id: null, rowCount: 2 }),
            expect.objectContaining({ id: c.secondTag.publicId, label: "Repetition", rowCount: 1 }),
            expect.objectContaining({ id: c.firstTag.publicId, label: "Documentation", tooltip: "Description du guide", color: "green", rowCount: 2 }),
        ]);
        const notes = wikiPageSearchView.parseDto(result.results.find(row => row.publicId === c.pages[2]!.publicId));
        expect(notes.tags).toEqual([]);
        expect(JSON.stringify(result.results)).not.toMatch(/"(?:id|bandId|createdByUserId|currentRevisionId)":/);
        expect(result.filterQueryResult.sqlSelect).toBe("");
    }));

    it.each([
        [Behavior.alwaysMatch, 4], [Behavior.hasAny, 2], [Behavior.hasNone, 2],
        [Behavior.hasSomeOf, 2], [Behavior.hasAllOf, 1], [Behavior.doesntHaveAnyOf, 2], [Behavior.doesntHaveAllOf, 3],
    ] as const)("retains the %s tag operator and excluding-filter counts", (behavior, count) => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.search({ discreteCriteria: [{ db3Column: "tags", behavior,
            options: [parsePublicId<"WikiPageTag">(c.firstTag.publicId), parsePublicId<"WikiPageTag">(c.secondTag.publicId)] }] });
        expect(result.rowCount).toBe(count);
        expect(result.results).toHaveLength(count);
        expect(result.facets[0]!.items.find(item => item.id === c.firstTag.publicId)!.rowCount).toBe(2);
    }));

    it("retains namespace exclusion, empty namespaces, combined filters and stable paging/sorts", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const ordinary = [{ db3Column: "namespace", behavior: Behavior.doesntHaveAnyOf, options: ["EventDescription"] }];
        expect((await c.search({ discreteCriteria: ordinary })).rowCount).toBe(3);
        expect((await c.search({ discreteCriteria: [{ db3Column: "namespace", behavior: Behavior.hasNone, options: [] }] })).rowCount).toBe(2);
        expect((await c.search({ discreteCriteria: [{ db3Column: "tags", behavior: Behavior.hasAllOf, options: [c.firstTag.publicId] },
            { db3Column: "namespace", behavior: Behavior.hasSomeOf, options: ["music"] }] })).rowCount).toBe(1);
        const first = await c.search({ take: 2 });
        const second = await c.search({ offset: 2, take: 2 });
        expect([...first.results, ...second.results].map(row => row.slug)).toEqual(["alpha-handbook", "EventDescription/example", "music/repertoire", "notes"]);
        for (const db3Column of ["createdAt", "namespace"]) {
            const sorted = await c.search({ sort: [{ db3Column, direction: "desc" }] });
            expect(sorted.rowCount).toBe(4);
            expect(new Set(sorted.results.map(row => row.publicId)).size).toBe(4);
        }
    }));

    it("searches authored slug/current content and localized tags without history authority", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const history = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_wiki_page_revisions } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.membership.bandRoleId!, permissionId: history.id } });
        expect((await c.search({ quickFilter: "ensemble safety" })).rowCount).toBe(4);
        expect((await c.search({ quickFilter: "repertoire" })).results.map(row => row.publicId)).toEqual([c.pages[1]!.publicId]);
        expect((await c.search({ quickFilter: "Documentation", routeLocale: "fr-BE" })).rowCount).toBe(2);
        expect((await c.search({ quickFilter: "secret" })).rowCount).toBe(0);
        expect((await c.search({ quickFilter: "x' OR true --" })).rowCount).toBe(0);
    }));

    it("never probes another page's content through a malformed current-revision pointer", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.wikiPage.update({ where: { id: c.privatePage.id }, data: { currentRevisionId: null } });
        await tx.wikiPage.update({ where: { id: c.pages[0]!.id }, data: { currentRevisionId: c.privatePage.currentRevisionId } });
        expect((await c.search({ quickFilter: "private-secret" })).rowCount).toBe(0);
    }));

    it("keeps intentional band blanks and ordered preferences, independently of another band's override", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
            stringId: c.name.id, localeId: fixture.frenchId, indexedValue: "" } });
        const result = await c.search({ routeLocale: "fr-BE", browserLanguages: ["nl-BE"] });
        expect(result.facets[0]!.items.find(item => item.id === c.firstTag.publicId)!.label).toBe("");
        // Band scope wins even when a different global language matches the browser first.
        expect((await c.search({ browserLanguages: ["nl-BE"] })).facets[0]!.items.find(item => item.id === c.firstTag.publicId)!.label).toBe("");
        await tx.bandDynamicLocalizedStringValue.deleteMany({ where: { bandId: c.band.id, stringId: c.name.id } });
        const dutch = await c.search({ browserLanguages: ["nl-BE", "en-US"] });
        expect(dutch.facets[0]!.items.find(item => item.id === c.firstTag.publicId)!.label).toBe("Handleiding");
        const english = await c.search({ browserLanguages: ["en-US", "nl-BE"] });
        expect(english.facets[0]!.items.find(item => item.id === c.firstTag.publicId)!.label).toBe("Guide");
        const otherId = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, otherId);
        const other = await GetSearchResultsCore(c.query({ bandPublicId: otherId, routeLocale: "fr-BE" }), platform,
            await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }));
        expect(other.results.map(row => row.publicId)).toEqual([c.foreign.publicId]);
        expect(other.facets[0]!.items.find(item => item.id === c.foreignTag.publicId)!.label).toBe("Documentation");
    }));

    it.each(["anonymous", "roleless", "outsider", "inactive", "deleted-person", "merged-person", "deleted-band", "revoked"] as const)(
        "applies %s authority using fresh snapshot grants", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            let auth = c.auth;
            if (kind === "anonymous") { auth = await loadAuthorizationForUser(null, tx, c.bandPublicId); }
            if (kind === "roleless") { auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId)); }
            if (kind === "outsider") { await tx.bandUser.delete({ where: { id: c.membership.id } }); }
            if (kind === "inactive") { await tx.bandUser.update({ where: { id: c.membership.id }, data: { isDeleted: true } }); }
            if (kind === "deleted-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } }); }
            if (kind === "merged-person") { await tx.user.update({ where: { id: fixture.user.id }, data: { mergedIntoUserId: fixture.admin.id } }); }
            if (kind === "deleted-band") { await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } }); }
            if (kind === "revoked") {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.membership.bandRoleId!, permissionId: permission.id } });
            }
            const query = c.query({ bandPublicId: parsePublicId<"Band">(auth.requireBand().publicId) });
            const read = async () => GetSearchResultsCore(query, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
            if (["roleless", "outsider", "inactive", "revoked"].includes(kind)) {
                // Wiki viewing belongs to the public role; member visibility still disappears immediately.
                const result = await read();
                expect(result.rowCount).toBe(0);
                expect(result.results).toEqual([]);
                expect(result.facets.every(facet => facet.items.every(item => item.rowCount === 0))).toBe(true);
            } else {
                await expect(read()).rejects.toThrow();
            }
        }));

    it.each(["hidden-tag", "foreign-tag", "wrong-view", "recovery", "unsupported-sort", "unsupported-criterion", "unscoped-platform", "foreign-context", "retired-read-permission"] as const)(
        "rejects %s without leaking content/counts", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            let input = c.query();
            let auth = c.auth;
            if (kind === "hidden-tag" || kind === "foreign-tag") {
                input = c.query({ discreteCriteria: [{ db3Column: "tags", behavior: Behavior.hasSomeOf,
                    options: [kind === "hidden-tag" ? c.hiddenTag.publicId : c.foreignTag.publicId] }] });
            }
            if (kind === "wrong-view") { input = c.query({ viewID: "WikiPage_Editor" }); }
            if (kind === "recovery") { input = c.query({ includeDeleted: true }); }
            if (kind === "unsupported-sort") { input = c.query({ sort: [{ db3Column: "contentVersion", direction: "asc" }] }); }
            if (kind === "unsupported-criterion") { input = c.query({ discreteCriteria: [{ db3Column: "slug", behavior: Behavior.hasSomeOf, options: ["notes"] }] }); }
            if (kind === "unscoped-platform") { auth = await loadAuthorizationForUser(fixture.admin, tx); }
            if (kind === "foreign-context") { auth = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId)); }
            if (kind === "retired-read-permission") { await tx.permission.update({ where: { name: Permission.view_wiki_pages }, data: { isDeleted: true } }); }
            const read = async () => GetSearchResultsCore(input, auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
            await expect(read()).rejects.toThrow();
        }));
});
