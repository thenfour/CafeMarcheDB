import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { readEventImportPreview } from "src/core/db3/server/eventImport";
import { insertEventInTransaction } from "src/core/db3/server/eventCreation";
import type { TGetImportEventDataArgs } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const band = fixture.bands[0]!;
    const bandPublicId = parsePublicId<"Band">(band.publicId);
    const auth = await loadAuthorizationForUser(fixture.admin, tx, bandPublicId);
    const text = (value: string) => tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
        publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: value,
    } } } });
    const name = await text("Import catalog");
    const descriptions = await Promise.all(Array.from({ length: 4 }, () => text("")));
    const concert = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id, significance: "Concert" } });
    const rehearsal = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id, significance: "Rehearsal" } });
    const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: name.id, significance: "FinalConfirmation" } });
    const invitation = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: band.id, nameId: name.id, significance: "DefaultInvitation" } });
    const choices = await Promise.all([100, 0].map(strength => tx.eventAttendance.create({ data: { publicId: generatePublicId(),
        buttonCaptionId: name.id, personalCaptionId: descriptions[0]!.id, pastCaptionId: descriptions[1]!.id,
        personalPastCaptionId: descriptions[2]!.id, descriptionId: descriptions[3]!.id, strength,
    } })));
    const people = await Promise.all(["Carl Shared", "Peter Member", "Guido Member"].map(async (name, index) => {
        const person = index === 0 ? await tx.user.update({ where: { id: fixture.user.id }, data: { name } })
            : await tx.user.create({ data: { publicId: generatePublicId(), name, email: generatePublicId() + "@import.test.invalid", bandUsersByUser: { create: { publicId: generatePublicId(), bandId: band.id } } } });
        return person;
    }));
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const songs = await Promise.all(["Smoke and Mirrors", "Paper Spaceships"].map((name, index) => tx.song.create({ data: {
        publicId: generatePublicId(), bandId: band.id, name, description: "", aliases: index === 0 ? "Old smoke" : "", visiblePermissionId: visibility.id,
    } })));
    const input: TGetImportEventDataArgs = { bandPublicId, routeLocale: "fr-BE", text: "26 October Rehearsal\ncarl + guido\nSmoke mirrors (solo)\nPaper spaceships(feat. Pieter)\nSmoke mirrors", config: "y2026" };
    const read = async (patch: Partial<TGetImportEventDataArgs> = {}) => readEventImportPreview(
        await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, { ...input, ...patch });
    return { band, bandPublicId, auth, read, input, songs, people, invitation, concert, rehearsal, status, choices, visibility };
}

describe.skipIf(!settingsMysqlTestUrl)("restored event import on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => { vi.stubEnv("CMDB_BASE_URL", "https://import.test.invalid"); vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-03-29T23:30:00Z")); return initializeAccessControl(database); }, 30_000);
    afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await database.$disconnect(); });
    const run = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("previews public identities, original defaults, ordered/repeated Songs and affirmative/negative responses without writes", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const before = { events: await tx.event.count(), responses: await tx.eventSegmentUserResponse.count(), changes: await tx.change.count() };
        const result = await c.read();
        expect(result.event).toMatchObject({ name: "26 October Rehearsal", typeId: c.rehearsal.publicId, statusId: c.status.publicId,
            expectedAttendanceUserTagId: c.invitation.publicId, visiblePermissionId: c.visibility.publicId });
        expect(result.segment).toMatchObject({ name: "Segment 1", isAllDay: true, startsAt: new Date("2026-10-25T23:00:00Z"), durationMillis: 86400000 });
        expect(result.songList.map(song => [song.songId, song.comment])).toEqual([[c.songs[0]!.publicId, "solo"], [c.songs[1]!.publicId, "feat. Pieter"], [c.songs[0]!.publicId, ""]]);
        expect(result.responses.map(response => [response.userId, response.attendanceId])).toEqual(c.people.map((person, index) => [person.publicId, c.choices[index === 1 ? 1 : 0]!.publicId]));
        expect(JSON.stringify(result)).not.toMatch(/"(?:id|bandId|bandUserId)":/);
        expect({ events: await tx.event.count(), responses: await tx.eventSegmentUserResponse.count(), changes: await tx.change.count() }).toEqual(before);
    }));

    it("saves an edited preview through the existing aggregate creation transaction and audits all children", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const preview = await c.read();
        const { log: _log, ...draft } = preview;
        const saved = await insertEventInTransaction(tx, c.auth, { bandPublicId: c.bandPublicId, routeLocale: c.input.routeLocale, ...draft,
            event: { ...draft.event, name: "Edited imported concert", typeId: parsePublicId<"EventType">(c.concert.publicId) } });
        const event = await tx.event.findUniqueOrThrow({ where: { publicId: saved.event.publicId }, include: {
            segments: { include: { responses: true } }, songLists: { include: { songs: { orderBy: { sortOrder: "asc" } } } },
        } });
        expect(event).toMatchObject({ bandId: c.band.id, createdByUserId: fixture.admin.id, name: "Edited imported concert", typeId: c.concert.id, revision: expect.any(Number) });
        expect(event.revision).toBeGreaterThan(0); expect(event.calendarInputHash).toBeTruthy();
        expect(event.segments[0]!.responses.map(response => response.bandUserId).sort()).toEqual((await tx.bandUser.findMany({ where: { bandId: c.band.id, userId: { in: c.people.map(person => person.id) } } })).map(member => member.id).sort());
        expect(event.songLists[0]!.songs.map(song => [song.songId, song.subtitle])).toEqual([[c.songs[0]!.id, "solo"], [c.songs[1]!.id, "feat. Pieter"], [c.songs[0]!.id, ""]]);
        expect((await tx.change.findMany()).map(change => change.table)).toEqual(expect.arrayContaining(["Event", "EventSegment", "EventSongList", "EventSongListSong", "EventSegmentUserResponse"]));
    }));

    it("matches only visible selected-band Songs and active unmerged people, even for platform authority", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.song.createMany({ data: [
            { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Smoke and Mirrors", description: "", visiblePermissionId: c.visibility.id },
            { publicId: generatePublicId(), bandId: c.band.id, name: "Smoke and Mirrors", description: "", isDeleted: true, visiblePermissionId: c.visibility.id },
            { publicId: generatePublicId(), bandId: c.band.id, name: "Smoke and Mirrors", description: "", visiblePermissionId: null, createdByUserId: fixture.user.id },
        ] });
        await tx.user.create({ data: { publicId: generatePublicId(), name: "Carl Outsider", email: generatePublicId() + "@import.test.invalid", bandUsersByUser: { create: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } } } });
        const excluded = await tx.user.create({ data: { publicId: generatePublicId(), name: "Peter Inactive", email: generatePublicId() + "@import.test.invalid", bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id, isDeleted: true } } } });
        await tx.user.create({ data: { publicId: generatePublicId(), name: "Guido Deleted", email: generatePublicId() + "@import.test.invalid", isDeleted: true, bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
        await tx.user.create({ data: { publicId: generatePublicId(), name: "Carl Merged", email: generatePublicId() + "@import.test.invalid", mergedIntoUserId: excluded.id, bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
        const result = await c.read();
        expect(result.responses.map(response => response.userId)).toEqual(c.people.map(person => person.publicId));
        expect(result.songList.map(song => song.songId)).toEqual([c.songs[0]!.publicId, c.songs[1]!.publicId, c.songs[0]!.publicId]);
        expect(JSON.stringify(result)).not.toMatch(/Outsider|Inactive|Deleted|Merged/);
    }));

    it("uses independent band invitation defaults, membership matches and local timezone dates", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const other = fixture.bands[1]!;
        await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: other.id, name: "dateTime.bandTimeZone", value: "America/Los_Angeles" } });
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: other.id, significance: "DefaultInvitation" } });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(other.publicId));
        const result = await readEventImportPreview(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth,
            { ...c.input, bandPublicId: parsePublicId<"Band">(other.publicId), routeLocale: "nl-BE", text: "Gig\ncarl" });
        expect(result.event.expectedAttendanceUserTagId).toBe(tag.publicId);
        expect(result.event.typeId).toBeNull(); expect(result.songList).toEqual([]);
        expect(result.responses.map(response => response.userId)).toEqual([c.people[0]!.publicId]);
        expect(result.segment.startsAt).toEqual(new Date("2026-03-29T07:00:00Z"));
        expect((await c.read({ text: "Gig" })).segment.startsAt).toEqual(new Date("2026-03-29T22:00:00Z"));
    }));

    it("omits ambiguous names and handles missing/deleted/inactive defaults explicitly", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Smoke and Mirrors", description: "", visiblePermissionId: c.visibility.id } });
        await tx.user.create({ data: { publicId: generatePublicId(), name: "Carl Other", email: generatePublicId() + "@import.test.invalid", bandUsersByUser: { create: { publicId: generatePublicId(), bandId: c.band.id } } } });
        await tx.bandUserTag.update({ where: { id: c.invitation.id }, data: { isHidden: true } });
        await tx.eventStatus.update({ where: { id: c.status.id }, data: { isDeleted: true } });
        await tx.eventType.update({ where: { id: c.rehearsal.id }, data: { isDeleted: true } });
        await tx.eventAttendance.update({ where: { id: c.choices[0]!.id }, data: { isActive: false } });
        const result = await c.read();
        expect(result.songList.map(song => song.songId)).toEqual([c.songs[1]!.publicId]);
        expect(result.responses.map(response => response.userId)).toEqual([c.people[1]!.publicId]);
        expect(result.event).toMatchObject({ typeId: null, statusId: null, expectedAttendanceUserTagId: null });
        expect(result.log).toContain("  Ambiguous Song match; omitted.");
        expect(result.log).toContain("carl: ambiguous member match; omitted.");
    }));

    it.each(["anonymous", "member", "unscoped", "foreign", "revoked", "deleted-person", "merged-person", "deleted-band"] as const)(
        "rejects %s preview authority in the fresh snapshot", kind => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            let auth = c.auth;
            if (kind === "anonymous") { auth = await loadAuthorizationForUser(null, tx, c.bandPublicId); }
            if (kind === "member") { auth = await loadAuthorizationForUser(fixture.user, tx, c.bandPublicId); }
            if (kind === "unscoped") { auth = await loadAuthorizationForUser(fixture.admin, tx); }
            if (kind === "foreign") { auth = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId)); }
            if (kind === "revoked") { await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: null } }); }
            if (kind === "deleted-person") { await tx.user.update({ where: { id: fixture.admin.id }, data: { isDeleted: true } }); }
            if (kind === "merged-person") { await tx.user.update({ where: { id: fixture.admin.id }, data: { mergedIntoUserId: fixture.user.id } }); }
            if (kind === "deleted-band") { await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } }); }
            const read = async () => readEventImportPreview(await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" }), auth, c.input);
            await expect(read()).rejects.toThrow();
        }));

    it.each([["29 March 2026 Concert", "2026-03-28T23:00:00Z", 23], ["25 October 2026 Concert", "2026-10-24T22:00:00Z", 25]] as const)(
        "uses separate band midnights for %s", (text, start, hours) => run(async (tx, fixture) => {
            const c = await prepare(tx, fixture);
            const preview = await c.read({ text });
            expect(preview.segment.startsAt).toEqual(new Date(start));
            expect(preview.segment.durationMillis).toBe(hours * 3600000);
        }));

    it("rejects references hidden or deactivated after preview before creating a partial Event", () => run(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const { log: _log, ...draft } = await c.read();
        await tx.song.update({ where: { id: c.songs[0]!.id }, data: { isDeleted: true } });
        const before = await tx.event.count();
        await tx.$executeRawUnsafe("SAVEPOINT import_save");
        await expect(insertEventInTransaction(tx, c.auth, { bandPublicId: c.bandPublicId, ...draft })).rejects.toThrow();
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT import_save");
        expect(await tx.event.count()).toBe(before);
    }));
});
