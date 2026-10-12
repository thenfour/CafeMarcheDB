import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { getCalendarWindow } from "shared/dateTimePolicy";
import { createAllDayRange } from "shared/time";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { GetSearchResultsCore, searchViewPage } from "src/core/db3/server/searchServerCore";
import { eventEditorView, eventRelevanceView } from "src/core/db3/shared/entities/event/eventViews";
import { gEventRelevanceClass } from "src/core/db3/shared/eventRelevance";
import { DiscreteCriterionFilterType as Behavior, type GetSearchResultsInput } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function seedSearch(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const otherBand = fixture.bands[1]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: band.id, userId: fixture.user.id } } });
    await tx.bandUser.update({ where: { bandId_userId: { bandId: otherBand.id, userId: fixture.user.id } }, data: { bandRoleId: member.bandRoleId } });
    const auth = await loadAuthorizationForUser(fixture.user, tx, bandPublicId);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const text = (english: string, french: string) => tx.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: english },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: french },
        ] },
    } });
    const name = await text("Concert", "Concert français");
    const description = await text("Type description", "Description française");
    const type = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, significance: "Concert", color: "blue" } });
    const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, significance: "FinalConfirmation" } });
    const globalTag = await tx.globalEventTag.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id, color: "green", sortOrder: 7 } });
    const firstTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: band.id, globalEventTagId: globalTag.id } });
    const secondName = await text("March", "Marche");
    const secondTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: secondName.id, sortOrder: 2 } });
    const foreignTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: otherBand.id, globalEventTagId: globalTag.id } });
    const hiddenTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: secondName.id, isHidden: true } });
    const events: Array<{ id: number; publicId: string }> = [];
    for (let index = 0; index < 4; index++) {
        events.push(await tx.event.create({ data: {
            publicId: generatePublicId(), bandId: band.id, name: ["Alpha", "Bravo", "Charlie", "Delta"][index]!,
            revision: 1, visiblePermissionId: visibility.id, createdByUserId: fixture.user.id,
            typeId: index === 3 ? null : type.id, statusId: index === 3 ? null : status.id,
            startsAt: new Date("2026-10-10T10:00:00Z"), durationMillis: BigInt(3600000), isAllDay: false,
            locationDescription: index === 0 ? "Town square" : "Hall",
            tags: { create: (index === 0 ? [firstTag] : index === 1 ? [secondTag] : index === 2 ? [firstTag, secondTag] : [hiddenTag]).map(tag => ({ publicId: generatePublicId(), bandEventTagId: tag.id })) },
        } }));
    }
    const foreign = await tx.event.create({ data: { publicId: generatePublicId(), bandId: otherBand.id, name: "Foreign secret", revision: 1, visiblePermissionId: visibility.id, createdByUserId: fixture.user.id, startsAt: new Date("2088-01-01T00:00:00Z") } });
    await tx.event.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Private secret", revision: 1, createdByUserId: fixture.admin.id, startsAt: new Date("2087-01-01T00:00:00Z") } });
    await tx.event.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Deleted secret", revision: 1, isDeleted: true, visiblePermissionId: visibility.id, startsAt: new Date("2086-01-01T00:00:00Z") } });
    const query = (patch: Partial<GetSearchResultsInput> = {}) => ({
        tableID: "Event", viewID: "Event_Search", bandPublicId, offset: 0, take: 20,
        quickFilter: "", sort: [{ db3Column: "name", direction: "asc" as const }],
        discreteCriteria: ["startsAt", "type", "status", "tags"].map(db3Column => ({ db3Column, options: [], behavior: Behavior.alwaysMatch })),
        ...patch,
    });
    const read = async (patch: Partial<GetSearchResultsInput> = {}) => GetSearchResultsCore(query(patch), auth,
        await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }));
    return { auth, member, query, read, events, type, status, firstTag, secondTag, foreignTag, hiddenTag, foreign, text, globalTag };
}

describe.skipIf(!settingsMysqlTestUrl)("existing event search on migrated MariaDB data", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it.each(["type", "status", "tag"] as const)("matches effective Event %s names before counting and paging", kind => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const c = await seedSearch(tx, fixture);
        const name = await c.text("Globalneedle", "Sérénade");
        if (kind === "type") {
            await tx.eventType.update({ where: { id: c.type.id }, data: { nameId: name.id } });
        } else if (kind === "status") {
            await tx.eventStatus.update({ where: { id: c.status.id }, data: { nameId: name.id } });
        } else {
            await tx.globalEventTag.update({ where: { id: c.globalTag.id }, data: { nameId: name.id } });
        }
        const expected = kind === "tag" ? ["Alpha", "Charlie"] : ["Alpha", "Bravo", "Charlie"];
        const input = { quickFilter: "serenade", browserLanguages: ["de-DE", "fr-FR"] };
        const first = await c.read({ ...input, take: 1 });
        const second = await c.read({ ...input, offset: 1, take: 1 });
        expect(first.rowCount).toBe(expected.length);
        expect(first.facets.find(facet => facet.db3Column === "tags")!.items.find(item => item.id === null)?.rowCount).toBe(0);
        expect([first.results[0]!.name, second.results[0]!.name]).toEqual(expected.slice(0, 2));
        expect((await c.read({ ...input, quickFilter: "Alpha serenade" })).results.map(row => row.name)).toEqual(["Alpha"]);
        expect((await c.read({ ...input, quickFilter: "Globalneedle" })).rowCount).toBe(0);
        const override = await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(),
            bandId: fixture.bands[0]!.id, stringId: name.id, localeId: fixture.englishId, indexedValue: "Bandfirstneedle" } });
        expect((await c.read({ ...input, quickFilter: "Bandfirstneedle" })).rowCount).toBe(expected.length);
        expect((await c.read(input)).rowCount).toBe(0);
        await tx.bandDynamicLocalizedStringValue.update({ where: { id: override.id }, data: { indexedValue: "" } });
        expect((await c.read({ ...input, quickFilter: "Bandfirstneedle" })).rowCount).toBe(0);
        await tx.bandDynamicLocalizedStringValue.delete({ where: { id: override.id } });
        if (kind === "type") {
            await tx.eventType.update({ where: { id: c.type.id }, data: { isDeleted: true } });
        } else if (kind === "status") {
            await tx.eventStatus.update({ where: { id: c.status.id }, data: { isDeleted: true } });
        } else {
            await tx.bandEventTag.update({ where: { id: c.firstTag.id }, data: { isHidden: true } });
        }
        expect((await c.read(input)).rowCount).toBe(0);
        expect((await c.read({ quickFilter: "Alpha" })).rowCount).toBe(1);
    }));

    it("keeps rows, counts, catalog facets and date years in the authorized band", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const result = await seed.read();
        expect(result.results.map(row => row.name)).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);
        expect(result.rowCount).toBe(4);
        expect(result.facets.find(facet => facet.db3Column === "startsAt")?.items.map(item => item.id)).not.toEqual(expect.arrayContaining([2086, 2087, 2088]));
        const tags = result.facets.find(facet => facet.db3Column === "tags")!.items;
        expect(tags).toEqual([
            expect.objectContaining({ id: null, rowCount: 1 }),
            expect.objectContaining({ id: seed.secondTag.publicId, label: "March", rowCount: 2 }),
            expect.objectContaining({ id: seed.firstTag.publicId, label: "Concert", rowCount: 2, color: "green" }),
        ]);
        expect(result.results[3]!.tags).toEqual([]);
        expect(JSON.stringify(result.results)).not.toMatch(/"(?:id|bandId|userId|email|phone|nameId)":/);
        const otherAuth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        const other = await GetSearchResultsCore(seed.query({ bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) }), otherAuth,
            await bindDB3ReadSnapshot(tx, otherAuth, { isolationLevel: "Serializable" }));
        expect(other.results.map(row => row.publicId)).toEqual([seed.foreign.publicId]);
        expect(other.facets.find(facet => facet.db3Column === "tags")!.items.map(item => item.id)).not.toContain(seed.firstTag.publicId);
    }));

    it("composes relevance with ordinary search filters, facets, counts and paging", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const now = new Date("2026-10-10T12:00:00Z");
        const mode: GetSearchResultsInput["mode"] = { kind: "eventRelevance", now, endedOnOrAfter: new Date("2026-10-09T12:00:00Z") };
        await tx.event.update({ where: { id: seed.events[0]!.id }, data: {
            startsAt: new Date("2026-09-01T12:00:00Z"), endDateTime: new Date("2026-09-01T13:00:00Z"),
            relevanceClassOverride: gEventRelevanceClass.Pinned,
        } });
        await tx.event.update({ where: { id: seed.events[1]!.id }, data: {
            startsAt: new Date("2026-10-10T13:00:00Z"), endDateTime: new Date("2026-10-10T14:00:00Z"),
        } });
        const cancelled = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: seed.type.nameId,
            descriptionId: seed.type.descriptionId, significance: "Cancelled", isDeleted: true } });
        await tx.event.update({ where: { id: seed.events[2]!.id }, data: { statusId: cancelled.id, endDateTime: now } });
        await tx.event.update({ where: { id: seed.events[3]!.id }, data: { relevanceClassOverride: gEventRelevanceClass.Hidden } });
        const first = await seed.read({ mode, sort: [], take: 1 });
        const second = await seed.read({ mode, sort: [], take: 1, offset: 1 });
        expect(first.results.map(event => event.name)).toEqual(["Alpha"]);
        expect(second.results.map(event => event.name)).toEqual(["Bravo"]);
        expect(first.rowCount).toBe(2);
        expect(second.rowCount).toBe(2);
        expect(first.facets).toEqual(second.facets);
        expect(first.facets.find(facet => facet.db3Column === "tags")!.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: seed.firstTag.publicId, rowCount: 1 }),
            expect.objectContaining({ id: seed.secondTag.publicId, rowCount: 1 }),
        ]));
        const filtered = await seed.read({ mode, sort: [], quickFilter: "Bravo", discreteCriteria: [
            { db3Column: "tags", behavior: Behavior.hasSomeOf, options: [seed.secondTag.publicId] },
        ] });
        expect(filtered.results.map(event => event.publicId)).toEqual([seed.events[1]!.publicId]);
        expect(filtered.rowCount).toBe(1);
    }));

    it("restricts modes and page views to their registered domain and refreshes page-reader authority", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const context = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
        const pageInput = { bandPublicId: seed.query().bandPublicId, offset: 0, take: 20, sort: [], quickFilter: "", discreteCriteria: [],
            mode: { kind: "eventRelevance" as const, now: new Date("2026-10-10T12:00:00Z"), endedOnOrAfter: new Date("2026-10-09T12:00:00Z") } };
        await expect(searchViewPage({ ...pageInput, view: eventEditorView }, seed.auth, context)).rejects.toThrow("Unsupported search view");
        await expect(GetSearchResultsCore({ ...pageInput, tableID: "Song", viewID: "Song_Search" }, seed.auth, context)).rejects.toThrow("Unsupported search mode");
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_nonpublic } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: seed.member.bandRoleId!, permissionId: grant.id } });
        await expect(searchViewPage({ ...pageInput, view: eventRelevanceView }, seed.auth, context)).rejects.toMatchObject({ statusCode: 403 });
    }));

    it.each([
        [Behavior.hasSomeOf, [0], ["Alpha", "Charlie"]],
        [Behavior.hasAllOf, [0, 1], ["Charlie"]],
        [Behavior.doesntHaveAnyOf, [0], ["Bravo", "Delta"]],
        [Behavior.doesntHaveAllOf, [0, 1], ["Alpha", "Bravo", "Delta"]],
        [Behavior.hasAny, [], ["Alpha", "Bravo", "Charlie"]],
        [Behavior.hasNone, [], ["Delta"]],
        [Behavior.alwaysMatch, [], ["Alpha", "Bravo", "Charlie", "Delta"]],
    ] as const)("preserves tag operator %s", (behavior, indexes, names) => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const options = indexes.map(index => [seed.firstTag, seed.secondTag][index]!.publicId);
        const result = await seed.read({ discreteCriteria: [{ db3Column: "tags", behavior, options }] });
        expect(result.results.map(row => row.name)).toEqual(names);
        expect(result.rowCount).toBe(names.length);
        expect(result.facets[0]!.items.find(item => item.id === seed.firstTag.publicId)?.rowCount).toBe(2);
    }));

    it("combines authored text, type, status and date filters without searching catalog labels", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const result = await seed.read({ quickFilter: "square", discreteCriteria: [
            { db3Column: "type", behavior: Behavior.hasSomeOf, options: [seed.type.publicId] },
            { db3Column: "status", behavior: Behavior.doesntHaveAnyOf, options: [] },
            { db3Column: "startsAt", behavior: Behavior.hasAllOf, options: [2026] },
        ] });
        expect(result.results.map(row => row.name)).toEqual(["Alpha"]);
        expect(result.filterQueryResult.errors).toHaveLength(1);
        expect((await seed.read({ quickFilter: "Concert français" })).rowCount).toBe(0);
        expect((await seed.read({ discreteCriteria: [{ db3Column: "type", behavior: Behavior.hasNone, options: [] }] })).results.map(row => row.name)).toEqual(["Delta"]);
        const unselected = await seed.read({ discreteCriteria: [{ db3Column: "type", behavior: Behavior.hasSomeOf, options: [] }] });
        expect(unselected.rowCount).toBe(4);
        expect(unselected.filterQueryResult.errors).toEqual([{ column: "type", error: "Select options to filter on" }]);
    }));

    it("hydrates locale overrides, intentional blanks and inherited facet metadata", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        await tx.bandDynamicLocalizedStringValue.create({ data: { publicId: generatePublicId(), stringId: seed.type.nameId, bandId: fixture.bands[0]!.id, localeId: fixture.frenchId, indexedValue: "" } });
        const result = await seed.read({ routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] });
        expect(result.facets.find(facet => facet.db3Column === "type")!.items.find(item => item.id === seed.type.publicId)?.label).toBe("");
        expect(result.facets.find(facet => facet.db3Column === "tags")!.items.find(item => item.id === seed.firstTag.publicId)).toMatchObject({ label: "", tooltip: "Description française", color: "green" });
        const english = await seed.read({ routeLocale: "en-US" });
        expect(english.facets.find(facet => facet.db3Column === "type")!.items.find(item => item.id === seed.type.publicId)?.label).toBe("");
    }));

    it("keeps semantic sorting, stable ties, paging and later-page totals", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const first = await seed.read({ take: 2, sort: [{ db3Column: "startsAt", direction: "asc" }] });
        const second = await seed.read({ offset: 2, take: 2, sort: [{ db3Column: "startsAt", direction: "asc" }] });
        expect(new Set([...first.results, ...second.results].map(row => row.publicId)).size).toBe(4);
        expect(first.rowCount).toBe(4);
        expect(second.rowCount).toBe(4);
        expect((await seed.read({ sort: [{ db3Column: "name", direction: "desc" }], take: 1 })).results[0]!.name).toBe("Delta");
        expect(first.facets).toEqual(second.facets);
    }));

    it("retains calendar segment overlap in rows, facets and counts", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: seed.events[0]!.id, name: "Later set", description: "", startsAt: new Date("2026-11-01T12:00:00Z"), durationMillis: BigInt(3600000), isAllDay: false, dateTimeVersion: 2 } });
        const calendarWindow = getCalendarWindow({ startDate: "2026-11-01", endDateExclusive: "2026-11-02" }, "Europe/Brussels");
        const result = await seed.read({ calendarWindow });
        expect(result.results.map(row => row.name)).toEqual(["Alpha"]);
        expect(result.rowCount).toBe(1);
        expect(result.facets.find(facet => facet.db3Column === "tags")!.items.find(item => item.id === seed.firstTag.publicId)?.rowCount).toBe(1);
    }));

    it("searches picker dates through visible segments at DST, point and exclusive boundaries", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const band = fixture.bands[0]!;
        const cancelled = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: seed.type.nameId,
            descriptionId: seed.type.descriptionId, significance: "Cancelled" } });
        const allDay = createAllDayRange({ startDate: "2026-03-29", endDateExclusive: "2026-03-30" }, "Europe/Brussels");
        const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        const fixtures = [
            { name: "All day", startsAt: allDay.getStartDateTime(), durationMillis: allDay.getDurationMillis(), isAllDay: true },
            { name: "Point at start", startsAt: new Date("2026-03-28T23:00:00Z"), durationMillis: 0 },
            { name: "End at start", startsAt: new Date("2026-03-28T22:00:00Z"), durationMillis: 3600000 },
            { name: "Point at end", startsAt: new Date("2026-03-29T22:00:00Z"), durationMillis: 0 },
            { name: "Cancelled set", startsAt: new Date("2026-03-29T12:00:00Z"), durationMillis: 3600000, statusId: cancelled.id },
            { name: "TBD", startsAt: null, durationMillis: 3600000 },
            { name: "Foreign", startsAt: new Date("2026-03-29T12:00:00Z"), durationMillis: 0, bandId: fixture.bands[1]!.id },
            { name: "Private", startsAt: new Date("2026-03-29T12:00:00Z"), durationMillis: 0, private: true },
            { name: "Deleted", startsAt: new Date("2026-03-29T12:00:00Z"), durationMillis: 0, isDeleted: true },
        ];
        for (const row of fixtures) {
            await tx.event.create({ data: { publicId: generatePublicId(), name: row.name, bandId: row.bandId ?? band.id, revision: 1,
                visiblePermissionId: row.private ? null : visibility.id, createdByUserId: fixture.admin.id, isDeleted: row.isDeleted ?? false,
                // Deliberately stale aggregates must not hide a segment on the selected day.
                startsAt: new Date("2026-01-01"), typeId: seed.type.id,
                segments: { create: { publicId: generatePublicId(), name: "Set", description: "", startsAt: row.startsAt,
                    durationMillis: BigInt(row.durationMillis), isAllDay: row.isAllDay ?? false, dateTimeVersion: 2, statusId: row.statusId } },
            } });
        }
        const result = await seed.read({ calendarWindow: getCalendarWindow({ startDate: "2026-03-29", endDateExclusive: "2026-03-30" }, "Europe/Brussels"), routeLocale: "fr-BE",
            discreteCriteria: [...seed.query().discreteCriteria.filter(criterion => criterion.db3Column !== "status"),
                { db3Column: "status", behavior: Behavior.doesntHaveAnyOf, options: [cancelled.publicId] }] });
        expect(result.results.map(row => row.name)).toEqual(["All day", "Point at start"]);
        expect(result.rowCount).toBe(2);
        expect(result.facets.find(facet => facet.db3Column === "type")!.items.find(item => item.id === seed.type.publicId)?.rowCount).toBe(2);
        expect(JSON.stringify(result.results)).not.toMatch(/"(?:id|bandId|bandUserId)":/);
    }));

    it("includes unset references when excluding one or several scalar catalog choices", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const other = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: seed.type.nameId, descriptionId: seed.type.descriptionId } });
        for (const options of [[seed.status.publicId], [seed.status.publicId, other.publicId]]) {
            const result = await seed.read({ discreteCriteria: [{ db3Column: "status", behavior: Behavior.doesntHaveAnyOf, options }] });
            expect(result.results.map(row => row.name)).toEqual(["Delta"]);
            expect(result.rowCount).toBe(1);
        }
    }));

    it("rejects foreign, hidden and forged catalog identities without widening results", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        for (const id of [seed.foreignTag.publicId, seed.hiddenTag.publicId, generatePublicId(), 123]) {
            await expect(seed.read({ discreteCriteria: [{ db3Column: "tags", behavior: Behavior.hasSomeOf, options: [id] }] })).rejects.toThrow();
        }
        for (const patch of [{ bandPublicId: null }, { bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId) }, { includeDeleted: true }]) {
            await expect(seed.read(patch)).rejects.toMatchObject({ statusCode: 403 });
        }
        await expect(seed.read({ sort: [{ db3Column: "bandId", direction: "asc" }] })).rejects.toThrow();
        await expect(seed.read({ viewID: "Event_Editor" })).rejects.toThrow();
    }));

    it("refreshes revoked grants and inactive/deleted/merged membership identities", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const context = await bindDB3ReadSnapshot(tx, seed.auth, { isolationLevel: "Serializable" });
        const read = () => GetSearchResultsCore(seed.query(), seed.auth, context);
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_nonpublic } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: seed.member.bandRoleId!, permissionId: grant.id } });
        await expect(read()).rejects.toThrow();
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: seed.member.bandRoleId!, permissionId: grant.id } });
        expect((await read()).rowCount).toBe(4);
        await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: true } });
        await expect(read()).rejects.toThrow();
        await tx.bandUser.update({ where: { id: seed.member.id }, data: { isDeleted: false } });
        await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
        await expect(read()).rejects.toThrow();
        await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: false, mergedIntoUserId: fixture.admin.id } });
        await expect(read()).rejects.toThrow();
    }));

    it("applies public, outsider, roleless and explicit platform-context policy", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const seed = await seedSearch(tx, fixture);
        const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "outside-search@test.invalid" } });
        for (const principal of [null, outsider]) {
            const auth = await loadAuthorizationForUser(principal, tx, seed.query().bandPublicId);
            await expect(GetSearchResultsCore(seed.query(), auth, await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }))).rejects.toThrow();
        }
        await tx.bandUser.update({ where: { id: seed.member.id }, data: { bandRoleId: null } });
        await expect(seed.read()).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(GetSearchResultsCore(seed.query(), platform, await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }))).rejects.toThrow();
        const selected = await loadAuthorizationForUser(fixture.admin, tx, seed.query().bandPublicId);
        const result = await GetSearchResultsCore(seed.query(), selected, await bindDB3ReadSnapshot(tx, selected, { isolationLevel: "Serializable" }));
        expect(result.rowCount).toBe(5);
        expect(result.results.map(row => row.name)).toContain("Private secret");
        expect(result.results.map(row => row.name)).not.toContain("Foreign secret");
    }));
});
