import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType as Type } from "shared/quickFilter";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { getQuickSearchResults } from "src/core/db3/server/quickSearchServerCore";
import { QuickSearchResultsSchema, shellSearchItemTypes, type QuickSearchInput } from "src/core/db3/shared/quickSearchTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const membership = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const song = async (name: string, bandId = band.id, visiblePermissionId: number | null = visibility.id) => tx.song.create({ data: {
        publicId: generatePublicId(), bandId, name, aliases: "navigation", description: "", introducedYear: 2026,
        createdByUserId: fixture.admin.id, visiblePermissionId,
    } });
    const event = async (name: string, bandId = band.id, visiblePermissionId: number | null = visibility.id) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId, name, revision: 1, locationDescription: "Navigation harbour",
        startsAt: new Date("2026-10-24T22:00:00Z"), createdByUserId: fixture.admin.id, visiblePermissionId,
    } });
    const page = async (slug: string, bandId = band.id, visiblePermissionId: number | null = visibility.id) => {
        const row = await tx.wikiPage.create({ data: {
            publicId: generatePublicId(), bandId, slug, namespace: slug.includes("/") ? slug.split("/")[0] : null,
            createdByUserId: fixture.admin.id, visiblePermissionId,
        } });
        const revision = await tx.wikiPageRevision.create({ data: {
            publicId: generatePublicId(), wikiPageId: row.id, name: "Compass", content: "Current navigation notes",
        } });
        return tx.wikiPage.update({ where: { id: row.id }, data: { currentRevisionId: revision.id } });
    };
    const strings = async (english: string, french: string, dutch: string) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
            { publicId: generatePublicId(), localeId: fixture.dutchId, indexedValue: dutch },
        ] },
    } });
    const name = await strings("Compass", "Boussole", "Kompas");
    const description = await strings("Navigation instrument", "Instrument de navigation", "Navigatie instrument");
    const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: band.id } });
    const foreignGroup = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
    const globalGroup = await tx.globalInstrumentFunctionalGroup.create({ data: {
        publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, sortOrder: 0,
    } });
    const source = await tx.globalInstrument.create({ data: { publicId: generatePublicId(), nameId: name.id,
        descriptionId: description.id, functionalGroupId: globalGroup.id, sortOrder: 0 } });
    const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id,
        globalInstrumentId: source.id, functionalGroupId: group.id } });
    const foreignInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id,
        globalInstrumentId: source.id, functionalGroupId: foreignGroup.id } });
    const hiddenInstrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: band.id,
        nameId: name.id, isHidden: true, functionalGroupId: group.id } });
    const visibleSong = await song("Compass");
    const visibleEvent = await event("Compass");
    const visiblePage = await page("compass-guide");
    const descriptionPage = await page("EventDescription/" + visibleEvent.publicId);
    await tx.event.update({ where: { id: visibleEvent.id }, data: { descriptionWikiPageId: descriptionPage.id } });
    const privateSong = await song("Compass private", band.id, null);
    const privateEvent = await event("Compass private", band.id, null);
    const privatePage = await page("compass-private", band.id, null);
    const deletedSong = await song("Compass deleted");
    const deletedEvent = await event("Compass deleted");
    await tx.song.update({ where: { id: deletedSong.id }, data: { isDeleted: true } });
    await tx.event.update({ where: { id: deletedEvent.id }, data: { isDeleted: true } });
    const foreignSong = await song("Compass foreign", fixture.bands[1]!.id);
    const foreignEvent = await event("Compass foreign", fixture.bands[1]!.id);
    const foreignPage = await page("compass-foreign", fixture.bands[1]!.id);
    const search = async (keyword: string, patch: Partial<QuickSearchInput> = {}, authorization: CMServerAuthorization = auth) => {
        const input: QuickSearchInput = { bandPublicId, keyword, allowedItemTypes: [...shellSearchItemTypes], permissionPolicy: "omitUnavailable", routeLocale: "en-US", ...patch };
        return getQuickSearchResults(input, authorization, await bindDB3ReadSnapshot(tx, authorization, { isolationLevel: "Serializable" }));
    };
    return { band, bandPublicId, auth, membership, visibility, search, song, event, page, strings, name, description, group,
        instrument, foreignInstrument, hiddenInstrument, visibleSong, visibleEvent, visiblePage, descriptionPage,
        privateSong, privateEvent, privatePage, deletedSong, deletedEvent, foreignSong, foreignEvent, foreignPage };
}

describe.skipIf(!settingsMysqlTestUrl)("restored global shell search on MariaDB", () => {
    const database = settingsMysqlTestUrl ? new PrismaClient({ datasourceUrl: settingsMysqlTestUrl }) : null;
    beforeAll(() => {
        vi.stubEnv("CMDB_BASE_URL", "https://shell.test.invalid");
        return database ? initializeAccessControl(database) : undefined;
    }, 30_000);
    afterAll(() => {
        vi.unstubAllEnvs();
        return database?.$disconnect();
    });
    function run(work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) {
        if (!database) {
            throw new Error("Native search tests require their disposable database.");
        }
        return withSettingsMysqlFixture(database, work);
    }

    it("combines four domains with reference strengths, public links and selected-band privacy", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const results = await c.search("Compass");
        expect(results).toHaveLength(4);
        expect(results.map(result => result.itemType).sort()).toEqual([...shellSearchItemTypes].sort());
        expect(results.map(result => result.matchStrength)).toEqual([...results.map(result => result.matchStrength)].sort((a, b) => b - a));
        expect(QuickSearchResultsSchema.parse(results)).toEqual(results);
        expect(JSON.stringify(results)).not.toMatch(/"(?:bandId|createdByUserId|currentRevisionId|descriptionWikiPageId)":/);
        for (const result of results) {
            const url = new URL(result.absoluteUri!);
            expect(url.searchParams.get("bandPublicId")).toBe(c.bandPublicId);
            expect(url.searchParams.get("routeLocale")).toBe("en-US");
        }
        expect(results.find(result => result.itemType === Type.event)!.name).toContain("10/25/2026");
    }));

    it.each([["e", Type.event], ["event", Type.event], ["s", Type.song], ["song", Type.song],
        ["i", Type.instrument], ["instrument", Type.instrument], ["w", Type.wikiPage], ["wikiPage", Type.wikiPage]] as const)(
        "retains the %s type prefix", (prefix, type) => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            expect((await c.search(prefix + ":Compass")).map(result => result.itemType)).toEqual([type]);
        }),
    );

    it("retains authored aliases, locations, current content, empty queries and the A1 tag exception", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        expect((await c.search("navigation")).map(result => result.itemType).sort()).toEqual([...shellSearchItemTypes].sort());
        expect((await c.search("harbour")).map(result => result.itemType)).toEqual([Type.event]);
        expect((await c.search("current navigation")).map(result => result.itemType).sort()).toEqual([Type.event, Type.wikiPage]);
        expect(await c.search("#Compass")).toEqual([]);
        expect((await c.search("song:Compass #ignored")).map(result => result.id)).toEqual([c.visibleSong.publicId]);
        expect(await c.search("unknown:Compass")).toEqual([]);
        expect(await c.search("   ")).toEqual([]);
        expect((await c.search(c.visibleSong.publicId)).map(result => result.id)).toEqual([c.visibleSong.publicId]);
        expect(await c.search("Compass", { allowedItemTypes: [Type.event, Type.song] })).toHaveLength(2);
    }));

    it("keeps the 100 candidates per plugin and 15 results with deterministic cross-domain ties", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.song.createMany({ data: Array.from({ length: 101 }, (_, index) => ({
            // The strongest match comes after the candidate limit and must not displace earlier candidates.
            publicId: `LimitSong${String(index).padStart(7, "0")}`, bandId: c.band.id,
            name: index === 100 ? "Repeated" : "Repeated phrase", aliases: "", description: "",
            visiblePermissionId: c.visibility.id, createdByUserId: fixture.user.id,
        })) });
        const results = await c.search("Repeated", { allowedItemTypes: [Type.song] });
        expect(results).toHaveLength(15);
        expect(results.map(result => result.id)).toEqual(Array.from({ length: 15 }, (_, index) => `LimitSong${String(index).padStart(7, "0")}`));
        expect(await c.search("Compass")).toEqual(await c.search("Compass"));
    }));

    it("resolves instrument inheritance, band-first overrides, blanks and ordered preferences in independent bands", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const types = { allowedItemTypes: [Type.instrument] };
        expect((await c.search("Boussole", { ...types, routeLocale: "fr-BE" })).map(result => result.name)).toEqual(["Boussole"]);
        await tx.bandDynamicLocalizedStringValue.create({ data: {
            publicId: generatePublicId(), bandId: c.band.id, stringId: c.name.id, localeId: fixture.englishId, indexedValue: "Local Compass",
        } });
        expect((await c.search("Local Compass", { ...types, routeLocale: "fr-BE" })).map(result => result.name)).toEqual(["Local Compass"]);
        await tx.bandDynamicLocalizedStringValue.updateMany({ where: { bandId: c.band.id, stringId: c.name.id }, data: { indexedValue: "" } });
        expect(await c.search("Boussole", { ...types, routeLocale: "fr-BE" })).toEqual([]);
        const otherBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        const platform = await loadAuthorizationForUser(fixture.admin, tx, otherBand);
        const second = await c.search("Kompas", { ...types, bandPublicId: otherBand, routeLocale: null, browserLanguages: ["nl-BE", "fr-BE"] }, platform);
        expect(second.map(result => result.id)).toEqual([c.foreignInstrument.publicId]);
        expect(second[0]!.name).toBe("Kompas");
        expect(await c.search("Boussole", { ...types, bandPublicId: otherBand, routeLocale: null, browserLanguages: ["nl-BE", "fr-BE"] }, platform)).toEqual([]);
    }));

    it("does not match private, foreign or incorrectly owned Wiki revisions through Event descriptions or titles", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const token = "onlysecret";
        await tx.wikiPageRevision.updateMany({ where: { wikiPageId: c.privatePage.id }, data: { name: token, content: token } });
        await tx.event.update({ where: { id: c.visibleEvent.id }, data: { descriptionWikiPageId: c.privatePage.id } });
        expect(await c.search(token)).toEqual([]);
        await tx.wikiPageRevision.updateMany({ where: { wikiPageId: c.foreignPage.id }, data: { name: token, content: token } });
        await tx.wikiPage.update({ where: { id: c.foreignPage.id }, data: { currentRevisionId: null } });
        await tx.wikiPage.update({ where: { id: c.visiblePage.id }, data: { currentRevisionId: c.foreignPage.currentRevisionId } });
        expect(await c.search(token)).toEqual([]);
        const other = await c.page("other-visible");
        const wrongRevision = await tx.wikiPageRevision.create({ data: { publicId: generatePublicId(), wikiPageId: other.id, name: token, content: token } });
        await tx.wikiPage.update({ where: { id: c.descriptionPage.id }, data: { currentRevisionId: wrongRevision.id } });
        await tx.event.update({ where: { id: c.visibleEvent.id }, data: { descriptionWikiPageId: c.descriptionPage.id } });
        expect(await c.search(token)).toEqual([]);
        expect((await c.search("compass-guide"))[0]!.name).toBe("compass-guide");
    }));

    it("keeps band-calendar date matching at exclusive DST day boundaries", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const before = await c.event("Previous day");
        const after = await c.event("Next day");
        await tx.event.update({ where: { id: before.id }, data: { startsAt: new Date("2026-10-24T21:59:59.999Z") } });
        await tx.event.update({ where: { id: after.id }, data: { startsAt: new Date("2026-10-25T23:00:00Z") } });
        expect((await c.search("e:2026-10-25")).map(result => result.id)).toEqual([c.visibleEvent.publicId]);
        expect((await c.search("e:2026-10")).map(result => result.id).sort()).toEqual([before.publicId, after.publicId, c.visibleEvent.publicId].sort());
    }));

    it("omits freshly revoked domains while retaining other plugins and independent Wiki visibility", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permissions = await tx.permission.findMany({ where: { name: { in: [Permission.view_songs, Permission.search_wiki_pages] } } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.membership.bandRoleId!, permissionId: { in: permissions.map(permission => permission.id) } } });
        const result = await c.search("Compass");
        expect(result.map(match => match.itemType).sort()).toEqual([Type.event, Type.instrument]);
        await tx.permission.update({ where: { name: Permission.view_wiki_pages }, data: { isDeleted: true } });
        expect(await c.search("current navigation")).toEqual([]);
        await expect(c.search("Compass", { allowedItemTypes: [Type.song], permissionPolicy: "requireAll" })).rejects.toThrow();
        await expect(c.search("Compass", { permissionPolicy: "requireAll" })).rejects.toThrow();
    }));

    it.each(["anonymous", "unscoped", "outsider", "inactive", "deleted", "merged", "band", "mismatch"])(
        "rejects %s authority from a stale snapshot", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            let auth = c.auth;
            if (kind === "anonymous" || kind === "unscoped") {
                auth = await loadAuthorizationForUser(kind === "anonymous" ? null : fixture.user, tx, kind === "unscoped" ? null : c.bandPublicId);
            } else if (kind === "outsider") {
                const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outside", email: "outside@search.invalid" } });
                auth = await loadAuthorizationForUser(outsider, tx, c.bandPublicId);
            } else if (kind === "inactive") {
                await tx.bandUser.update({ where: { id: c.membership.id }, data: { isDeleted: true } });
            } else if (kind === "deleted" || kind === "merged") {
                await tx.user.update({ where: { id: fixture.user.id }, data: kind === "deleted" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
            } else if (kind === "band") {
                await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
            }
            const patch = kind === "mismatch" ? { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) } : {};
            if (kind === "outsider" || kind === "inactive") {
                // Logged-in accounts retain public catalog reads; membership content remains unavailable.
                expect((await c.search("Compass", patch, auth)).map(result => result.itemType)).toEqual([Type.instrument]);
            } else {
                await expect(c.search("Compass", patch, auth)).rejects.toThrow();
            }
        }),
    );
});
