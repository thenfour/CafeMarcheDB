import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { gPermissionRegistry, Permission } from "shared/permissions";
import { isPublicId, parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { insertEvent, insertEventInTransaction } from "src/core/db3/server/eventCreation";
import type { TinsertEventArgs } from "src/core/db3/shared/apiTypes";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { queryView } from "src/core/db3/server/db3QueryCore";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { permissionVisibilityView } from "src/core/db3/shared/entities/user/permissionViews";
import { xEvent } from "src/core/db3/shared/schema/event";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.manage_events, Permission.admin_events, Permission.edit_public_homepage, Permission.view_events_nonpublic,
        Permission.change_others_event_responses, Permission.view_songs, Permission.visibility_members]);
    const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
    const args: TinsertEventArgs = {
        bandPublicId: c.args.bandPublicId,
        event: { name: "New concert", locationDescription: null, typeId: null, statusId: null, tags: [], expectedAttendanceUserTagId: null, visiblePermissionId: parsePublicId<"Permission">(visibility.publicId) },
        segment: { name: "", description: "Description", startsAt: new Date("2099-01-01T12:00:00Z"), durationMillis: 3_000_000_000, isAllDay: false },
    };
    const create = (patch: Partial<TinsertEventArgs> = {}) => insertEventInTransaction(tx, c.auth, { ...args, ...patch });
    return { ...c, args, create, visibility };
}

async function captureState(tx: Prisma.TransactionClient) {
    return {
        events: await tx.event.findMany({ orderBy: { id: "asc" } }), segments: await tx.eventSegment.findMany({ orderBy: { id: "asc" } }),
        lists: await tx.eventSongList.findMany({ orderBy: { id: "asc" } }), songs: await tx.eventSongListSong.findMany({ orderBy: { id: "asc" } }),
        responses: await tx.eventSegmentUserResponse.findMany({ orderBy: { id: "asc" } }), tags: await tx.eventTagAssignment.findMany({ orderBy: { id: "asc" } }),
        changes: await tx.change.findMany({ orderBy: { id: "asc" } }),
    };
}

// Exercise the production transaction wrapper inside a fixture that will itself roll back.
function fixtureRoot(tx: Prisma.TransactionClient, database = tx) {
    return { $transaction: async <T>(work: (inner: Prisma.TransactionClient) => Promise<T>, policy: { isolationLevel: "Serializable" | "RepeatableRead" }) => {
        expect(policy.isolationLevel).toBe("Serializable");
        await tx.$executeRawUnsafe("SAVEPOINT event_creation");
        try {
            return await work(database);
        } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT event_creation");
            throw error;
        } finally {
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT event_creation");
        }
    } };
}

describe.skipIf(!settingsMysqlTestUrl)("event creation on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(async () => {
        vi.stubEnv("CMDB_BASE_URL", "https://event-creation.test.invalid");
        await initializeAccessControl(database);
    }, 30_000);
    afterAll(async () => {
        vi.unstubAllEnvs();
        await database.$disconnect();
    });
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("lets Global Admin with Band Public create member-visible events and choose configured visibility", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const auth = await loadAuthorizationForUser(fixture.admin, tx, c.args.bandPublicId);
        expect(auth.membership).toBeNull();
        expect(auth.hasPermission(Permission.global_band_admin)).toBe(true);
        expect(auth.hasPermission(Permission.manage_events)).toBe(false);
        expect(auth.hasPermission(Permission.visibility_members)).toBe(false);
        const context = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        const choices = await queryView({ view: permissionVisibilityView, filter: {}, cmdbQueryContext: "global admin visibility choices" }, auth, context);
        expect(choices.items.map(choice => choice.name).sort()).toEqual(gPermissionRegistry
            .filter(definition => definition.scope === "band" && definition.isVisibility).map(definition => definition.key).sort());
        const created = await insertEventInTransaction(tx, auth, c.args);
        expect(await tx.event.findUniqueOrThrow({ where: { publicId: created.event.publicId } }))
            .toMatchObject({ visiblePermissionId: c.visibility.id, createdByUserId: auth.userId });
        const editors = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_editors } });
        const rows = createCommandRowServices(auth, tx);
        await rows.update(xEvent, created.event.publicId, { visiblePermissionId: parsePublicId<"Permission">(editors.publicId) });
        expect(await tx.event.findUniqueOrThrow({ where: { publicId: created.event.publicId } }))
            .toMatchObject({ visiblePermissionId: editors.id });
        await tx.permission.update({ where: { id: editors.id }, data: { isDeleted: true } });
        for (const visiblePermissionId of [parsePublicId<"Permission">(generatePublicId()), parsePublicId<"Permission">(editors.publicId)]) {
            await expect(insertEventInTransaction(tx, auth, { ...c.args, event: { ...c.args.event, visiblePermissionId } })).rejects.toThrow();
            await expect(rows.update(xEvent, created.event.publicId, { visiblePermissionId })).rejects.toThrow();
        }
    }));

    it("creates band-owned event/segment identities, creator audits and the calendar range", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const result = await c.create();
        const event = await tx.event.findUniqueOrThrow({ where: { publicId: result.event.publicId } });
        const segment = await tx.eventSegment.findUniqueOrThrow({ where: { publicId: result.segment.publicId } });
        expect(event).toMatchObject({ bandId: c.band.id, createdByUserId: c.person.id, name: "New concert", locationDescription: "", startsAt: c.args.segment.startsAt, durationMillis: BigInt(3_000_000_000) });
        expect(event.revision).toBeGreaterThan(0);
        expect(event.calendarInputHash).toBeTruthy();
        expect(segment).toMatchObject({ eventId: event.id, name: "Set 1", description: "Description", durationMillis: BigInt(3_000_000_000) });
        expect(segment.dateTimeVersion).toBe(2);
        expect(result.event).not.toHaveProperty("id");
        expect(result.event).not.toHaveProperty("bandId");
        expect(result.event.createdByUserId).toBe(c.person.publicId);
        expect(result.segment).toMatchObject({ eventId: event.publicId });
        expect(result.segment).not.toHaveProperty("id");
        expect((await tx.change.findMany()).every(change => change.userId === c.person.id)).toBe(true);
    }));

    it("creates a private undated event and an empty initial setlist without song-reading authority", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const result = await c.create({ event: { ...c.args.event, visiblePermissionId: null }, segment: { ...c.args.segment, startsAt: null, durationMillis: 0, isAllDay: true }, songList: [], responses: [] });
        expect(result.event).toMatchObject({ visiblePermissionId: null, startsAt: null, durationMillis: BigInt(0) });
        const list = await tx.eventSongList.findFirstOrThrow({ where: { event: { publicId: result.event.publicId } }, include: { songs: true } });
        expect(isPublicId(list.publicId)).toBe(true);
        expect(list.songs).toEqual([]);
    }));

    it.each([Permission.admin_events, Permission.edit_public_homepage])("retains existing independent %s field authorization", permissionName => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: permissionName } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        const before = await captureState(tx);
        await expect(insertEvent(fixtureRoot(tx), c.auth, c.args)).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["unknown", "nonvisibility", "unheld"])("rejects an %s visibility target", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const permission = kind === "unknown" ? { publicId: generatePublicId() }
            : await tx.permission.findUniqueOrThrow({ where: { name: kind === "nonvisibility" ? Permission.manage_events : Permission.visibility_editors } });
        const before = await captureState(tx);
        await expect(c.create({ event: { ...c.args.event, visiblePermissionId: parsePublicId<"Permission">(permission.publicId) } })).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it("returns localized shared and inherited catalog values without raw string/ownership identities", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const label = () => tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: [
            { publicId: generatePublicId(), localeId: fixture.englishId, indexedValue: "Concert" },
            { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: "Spectacle" },
        ] } } });
        const [name, description] = await Promise.all([label(), label()]);
        const type = await tx.eventType.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id } });
        const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id } });
        const globalTag = await tx.globalEventTag.create({ data: { publicId: generatePublicId(), nameId: name.id, descriptionId: description.id } });
        const tag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id, globalEventTagId: globalTag.id } });
        const userTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id } });
        const result = await c.create({ routeLocale: "fr-BE", event: { ...c.args.event, typeId: parsePublicId<"EventType">(type.publicId),
            statusId: parsePublicId<"EventStatus">(status.publicId), tags: [parsePublicId<"EventTag">(tag.publicId)], expectedAttendanceUserTagId: parsePublicId<"UserTag">(userTag.publicId) } });
        expect(result.event.type?.name).toBe("Spectacle");
        expect(result.event.status?.name).toBe("Spectacle");
        expect(result.event.tags?.[0]?.eventTag?.name).toBe("Spectacle");
        expect(result.event.tags?.[0]?.bandEventTagId).toBe(tag.publicId);
        expect(result.event.expectedAttendanceUserTag?.publicId).toBe(userTag.publicId);
        expect(result.event.type).not.toHaveProperty("nameId");
        expect(result.event.tags?.[0]?.eventTag).not.toHaveProperty("bandId");
    }));

    it("keeps setlist order/reprises and imports answers into the selected membership", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Tune", description: "", aliases: "", visiblePermissionId: c.visibility.id } });
        const result = await c.create({ songList: [{ songId: parsePublicId<"Song">(song.publicId), comment: "Intro" }, { songId: parsePublicId<"Song">(song.publicId), comment: "Reprise" }],
            responses: [{ userId: parsePublicId<"User">(c.person.publicId), attendanceId: parsePublicId<"EventAttendance">(c.attendance.publicId) }] });
        const list = await tx.eventSongList.findFirstOrThrow({ where: { event: { publicId: result.event.publicId } }, include: { songs: { orderBy: { sortOrder: "asc" } } } });
        expect(isPublicId(list.publicId)).toBe(true);
        expect(list.songs.map(item => [item.songId, item.sortOrder, item.subtitle])).toEqual([[song.id, 0, "Intro"], [song.id, 1, "Reprise"]]);
        expect(list.songs.every(item => isPublicId(item.publicId))).toBe(true);
        const response = await tx.eventSegmentUserResponse.findFirstOrThrow({ where: { eventSegment: { publicId: result.segment.publicId } } });
        expect(response).toMatchObject({ bandUserId: c.member.id, attendanceId: c.attendance.id, createdByUserId: c.person.id });
        expect(isPublicId(response.publicId)).toBe(true);
        const foreignMember = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: c.person.id } } });
        expect(response.bandUserId).not.toBe(foreignMember.id);
        expect((await tx.change.findMany()).map(change => change.table)).toEqual(expect.arrayContaining(["Event", "EventSegment", "EventSongList", "EventSongListSong", "EventSegmentUserResponse"]));
    }));

    it.each(["anonymous", "unscoped", "other-band"])("rejects %s authorization", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const auth = await loadAuthorizationForUser(kind === "anonymous" ? null : c.person, tx, kind === "unscoped" ? undefined : kind === "other-band" ? parsePublicId<"Band">(fixture.bands[1]!.publicId) : c.args.bandPublicId);
        const before = await captureState(tx);
        await expect(insertEventInTransaction(tx, auth, c.args)).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["grant", "membership", "person", "merged", "band"])("refreshes a revoked/deleted %s before writing", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        if (kind === "grant") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.manage_events } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (kind === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (kind === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: c.person.id }, data: kind === "person" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        }
        const before = await captureState(tx);
        await expect(c.create()).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["foreign-song", "private-song", "deleted-song", "foreign-tag", "hidden-tag", "foreign-group", "inactive-answer", "nonmember", "inactive-member", "response-grant"])("rejects %s and rolls back the aggregate", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        let args = { ...c.args };
        if (kind.endsWith("song")) {
            const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: kind === "foreign-song" ? fixture.bands[1]!.id : c.band.id,
                name: "Unavailable", description: "", aliases: "", isDeleted: kind === "deleted-song", visiblePermissionId: kind === "private-song" ? null : c.visibility.id } });
            args = { ...args, songList: [{ songId: parsePublicId<"Song">(song.publicId), comment: "" }] };
        } else if (kind.endsWith("tag")) {
            const tag = await tx.bandEventTag.create({ data: { publicId: generatePublicId(), bandId: kind === "foreign-tag" ? fixture.bands[1]!.id : c.band.id, isHidden: kind === "hidden-tag" } });
            args = { ...args, event: { ...args.event, tags: [parsePublicId<"EventTag">(tag.publicId)] } };
        } else if (kind === "foreign-group") {
            const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id } });
            args = { ...args, event: { ...args.event, expectedAttendanceUserTagId: parsePublicId<"UserTag">(tag.publicId) } };
        } else {
            args = { ...args, responses: [{ userId: parsePublicId<"User">(c.person.publicId), attendanceId: parsePublicId<"EventAttendance">(c.attendance.publicId) }] };
            if (kind === "inactive-answer") {
                await tx.eventAttendance.update({ where: { id: c.attendance.id }, data: { isActive: false } });
            } else if (kind === "inactive-member" || kind === "nonmember") {
                if (kind === "inactive-member") {
                    await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: fixture.admin.id, isDeleted: true } });
                    await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, userId: fixture.admin.id } });
                }
                args.responses = [{ userId: parsePublicId<"User">((await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } })).publicId), attendanceId: parsePublicId<"EventAttendance">(c.attendance.publicId) }];
            } else {
                const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.change_others_event_responses } });
                await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
            }
        }
        const before = await captureState(tx);
        await expect(insertEvent(fixtureRoot(tx), c.auth, args)).rejects.toThrow();
        expect(await captureState(tx)).toEqual(before);
    }));

    it.each(["eventSegment", "eventSongListSong", "eventSegmentUserResponse", "change", "event"] as const)("rolls back rows/audits/hooks when %s persistence fails", delegateName => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Tune", description: "", aliases: "", visiblePermissionId: c.visibility.id } });
        const args = { ...c.args, songList: [{ songId: parsePublicId<"Song">(song.publicId), comment: "" }], responses: [{ userId: parsePublicId<"User">(c.person.publicId), attendanceId: parsePublicId<"EventAttendance">(c.attendance.publicId) }] };
        const error = new Error("Injected creation failure");
        const failing = new Proxy(tx, { get(target, key) {
            if (typeof key === "string" && key.toLowerCase() === delegateName.toLowerCase()) {
                return new Proxy(Reflect.get(target, key), { get(delegate, method) {
                    if (method === (delegateName === "event" ? "update" : "create")) {
                        return async () => { throw error; };
                    }
                    return Reflect.get(delegate, method);
                } });
            }
            return Reflect.get(target, key);
        } });
        const before = await captureState(tx);
        await expect(insertEvent(fixtureRoot(tx, failing), c.auth, args)).rejects.toThrow(error);
        expect(await captureState(tx)).toEqual(before);
    }));
});
