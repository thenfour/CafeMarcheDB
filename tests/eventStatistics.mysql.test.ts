import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import type { DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { readEventStatistics } from "src/core/db3/server/eventStatistics";
import { type EventStatisticsFilter } from "src/core/db3/shared/entities/event/eventStatistics";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { prepareSongs } from "./support/songWorkflowMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareSongs(tx, fixture);
    const reportPermission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_reports } });
    await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: reportPermission.id } });
    const name = await c.text("Concert", "Concert francais");
    const type = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id } });
    const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id } });
    const tags = await Promise.all([0, 1].map(() => tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, nameId: name.id } })));
    const dates = ["1970-01-01T00:00:00Z", "2021-03-28T22:00:00Z", "2025-03-28T23:00:00Z", "2026-03-28T22:59:59.999Z", "2026-03-28T23:00:00Z", "2026-03-29T01:00:00Z"];
    const events = await Promise.all(dates.map((date, index) => tx.event.create({ data: {
        publicId: generatePublicId(), bandId: c.band.id, name: `Activity ${index}`, revision: 1, visiblePermissionId: c.visibility.id,
        startsAt: new Date(date), typeId: type.id, statusId: status.id, createdByUserId: fixture.admin.id,
        tags: { create: tags.slice(0, index === 3 ? 2 : 1).map(tag => ({ publicId: generatePublicId(), bandEventTagId: tag.id })) },
        songLists: { create: [0, 1].map(sortOrder => ({ publicId: generatePublicId(), name: "Set", description: "", sortOrder,
            songs: { create: c.songs.slice(0, index + 1).map((song, songIndex) => ({ publicId: generatePublicId(), songId: song.id, sortOrder: songIndex })) } })) },
    } })));
    // The attendance helper's Event has no songs; totals must still include it.
    const filterSpec: EventStatisticsFilter = { timing: "All", eventTypeIds: [], eventStatusIds: [], eventTagIds: [], songTagIds: [] };
    const args = { bandPublicId: c.target.bandPublicId, routeLocale: "fr-BE", filterSpec };
    const read = async (patch: Partial<EventStatisticsFilter> = {}) => readEventStatistics(await c.snapshot(), c.auth, { ...args, filterSpec: { ...filterSpec, ...patch } });
    return { ...c, events, type, status, tags, args, readStats: read };
}

describe.skipIf(!settingsMysqlTestUrl)("Event statistics on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-03-29T12:00:00Z")); return initializeAccessControl(database); }, 30_000);
    afterAll(async () => { vi.useRealTimers(); await database.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it.each([
        { timing: "All", indexes: [5, 4, 3, 2, 1, 0], total: 7 },
        { timing: "All past", indexes: [3, 2, 1, 0], total: 4 },
        { timing: "Future", indexes: [5, 4], total: 3 },
        { timing: "Past year", indexes: [3, 2], total: 2 },
        { timing: "Past 5 years", indexes: [3, 2, 1], total: 3 },
    ] as const)("agrees with history at $timing band-day/year boundaries and deduplicates performances", ({ timing, indexes, total }) => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.readStats({ timing });
        expect(result.allEvents).toHaveLength(total);
        expect(result.popularSongsOccurrances.filter(song => song.songId === c.songs[0]!.publicId).map(song => song.eventId)).toEqual(indexes.map(index => c.events[index]!.publicId));
        expect(new Set(result.popularSongsOccurrances.map(song => `${song.songId}/${song.eventId}`)).size).toBe(result.popularSongsOccurrances.length);
        expect(result.allEvents.find(event => event.publicId === c.events[indexes[0]!]!.publicId)?.typeId).toBe(c.type.publicId);
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|bandId|createdByUserId|songLists|nameId)":/);
    }));

    it("combines type/status/all Event tags and all Song tags while Song filters leave Event totals intact", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const filter = { eventTypeIds: [parsePublicId<"EventType">(c.type.publicId)], eventStatusIds: [parsePublicId<"EventStatus">(c.status.publicId)],
            eventTagIds: c.tags.map(tag => parsePublicId<"EventTag">(tag.publicId)), songTagIds: [c.firstTag, c.secondTag].map(tag => parsePublicId<"SongTag">(tag.publicId)) };
        const result = await c.readStats(filter);
        expect(result.allEvents.map(event => event.publicId)).toEqual([c.events[3]!.publicId]);
        expect(result.popularSongsOccurrances.map(song => song.songName)).toEqual(["Charlie"]);
        const noSongs = await c.readStats({ ...filter, songTagIds: [parsePublicId<"SongTag">(c.secondTag.publicId)], timing: "Past 5 years" });
        expect(noSongs.allEvents).toHaveLength(1);
        expect(new Set(noSongs.popularSongsOccurrances.map(song => song.songName))).toEqual(new Set(["Bravo", "Charlie"]));
        const otherType = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: c.type.nameId, descriptionId: c.type.descriptionId } });
        expect((await c.readStats({ eventTypeIds: [parsePublicId<"EventType">(otherType.publicId)] })).allEvents).toEqual([]);
        for (const songTag of [c.foreignTag, c.hiddenTag, { publicId: generatePublicId() }]) {
            await expect(c.readStats({ songTagIds: [parsePublicId<"SongTag">(songTag.publicId)] })).rejects.toThrow();
        }
        await tx.bandEventTag.update({ where: { id: c.tags[0]!.id }, data: { isHidden: true } });
        await expect(c.readStats({ eventTagIds: [parsePublicId<"EventTag">(c.tags[0]!.publicId)] })).rejects.toThrow();
        await expect(c.readStats({ eventTagIds: [parsePublicId<"EventTag">(generatePublicId())] })).rejects.toThrow();
        const foreignTag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, nameId: c.type.nameId } });
        await expect(c.readStats({ eventTagIds: [parsePublicId<"EventTag">(foreignTag.publicId)] })).rejects.toThrow();
        await expect(c.readStats({ eventStatusIds: [parsePublicId<"EventStatus">(generatePublicId())] })).rejects.toThrow();
    }));

    it("ranks at most ten Songs by distinct Event count with deterministic ties", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const extras = await Promise.all(Array.from({ length: 12 }, (_, index) => tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
            name: `Tie ${index}`, aliases: "", description: "", visiblePermissionId: c.visibility.id, createdByUserId: fixture.user.id } })));
        const list = await tx.eventSongList.findFirstOrThrow({ where: { eventId: c.events[0]!.id } });
        await tx.eventSongListSong.createMany({ data: extras.map(song => ({ publicId: generatePublicId(), eventSongListId: list.id, songId: song.id, sortOrder: 1 })) });
        const result = await c.readStats();
        const ids = [...new Set(result.popularSongsOccurrances.map(song => song.songId))];
        expect(ids).toHaveLength(10);
        expect(ids.slice(0, 4)).toEqual(c.songs.map(song => song.publicId));
        expect(ids.slice(4)).toEqual(extras.map(song => song.publicId).sort((a, b) => a.localeCompare(b)).slice(0, 6));
    }));

    it("excludes undated/private/deleted/foreign Events and independently unavailable Songs/catalog identities", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (const data of [{ startsAt: null }, { visiblePermissionId: null }, { isDeleted: true }, { bandId: fixture.bands[1]!.id }]) {
            await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Unavailable", revision: 1, startsAt: new Date(),
                visiblePermissionId: c.visibility.id, createdByUserId: fixture.admin.id, ...data,
                songLists: { create: { publicId: generatePublicId(), name: "Set", description: "", songs: { create: { publicId: generatePublicId(), songId: c.songs[0]!.id } } } } } });
        }
        await tx.song.update({ where: { id: c.songs[1]!.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        await tx.song.update({ where: { id: c.songs[2]!.id }, data: { isDeleted: true } });
        const list = await tx.eventSongList.findFirstOrThrow({ where: { eventId: c.events[0]!.id } });
        await tx.eventSongListSong.create({ data: { publicId: generatePublicId(), eventSongListId: list.id, songId: c.foreign.id } });
        await tx.eventType.update({ where: { id: c.type.id }, data: { isDeleted: true } });
        const result = await c.readStats();
        expect(result.allEvents).toHaveLength(7);
        expect(new Set(result.popularSongsOccurrances.map(song => song.songName))).toEqual(new Set(["Alpha", "Delta"]));
        expect(result.allEvents.filter(event => event.publicId !== c.event.publicId).every(event => event.typeId === null || event.typeId === undefined)).toBe(true);
    }));

    it.each(["reports", "events", "membership", "roleless", "account", "merged", "band"])("rechecks stale %s authority before aggregates", reason => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        if (reason === "reports" || reason === "events") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: reason === "reports" ? Permission.view_events_reports : Permission.view_events_nonpublic } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (reason === "membership" || reason === "roleless") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: reason === "roleless" ? { bandRoleId: null } : { isDeleted: true } });
        } else if (reason === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.user.id }, data: reason === "merged" ? { mergedIntoUserId: fixture.admin.id } : { isDeleted: true } });
        }
        await expect(c.readStats()).rejects.toThrow();
    }));

    it("removes Song occurrences after fresh Song grant revocation without hiding permitted Event totals", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const result = await c.readStats();
        expect(result.allEvents).toHaveLength(7);
        expect(result.popularSongsOccurrances).toEqual([]);
        await expect(c.readStats({ songTagIds: [parsePublicId<"SongTag">(c.firstTag.publicId)] })).rejects.toThrow();
    }));

    it("uses independent selected-band roles and one repeatable root snapshot; rejects anonymous, roleless, outsider and unscoped platform contexts", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const policies: Array<{ isolationLevel: string }> = [];
        const root: DB3ReadRootDatabase = { $transaction: async (read, policy) => { policies.push(policy); return c.root.$transaction(read, policy); } };
        const result = await readEventStatistics(root, c.auth, c.args);
        expect(result.allEvents).toHaveLength(7);
        expect(policies).toEqual([{ isolationLevel: "RepeatableRead" }]);
        const secondBand = parsePublicId<"Band">(fixture.bands[1]!.publicId);
        for (const auth of [await loadAuthorizationForUser(null, tx), await loadAuthorizationForUser(fixture.admin, tx),
            await loadAuthorizationForUser(fixture.user, tx, secondBand)]) {
            await expect(readEventStatistics(root, auth, { ...c.args, bandPublicId: secondBand })).rejects.toThrow();
        }
        const grants = await tx.bandRolePermission.findMany({ where: { bandRoleId: c.role.id } });
        const secondRole = await tx.bandRole.create({ data: { publicId: generatePublicId(), nameId: c.role.nameId,
            bandRolePermissions: { create: grants.map(grant => ({ publicId: generatePublicId(), permissionId: grant.permissionId })) } } });
        await tx.bandUser.update({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: fixture.user.id } }, data: { bandRoleId: secondRole.id } });
        const secondEvent = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Second band performance", revision: 1,
            startsAt: new Date(), visiblePermissionId: c.visibility.id, typeId: c.type.id, statusId: c.status.id,
            songLists: { create: { publicId: generatePublicId(), name: "Set", description: "",
                songs: { create: [c.foreign, c.songs[0]!].map(song => ({ publicId: generatePublicId(), songId: song.id })) } } } } });
        const secondAuth = await loadAuthorizationForUser(fixture.user, tx, secondBand);
        const second = await readEventStatistics(root, secondAuth, { ...c.args, bandPublicId: secondBand, routeLocale: "nl-BE" });
        expect(second.allEvents.map(event => event.publicId)).toEqual([secondEvent.publicId]);
        expect(second.popularSongsOccurrances.map(song => song.songId)).toEqual([c.foreign.publicId]);
        await expect(readEventStatistics(root, secondAuth, c.args)).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx, c.args.bandPublicId);
        expect((await readEventStatistics(root, platform, c.args)).allEvents).toHaveLength(7);
        await tx.bandUser.delete({ where: { id: c.member.id } });
        await expect(c.readStats()).rejects.toThrow();
        expect((await readEventStatistics(root, secondAuth, { ...c.args, bandPublicId: secondBand })).allEvents).toHaveLength(1);
    }));
});
