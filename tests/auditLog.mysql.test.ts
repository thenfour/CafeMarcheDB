import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser, type CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { DB3PaginatedQueryCore, queryTable, queryView } from "src/core/db3/server/db3QueryCore";
import { readAuditDetail, readAuditFilters } from "src/core/db3/server/audit/auditRead";
import { auditLogView } from "src/core/db3/shared/audit/auditViews";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

const snapshot = (tx: Prisma.TransactionClient, auth: CMServerAuthorization) => bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
const presentation = { routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] };
async function record(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, table: string, recordId: number, values: unknown) {
    return tx.change.create({ data: { action: "update", table, recordId, context: "Audit fixture", operationId: generatePublicId(),
        userId: fixture.admin.id, sessionHandle: "private-session-handle", newValues: JSON.stringify(values), oldValues: null,
    } });
}
async function contents(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) {
    const string = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(),
        values: { create: { publicId: generatePublicId(), localeId: fixture.frenchId, indexedValue: "Global status" } },
        bandValues: { create: [
        { publicId: generatePublicId(), localeId: fixture.frenchId, bandId: fixture.bands[0]!.id, indexedValue: "Premier statut" },
        { publicId: generatePublicId(), localeId: fixture.frenchId, bandId: fixture.bands[1]!.id, indexedValue: "Deuxieme statut" },
    ] } } });
    const description = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId() } });
    const status = await tx.eventStatus.create({ data: { publicId: generatePublicId(), nameId: string.id, descriptionId: description.id, sortOrder: 0 } });
    const events: Array<{ id: number; publicId: string; bandId: number; name: string }> = [];
    for (const [index, band] of fixture.bands.entries()) {
        events.push(await tx.event.create({ data: { publicId: generatePublicId(), bandId: band.id, revision: 1, name: `Historical event ${index}`,
            statusId: status.id, createdByUserId: fixture.admin.id, updatedByUserId: fixture.admin.id,
        } }));
    }
    return { events, status };
}

describe.skipIf(!settingsMysqlTestUrl)("audit browsing on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasourceUrl: settingsMysqlTestUrl } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());

    it("reads original immutable values through named and legacy audit grids", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const change = await record(tx, fixture, "Event", events[0]!.id, { id: events[0]!.id, userId: fixture.user.id, password: "old-password", nested: { token: "old-token" }, name: "Retained history" });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const context = await snapshot(tx, auth);
        const result = await queryView({ view: auditLogView, filter: { pks: [change.id] }, cmdbQueryContext: "audit grid" }, auth, context);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({ id: change.id, recordId: events[0]!.id, userId: fixture.admin.id, newValues: change.newValues });
        const legacy = await queryTable({ table: { tableID: "Change", tableName: "Change" }, filter: { pks: [change.id] }, orderBy: undefined,
            cmdbQueryContext: "forged legacy audit read",
        }, auth, context);
        expect(legacy.items[0]).toMatchObject({ sessionHandle: "private-session-handle", recordId: events[0]!.id, newValues: change.newValues });
        const detail = await readAuditDetail(context, auth, { ...presentation, changeId: change.id });
        expect(detail.user?.name).toBe("Platform fixture");
        expect(detail.newValues).toEqual(JSON.parse(change.newValues!));
        expect(await tx.change.findUnique({ where: { id: change.id } })).toEqual(change);
    }));
    it("keeps table/actor filters, pagination, quick search and newest-first ordering", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const first = await record(tx, fixture, "AuditFilterA", 90, { text: "First" });
        const second = await record(tx, fixture, "AuditFilterA", 91, { text: "Second" });
        await record(tx, fixture, "AuditFilterB", 92, { text: "Other" });
        const user = await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const context = await snapshot(tx, auth);
        const table = { tableID: auditLogView.tableID, tableName: auditLogView.tableName, viewID: auditLogView.viewID };
        const input = { table, filter: { tableParams: { tableNames: ["AuditFilterA"], userIds: [user.publicId] } }, orderBy: { id: "desc" as const }, skip: 0, take: 1, cmdbQueryContext: "audit page" };
        const result = await DB3PaginatedQueryCore(input, auth, context);
        expect(result.count).toBe(2);
        expect(result.items[0]?.id).toBe(second.id);
        expect((await DB3PaginatedQueryCore({ ...input, skip: 1 }, auth, context)).items[0]?.id).toBe(first.id);
        expect((await queryView({ view: auditLogView, filter: { quickFilterValues: ["AuditFilterA"] }, cmdbQueryContext: "audit quick filter" }, auth, context)).items).toHaveLength(2);
        const filters = await readAuditFilters(context, auth);
        expect(filters.tableNames).toContainEqual({ tableName: "AuditFilterA" });
        expect(filters.users).toContainEqual({ publicId: user.publicId, name: user.name, email: user.email });
        expect(JSON.stringify(filters)).not.toMatch(/"id":/);
    }));
    it("keeps original foreign keys and uses the target band for navigation across bands", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events, status } = await contents(tx, fixture);
        const auth = await loadAuthorizationForUser(fixture.admin, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId));
        for (const [index, event] of events.entries()) {
            const change = await record(tx, fixture, "Event", event.id, { id: event.id, bandId: event.bandId, statusId: status.id });
            const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, bandPublicId: parsePublicId<"Band">(fixture.bands[0]!.publicId), changeId: change.id });
            expect(detail.record?.bandPublicId).toBe(fixture.bands[index]!.publicId);
            expect(detail.record?.href).toContain(`/b/${fixture.bands[index]!.publicId}/`);
            expect(detail.record?.href).toContain("/fr-BE/");
            expect(detail.newValues).toEqual({ id: event.id, statusId: status.id, bandId: event.bandId });
        }
    }));
    it("formats Event labels with the referenced band's timezone and ordered formatting locale", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const zones = ["Europe/Brussels", "Asia/Tokyo"];
        const instant = new Date("2026-11-01T22:30:00Z");
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        for (const [index, event] of events.entries()) {
            const timeZone = zones[index]!;
            await tx.bandSetting.create({ data: { publicId: generatePublicId(), bandId: event.bandId,
                name: "dateTime.bandTimeZone", value: timeZone,
            } });
            await tx.event.update({ where: { id: event.id }, data: { startsAt: instant } });
            const change = await record(tx, fixture, "Event", event.id, { name: event.name });
            const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
            const date = new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "short", year: "numeric", timeZone }).format(instant);
            expect(detail.record?.label).toBe(`${event.name} (${date})`);
        }
    }));
    it("displays retired models and malformed historical text without attempting schema conversion", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const values = { id: 900001, songTagId: 900002, name: "Captured source", apiToken: "captured-token" };
        const change = await record(tx, fixture, "SongTag", 900001, values);
        const malformed = '{"password":"captured-fragment';
        await tx.change.update({ where: { id: change.id }, data: { oldValues: malformed } });
        const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(detail.record).toBeNull();
        expect(detail.newValues).toEqual(values);
        expect(detail.oldValues).toBe(malformed);
    }));
    it("retains deleted labels and captured history, and handles hard-deleted references without links", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const event = events[0]!;
        const change = await record(tx, fixture, "Event", event.id, { id: event.id, name: "Captured event name" });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        await tx.event.update({ where: { id: event.id }, data: { isDeleted: true } });
        const deleted = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(deleted.record).toMatchObject({ label: `${event.name} (TBD)`, deleted: true, href: null });
        await tx.event.delete({ where: { id: event.id } });
        const missing = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(missing.record).toBeNull();
        expect(missing.newValues).toEqual({ id: event.id, name: "Captured event name" });
        expect(await tx.change.findUnique({ where: { id: change.id } })).toEqual(change);
    }));
    it("retains response keys and resolves their parent event navigation", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const member = await tx.bandUser.findFirstOrThrow({ where: { bandId: fixture.bands[0]!.id, userId: fixture.user.id } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: events[0]!.id, name: "Segment", description: "", durationMillis: BigInt(0) } });
        const response = await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: segment.id, bandUserId: member.id } });
        const change = await record(tx, fixture, "EventSegmentUserResponse", response.id, { eventSegmentId: segment.id, bandUserId: member.id });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(detail.record?.href).toContain(`/backstage/event/${events[0]!.publicId}`);
        expect(detail.newValues).toEqual({ eventSegmentId: segment.id, bandUserId: member.id });
    }));
    it.each(["v1", "v2"])("preserves %s historical setlist IDs and parent navigation", version => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const song = await tx.song.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id,
            name: "Historical song", description: "", createdByUserId: fixture.admin.id,
        } });
        const list = await tx.eventSongList.create({ data: { publicId: generatePublicId(), eventId: events[0]!.id, name: "Setlist", description: "", sortOrder: 0 } });
        const songs = [{ id: 987, songId: song.id, sortOrder: 1, subtitle: "Encore" }];
        const values = version === "v1" ? songs : { songs, dividers: [{ sortOrder: 0, subtitle: "Break", isInterruption: true }] };
        const change = await record(tx, fixture, "EventSongList", list.id, values);
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(detail.record?.href).toContain(`/backstage/event/${events[0]!.publicId}`);
        expect(detail.newValues).toEqual(values);
    }));
    it("shows all File tags to Sysadmins regardless of the target's normal visibility", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.never_grant } });
        await tx.event.update({ where: { id: events[1]!.id }, data: { createdByUserId: fixture.user.id, visiblePermissionId: visibility.id } });
        const file = await tx.file.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[0]!.id, fileLeafName: "Audit.pdf",
            storedLeafName: "audit.pdf", description: "", uploadedByUserId: fixture.admin.id, uploadedAt: new Date(),
            taggedEvents: { create: events.map(event => ({ publicId: generatePublicId(), eventId: event.id })) },
        } });
        const change = await record(tx, fixture, "File", file.id, { fileLeafName: file.fileLeafName });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(detail.record?.label).toBe("Audit.pdf");
        expect(detail.related.map(item => item.publicId)).toEqual(events.map(event => event.publicId));
    }));
    it.each(["grants", "deleted", "merged"])("rejects stale %s authority in filters, detail and generic reads", reason => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const change = await record(tx, fixture, "User", fixture.user.id, { name: "Historical actor" });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const context = await snapshot(tx, auth);
        if (reason === "grants") {
            await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: null } });
        } else if (reason === "deleted") {
            await tx.user.update({ where: { id: fixture.admin.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: fixture.admin.id }, data: { mergedIntoUserId: fixture.user.id } });
        }
        await expect(readAuditFilters(context, auth)).rejects.toThrow();
        await expect(readAuditDetail(context, auth, { ...presentation, changeId: change.id })).rejects.toThrow();
        await expect(queryView({ view: auditLogView, filter: {}, cmdbQueryContext: "revoked audit" }, auth, context)).rejects.toThrow();
    }));
    it("lets Sysadmin authority alone read history, actors and current labels without feature grants", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const { events } = await contents(tx, fixture);
        const visibility = await tx.permission.findUniqueOrThrow({ where: { name: Permission.view_events_nonpublic } });
        await tx.event.update({ where: { id: events[0]!.id }, data: { createdByUserId: fixture.user.id, visiblePermissionId: visibility.id } });
        const change = await record(tx, fixture, "Event", events[0]!.id, { name: "Captured history", eventId: events[0]!.id });
        const role = await tx.globalRole.create({ data: { publicId: generatePublicId(), name: { create: { publicId: generatePublicId() } },
            permissions: { create: { publicId: generatePublicId(), permission: { connect: { name: Permission.sysadmin } } } },
        } });
        await tx.user.update({ where: { id: fixture.admin.id }, data: { globalRoleId: role.id } });
        const auth = await loadAuthorizationForUser(fixture.admin, tx, null);
        const detail = await readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id });
        expect(detail.record?.publicId).toBe(events[0]!.publicId);
        expect(detail.newValues).toEqual({ name: "Captured history", eventId: events[0]!.id });
        const context = await snapshot(tx, auth);
        const actor = await tx.user.findUniqueOrThrow({ where: { id: fixture.admin.id } });
        expect((await readAuditFilters(context, auth)).users).toContainEqual({ publicId: actor.publicId, name: actor.name, email: actor.email });
        const grid = await queryView({ view: auditLogView, filter: { pks: [change.id] }, cmdbQueryContext: "Sysadmin-only audit grants" }, auth, context);
        expect(grid.items[0]?.userId).toBe(actor.id);
        expect(detail.user).toEqual({ publicId: actor.publicId, name: actor.name });
    }));
    it("denies band administrators, roleless members, outsiders and anonymous actors", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const change = await record(tx, fixture, "User", fixture.user.id, {});
        const outsider = await tx.user.create({ data: { publicId: generatePublicId(), name: "Outsider", email: "outsider@test.invalid" } });
        const actors = [
            await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[0]!.publicId)),
            await loadAuthorizationForUser(fixture.user, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId)),
            await loadAuthorizationForUser(outsider, tx, null), await loadAuthorizationForUser(null, tx, null),
        ];
        for (const auth of actors) {
            await expect(readAuditFilters(await snapshot(tx, auth), auth)).rejects.toThrow();
            await expect(readAuditDetail(await snapshot(tx, auth), auth, { ...presentation, changeId: change.id })).rejects.toThrow();
        }
    }));
});
