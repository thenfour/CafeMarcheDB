import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { readSongHistory } from "src/core/db3/server/songHistory";
import { SongHistoryInputSchema, type SongHistoryFilter } from "src/core/db3/shared/entities/song/songHistory";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { prepareSongs } from "./support/songWorkflowMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareSongs(tx, fixture);
    const name = await c.text("Concert", "Concert francais");
    const type = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id } });
    const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id } });
    const tag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: name.id } });
    const secondTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: name.id } });
    const foreignTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, nameId: name.id } });
    async function event(name: string, startsAt: Date | null, data: Partial<Prisma.EventUncheckedCreateInput>) {
        return tx.event.create({ data: {
            publicId: generatePublicId(), bandId: c.band.id, name, revision: 1, visiblePermissionId: c.visibility.id, createdByUserId: fixture.admin.id,
            startsAt, typeId: type.id, statusId: status.id, ...data,
            songLists: { create: [0, 1].map(index => ({ publicId: generatePublicId(), name: `Set ${index}`, description: "", sortOrder: index,
                songs: { create: { publicId: generatePublicId(), songId: c.songs[0]!.id, sortOrder: 0 } } })) },
        } });
    }
    const makeEvent = (name: string, startsAt: string | null, data: Partial<Prisma.EventUncheckedCreateInput> = {}) =>
        event(name, startsAt ? new Date(startsAt) : null, data);
    const events = await Promise.all([
        makeEvent("Epoch", "1970-01-01T00:00:00Z"),
        makeEvent("Five-year start", "2021-03-28T22:00:00Z"),
        makeEvent("Year start", "2025-03-28T23:00:00Z"),
        makeEvent("Yesterday", "2026-03-28T22:59:59.999Z"),
        makeEvent("Today", "2026-03-28T23:00:00Z"),
        makeEvent("Future", "2026-03-29T01:00:00Z"),
        makeEvent("Undated", null),
        makeEvent("Private", "2026-03-28T20:00:00Z", { visiblePermissionId: null }),
        makeEvent("Deleted", "2026-03-28T20:00:00Z", { isDeleted: true }),
        makeEvent("Foreign", "2026-03-28T20:00:00Z", { bandId: fixture.bands[1]!.id }),
    ]);
    await tx.eventTagAssignment.createMany({ data: [
        { publicId: generatePublicId(), eventId: events[2]!.id, bandEventTagId: tag.id },
        { publicId: generatePublicId(), eventId: events[3]!.id, bandEventTagId: tag.id },
        { publicId: generatePublicId(), eventId: events[3]!.id, bandEventTagId: secondTag.id },
    ] });
    const filterSpec: SongHistoryFilter = { timing: "All", eventTypeIds: [], eventStatusIds: [], eventTagIds: [] };
    const read = async (patch: Partial<SongHistoryFilter> = {}) => readSongHistory(await c.snapshot(), c.auth,
        { ...c.target, routeLocale: "fr-BE", filterSpec: { ...filterSpec, ...patch } });
    return { ...c, events, type, status, tag, secondTag, foreignTag, readHistory: read, filterSpec };
}

describe.skipIf(!settingsMysqlTestUrl)("Song performance history on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-29T12:00:00Z")); return initializeAccessControl(database); }, 30_000);
    afterAll(async () => { vi.useRealTimers(); await database.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it.each([
        { timing: "All", names: ["Future", "Today", "Yesterday", "Year start", "Five-year start", "Epoch"] },
        { timing: "All past", names: ["Yesterday", "Year start", "Five-year start", "Epoch"] },
        { timing: "Future", names: ["Future", "Today"] },
        { timing: "Past year", names: ["Yesterday", "Year start"] },
        { timing: "Past 5 years", names: ["Yesterday", "Year start", "Five-year start"] },
    ] as const)("preserves $timing at band-day/year boundaries, excluding undated/private/deleted/foreign Events", ({ timing, names }) => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.readHistory({ timing });
        expect(result.events.map(event => event.name)).toEqual(names);
        expect(new Set(result.events.map(event => event.publicId)).size).toBe(names.length);
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|bandId|typeId|statusId|createdByUserId)":/);
    }));

    it("combines catalog filters and requires all tags without widening unavailable identities", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.readHistory({ eventTypeIds: [parsePublicId<"EventType">(c.type.publicId)], eventStatusIds: [parsePublicId<"EventStatus">(c.status.publicId)],
            eventTagIds: [parsePublicId<"EventTag">(c.tag.publicId), parsePublicId<"EventTag">(c.secondTag.publicId)] });
        expect(result.events.map(event => event.name)).toEqual(["Yesterday"]);
        for (const tag of [c.foreignTag, { publicId: generatePublicId() }]) {
            await expect(c.readHistory({ eventTagIds: [parsePublicId<"EventTag">(tag.publicId)] })).rejects.toThrow();
        }
        await tx.bandEventTag.update({ where: { id: c.tag.id }, data: { isHidden: true } });
        await expect(c.readHistory({ eventTagIds: [parsePublicId<"EventTag">(c.tag.publicId)] })).rejects.toThrow();
    }));

    it("requires a visible Song and keeps a shared person isolated in two bands", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: c.role.id } });
        const auth = await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId));
        await expect(readSongHistory(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth,
            { bandPublicId: parsePublicId<"Band">(auth.requireBand().publicId), songId: c.target.songId, filterSpec: c.filterSpec })).rejects.toThrow();
        const other = await readSongHistory(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth,
            { bandPublicId: parsePublicId<"Band">(auth.requireBand().publicId), songId: parsePublicId<"Song">(c.foreign.publicId), filterSpec: c.filterSpec });
        expect(other.events).toEqual([]);
        for (const data of [{ isDeleted: true }, { visiblePermissionId: null, createdByUserId: fixture.admin.id }]) {
            await tx.song.update({ where: { id: c.songs[0]!.id }, data: { isDeleted: false, ...data } });
            await expect(c.readHistory()).rejects.toThrow();
        }
    }));

    it.each(["songs", "events", "membership", "account", "band"])("rechecks stale %s authority before history reads", reason => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        if (reason === "songs" || reason === "events") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: reason === "songs" ? Permission.view_songs : Permission.view_events_nonpublic } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (reason === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (reason === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.user.id }, data: { isDeleted: true } });
        }
        await expect(c.readHistory()).rejects.toThrow();
    }));

    it("uses one repeatable root snapshot and validates explicit public input", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const policies: Array<{ isolationLevel: string }> = [];
        const root: DB3ReadRootDatabase = { $transaction: async (read, policy) => {
            policies.push(policy);
            return c.root.$transaction(read, policy);
        } };
        expect((await readSongHistory(root, c.auth, { ...c.target, filterSpec: c.filterSpec })).events).toHaveLength(6);
        expect(policies).toEqual([{ isolationLevel: "RepeatableRead" }]);
        for (const input of [{ songId: 1 }, { bandPublicId: null }, { filterSpec: { ...c.filterSpec, timing: "Invalid" } }, { bandId: c.band.id }]) {
            expect(() => SongHistoryInputSchema.parse({ ...c.target, filterSpec: c.filterSpec, ...input })).toThrow();
        }
        for (const auth of [await loadAuthorizationForUser(null, tx), await loadAuthorizationForUser(fixture.admin, tx)]) {
            await expect(readSongHistory(root, auth, { ...c.target, filterSpec: c.filterSpec })).rejects.toThrow();
        }
    }));
});
