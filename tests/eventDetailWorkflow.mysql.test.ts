import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot, type DB3ReadRootDatabase } from "src/core/db3/server/db3ReadExecution";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { readEventDetailPage } from "src/core/db3/server/eventDetailPage";
import { updateEventBasicFields, setEventRelevance, UpdateEventBasicFieldsSchema, SetEventRelevanceSchema } from "src/core/db3/server/eventEditing";
import { readSongPinnedRecordings } from "src/core/db3/server/songPinnedRecordings";
import { eventSegmentEditorView, xEventSegment } from "src/core/db3/db3";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

function transactionRoot(tx: Prisma.TransactionClient): DB3ReadRootDatabase {
    // The outer fixture owns the serializable transaction; each command gets atomic rollback.
    return { $transaction: async work => {
        await tx.$executeRawUnsafe("SAVEPOINT detail_command");
        try {
            return await work(tx);
        } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT detail_command");
            throw error;
        } finally {
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT detail_command");
        }
    } };
}

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const c = await prepareEventAttendanceFixture(tx, fixture, [Permission.manage_events, Permission.admin_events,
        Permission.edit_public_homepage, Permission.view_events_nonpublic, Permission.view_songs, Permission.view_files, Permission.visibility_members]);
    const target = { bandPublicId: c.args.bandPublicId, eventId: c.args.eventId };
    const root = transactionRoot(tx);
    const readPage = async (eventId = target.eventId) => readEventDetailPage(await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }), c.auth, { bandPublicId: target.bandPublicId, routeLocale: "fr-BE" }, eventId);
    return { ...c, target, root, readPage, edit: (patch: Omit<Parameters<typeof updateEventBasicFields>[2], keyof typeof target>) => updateEventBasicFields(root, c.auth, { ...target, ...patch }) };
}

describe.skipIf(!settingsMysqlTestUrl)("restored event detail and writes on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(async () => {
        vi.stubEnv("CMDB_BASE_URL", "https://event-detail.test.invalid");
        await initializeAccessControl(database);
    }, 30_000);
    afterAll(async () => { vi.unstubAllEnvs(); await database.$disconnect(); });
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("reads contextual metadata and rejects foreign, private and deleted event pages", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        expect(await c.readPage()).toMatchObject({ eventId: c.target.eventId });
        const invitationTag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id,
            bandUserTagAssignments: { create: { publicId: generatePublicId(), bandUserId: c.member.id } },
        } });
        await c.edit({ expectedAttendanceUserTagId: parsePublicId<"UserTag">(invitationTag.publicId) });
        expect(await c.readPage()).toMatchObject({ eventId: c.target.eventId });
        const other = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign title", revision: 1 } });
        expect(await c.readPage(parsePublicId<"Event">(other.publicId))).toBeNull();
        await tx.event.update({ where: { id: c.event.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        expect(await c.readPage()).toBeNull();
        await tx.event.update({ where: { id: c.event.id }, data: { createdByUserId: fixture.user.id } });
        expect(await c.readPage()).not.toBeNull();
        await tx.event.update({ where: { id: c.event.id }, data: { isDeleted: true } });
        expect(await c.readPage()).toBeNull();
    }));

    it("edits basic/frontpage values and relevance using public identities and shared audits", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.edit({ name: "Changed concert", locationDescription: "Square", frontpageTitle_fr: "Concert français", frontpageVisible: true });
        await setEventRelevance(c.root, c.auth, { ...c.target, relevanceClassOverrideName: "Pinned" });
        const event = await tx.event.findUniqueOrThrow({ where: { id: c.event.id } });
        expect(event).toMatchObject({ name: "Changed concert", locationDescription: "Square", frontpageTitle_fr: "Concert français", frontpageVisible: true, relevanceClassOverride: 1000 });
        expect(await tx.change.count({ where: { table: "Event", recordId: c.event.id } })).toBeGreaterThan(0);
        await setEventRelevance(c.root, c.auth, { ...c.target, relevanceClassOverrideName: null });
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).relevanceClassOverride).toBeNull();
    }));

    it("keeps segment dates and event range/revision synchronized", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const start = new Date("2099-01-03T10:00:00Z");
        const command = eventSegmentEditorView.crud.operations.update.command;
        const dto = command.parseDto({ identity: parsePublicId<"EventSegment">(c.event.segments[0]!.publicId), patch: { startsAt: start, durationMillis: 7200000, isAllDay: false } });
        await createCommandRowServices(c.auth, tx).update(xEventSegment, dto.identity, dto.patch);
        const event = await tx.event.findUniqueOrThrow({ where: { id: c.event.id } });
        expect(event.revision).toBeGreaterThan(c.event.revision);
        expect(event.endDateTime).toEqual(new Date("2099-01-03T12:00:00Z"));
    }));

    it("creates and deletes own segments while refusing foreign segment writes", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const services = createCommandRowServices(c.auth, tx);
        const segment = await services.insert(xEventSegment, { eventId: c.target.eventId, name: "Extra", description: "", startsAt: null, durationMillis: 3600000, isAllDay: true });
        await services.delete(xEventSegment, xEventSegment.parseIdentity(segment.publicId), "hard");
        expect(await tx.eventSegment.findUnique({ where: { publicId: segment.publicId } })).toBeNull();
        const foreign = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign", revision: 1,
            segments: { create: { publicId: generatePublicId(), name: "Foreign set", description: "", durationMillis: 3600000 } },
        }, include: { segments: true } });
        const foreignId = xEventSegment.parseIdentity(foreign.segments[0]!.publicId);
        await expect(services.update(xEventSegment, foreignId, { name: "Wrong band" })).rejects.toThrow();
        await expect(services.delete(xEventSegment, foreignId, "hard")).rejects.toThrow();
    }));

    it("changes invitation groups and rejects hidden/foreign catalog targets atomically", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const tag = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), bandId: c.band.id } });
        await c.edit({ expectedAttendanceUserTagId: parsePublicId<"UserTag">(tag.publicId) });
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).expectedAttendanceUserTagId).toBe(tag.id);
        for (const data of [{ bandId: fixture.bands[1]!.id }, { bandId: c.band.id, isHidden: true }]) {
            const bad = await tx.bandUserTag.create({ data: { publicId: generatePublicId(), ...data } });
            await expect(c.edit({ name: "Must roll back", expectedAttendanceUserTagId: parsePublicId<"UserTag">(bad.publicId) })).rejects.toThrow();
        }
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).name).toBe("Concert");
        await c.edit({ expectedAttendanceUserTagId: null });
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).expectedAttendanceUserTagId).toBeNull();
    }));

    it("refreshes revoked grants and rejects mismatched band/foreign write targets", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const foreign = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign", revision: 1 } });
        await expect(updateEventBasicFields(c.root, c.auth, { ...c.target, eventId: parsePublicId<"Event">(foreign.publicId), name: "Changed" })).rejects.toThrow();
        await expect(updateEventBasicFields(c.root, c.auth, { ...c.target, bandPublicId: parsePublicId<"Band">(fixture.bands[1]!.publicId), name: "Changed" })).rejects.toThrow();
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.edit_public_homepage } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: grant.id } });
        await expect(c.edit({ name: "Revoked" })).rejects.toThrow();
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).name).toBe("Concert");
    }));

    it("rejects invalid write envelopes before mutation", () => {
        const target = { bandPublicId: "FixtureBand00001", eventId: "FixtureEvent0001" };
        expect(() => UpdateEventBasicFieldsSchema.parse({ ...target, name: "Valid" })).not.toThrow();
        for (const fields of [{ bandId: 7 }, { createdByUserId: 1 }, { expectedAttendanceUserTagId: 42 }, { name: 42 }]) {
            expect(() => UpdateEventBasicFieldsSchema.parse({ ...target, ...fields })).toThrow();
        }
        expect(() => SetEventRelevanceSchema.parse({ ...target, relevanceClassOverrideName: "forged" })).toThrow();
    });

    it.each(["roleless", "inactive", "deleted", "merged", "anonymous", "unscoped", "outsider"])("refuses %s event edits", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        let auth = c.auth;
        if (kind === "roleless") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { bandRoleId: null } });
        } else if (kind === "inactive") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (kind === "deleted" || kind === "merged") {
            await tx.user.update({ where: { id: fixture.user.id }, data: kind === "deleted"
                ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        } else {
            const outsider = kind === "outsider" ? await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "outside@event-detail.test.invalid" } }) : null;
            auth = await loadAuthorizationForUser(kind === "anonymous" ? null : outsider ?? fixture.user,
                tx, kind === "unscoped" ? undefined : c.target.bandPublicId);
        }
        await expect(updateEventBasicFields(c.root, auth, { ...c.target, name: "Denied edit" })).rejects.toThrow();
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).name).toBe("Concert");
    }));

    it("filters pinned songs and files independently and rechecks band grants", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.visibility_members } });
        const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId: c.band.id, fileLeafName: "sample.wav", storedLeafName: generatePublicId(), description: "", uploadedAt: new Date(), mimeType: "audio/wav", visiblePermissionId: visibility.id } });
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Song", description: "", aliases: "", visiblePermissionId: visibility.id, pinnedRecordingId: file.id } });
        const songId = parsePublicId<"Song">(song.publicId);
        const read = async () => readSongPinnedRecordings(await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" }), c.auth, { bandPublicId: c.target.bandPublicId, songIds: [songId] });
        expect(await read()).toMatchObject({ [songId]: { publicId: file.publicId, fileLeafName: "sample.wav" } });
        await tx.file.update({ where: { id: file.id }, data: { visiblePermissionId: null, uploadedByUserId: fixture.admin.id } });
        expect(await read()).toEqual({});
        await tx.file.update({ where: { id: file.id }, data: { uploadedByUserId: fixture.user.id } });
        expect(await read()).toHaveProperty(songId);
        await tx.file.update({ where: { id: file.id }, data: { isDeleted: true } });
        expect(await read()).toEqual({});
        await tx.file.update({ where: { id: file.id }, data: { isDeleted: false, bandId: fixture.bands[1]!.id } });
        expect(await read()).toEqual({});
        await tx.file.update({ where: { id: file.id }, data: { bandId: c.band.id } });
        await tx.song.update({ where: { id: song.id }, data: { bandId: fixture.bands[1]!.id } });
        expect(await read()).toEqual({});
        await tx.song.update({ where: { id: song.id }, data: { bandId: c.band.id } });
        await tx.song.update({ where: { id: song.id }, data: { isDeleted: true } });
        expect(await read()).toEqual({});
        await tx.song.update({ where: { id: song.id }, data: { isDeleted: false, visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        expect(await read()).toEqual({});
        await tx.song.update({ where: { id: song.id }, data: { visiblePermissionId: visibility.id } });
        const grant = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_songs } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: grant.id } });
        await expect(read()).rejects.toThrow();
        const platform = await loadAuthorizationForUser(fixture.admin, tx);
        await expect(readSongPinnedRecordings(await bindDB3ReadSnapshot(tx, platform, { isolationLevel: "Serializable" }), platform,
            { bandPublicId: c.target.bandPublicId, songIds: [songId] })).rejects.toThrow();
    }));
});
