import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import {
    clearEventSegmentResponses, clearEventSegmentResponsesInTransaction,
    copyEventSegmentResponses, copyEventSegmentResponsesInTransaction,
} from "src/core/db3/server/eventAttendanceBulk";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture, responseGrants } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

async function prepare(tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture, grants: Permission[] = [...responseGrants, Permission.admin_events]) {
    const c = await prepareEventAttendanceFixture(tx, fixture, grants);
    const members = [c.member];
    for (const name of ["Unchanged", "Added", "Removed"]) {
        const user = await tx.user.create({ data: { publicId: generatePublicId(), name, email: `${name}@bulk.test.invalid` } });
        members.push(await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: user.id } }));
    }
    const source = c.event.segments[0]!;
    const target = c.event.segments[1]!;
    for (const [index, attendanceId] of [[0, c.attendance.id], [1, null], [2, c.attendance.id]] as const) {
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: source.id, bandUserId: members[index]!.id, attendanceId } });
    }
    for (const [index, attendanceId] of [[0, null], [1, null], [3, c.attendance.id]] as const) {
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: target.id, bandUserId: members[index]!.id, attendanceId } });
    }
    for (const index of [0, 1, 3]) {
        await tx.eventUserResponse.create({ data: { publicId: generatePublicId(), eventId: c.event.id, bandUserId: members[index]!.id,
            revision: index === 0 ? 4 : 6, userComment: "Keep comment", isInvited: false, bandInstrumentId: c.instrument.id } });
    }
    const copyArgs = { bandPublicId: c.args.bandPublicId, fromEventSegmentId: parsePublicId<"EventSegment">(source.publicId), toEventSegmentId: parsePublicId<"EventSegment">(target.publicId) };
    const clearArgs = { bandPublicId: c.args.bandPublicId, eventSegmentId: parsePublicId<"EventSegment">(target.publicId) };
    const copy = () => copyEventSegmentResponsesInTransaction(tx, c.auth, copyArgs);
    const clear = () => clearEventSegmentResponsesInTransaction(tx, c.auth, clearArgs);
    return { ...c, members, source, target, copyArgs, clearArgs, copy, clear };
}

async function captureState(tx: Prisma.TransactionClient, eventId: number) {
    return {
        event: await tx.event.findUniqueOrThrow({ where: { id: eventId } }),
        answers: await tx.eventSegmentUserResponse.findMany({ where: { eventSegment: { eventId } }, orderBy: { id: "asc" } }),
        responses: await tx.eventUserResponse.findMany({ where: { eventId }, orderBy: { id: "asc" } }),
        audit: await tx.change.findMany({ orderBy: { id: "asc" } }),
    };
}

describe.skipIf(!settingsMysqlTestUrl)("bulk membership attendance on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    beforeEach(() => { vi.stubEnv("CMDB_BASE_URL", "https://bulk.test.invalid"); });
    afterEach(() => { vi.unstubAllEnvs(); });
    afterAll(() => database.$disconnect());
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("replaces destination answers, preserves unchanged identities and metadata, and revisions only affected memberships", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const before = await captureState(tx, c.event.id);
        expect(await c.copy()).toBeNull();
        const after = await captureState(tx, c.event.id);
        expect(after.answers.filter(row => row.eventSegmentId === c.source.id)).toEqual(before.answers.filter(row => row.eventSegmentId === c.source.id));
        const target = after.answers.filter(row => row.eventSegmentId === c.target.id);
        expect(target.map(row => [row.bandUserId, row.attendanceId]).sort()).toEqual([
            [c.members[0]!.id, c.attendance.id], [c.members[1]!.id, null], [c.members[2]!.id, c.attendance.id],
        ].sort());
        const unchanged = before.answers.find(row => row.eventSegmentId === c.target.id && row.bandUserId === c.members[1]!.id)!;
        expect(target.find(row => row.id === unchanged.id)).toEqual(unchanged);
        expect(target.find(row => row.bandUserId === c.member.id)).toMatchObject({ updatedByUserId: c.person.id });
        expect(target.find(row => row.bandUserId === c.members[2]!.id)).toMatchObject({ createdByUserId: c.person.id, updatedByUserId: c.person.id });
        expect(after.responses.find(row => row.bandUserId === c.member.id)).toMatchObject({ revision: 5, userComment: "Keep comment", isInvited: false, bandInstrumentId: c.instrument.id });
        expect(after.responses.find(row => row.bandUserId === c.members[1]!.id)!.revision).toBe(6);
        expect(after.responses.find(row => row.bandUserId === c.members[2]!.id)).toMatchObject({ revision: 1, userComment: "", isInvited: null, bandInstrumentId: null });
        expect(after.responses.find(row => row.bandUserId === c.members[3]!.id)!.revision).toBe(7);
        expect(after.event.revision).toBe(2);
        expect(after.audit).toHaveLength(4);
        expect(new Set(after.audit.map(row => row.operationId)).size).toBe(1);
        expect(after.audit.every(row => row.userId === c.person.id)).toBe(true);
        const bulkAudit = after.audit.find(row => row.table === "EventSegmentUserResponse")!;
        expect(bulkAudit.recordId).toBe(c.target.id);
        expect(JSON.parse(bulkAudit.newValues!)).toContainEqual({ bandUserId: c.members[1]!.id, attendanceId: null });
    }));

    it("treats repeated copies and empty clears as no-ops", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.copy();
        const copied = await captureState(tx, c.event.id);
        await c.copy();
        expect(await captureState(tx, c.event.id)).toEqual(copied);
        await c.clear();
        const cleared = await captureState(tx, c.event.id);
        expect(cleared.answers.filter(row => row.eventSegmentId === c.target.id)).toEqual([]);
        expect(cleared.answers.filter(row => row.eventSegmentId === c.source.id)).toEqual(copied.answers.filter(row => row.eventSegmentId === c.source.id));
        expect(cleared.event.revision).toBe(copied.event.revision);
        await c.clear();
        expect(await captureState(tx, c.event.id)).toEqual(cleared);
    }));

    it("copies an empty source by clearing the destination and bumps each affected response once", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.eventSegmentUserResponse.deleteMany({ where: { eventSegmentId: c.source.id } });
        await c.copy();
        expect(await tx.eventSegmentUserResponse.count()).toBe(0);
        expect((await tx.eventUserResponse.findUniqueOrThrow({ where: { bandUserId_eventId: { bandUserId: c.member.id, eventId: c.event.id } } })).revision).toBe(5);
        expect((await tx.eventUserResponse.findUniqueOrThrow({ where: { bandUserId_eventId: { bandUserId: c.members[1]!.id, eventId: c.event.id } } })).revision).toBe(7);
        expect(await tx.eventUserResponse.count()).toBe(3);
        const audit = await tx.change.findFirstOrThrow({ where: { table: "EventSegmentUserResponse" } });
        expect(JSON.parse(audit.oldValues!)).toHaveLength(3);
        expect(JSON.parse(audit.newValues!)).toEqual([]);
    }));

    it("audits clearing explicit unanswered records", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.eventSegmentUserResponse.deleteMany({ where: { eventSegmentId: c.target.id, attendanceId: { not: null } } });
        await c.clear();
        const audit = await tx.change.findFirstOrThrow({ where: { table: "EventSegmentUserResponse" } });
        expect(JSON.parse(audit.oldValues!)).toEqual(c.members.slice(0, 2).map(member => ({ bandUserId: member.id, attendanceId: null })));
        expect(audit.action).toBe("delete");
    }));

    it.each(["membership", "person", "merged"])("preserves existing history for a former %s and retired choice", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.eventAttendance.update({ where: { id: c.attendance.id }, data: { isDeleted: true, isActive: false } });
        const member = c.members[2]!;
        if (kind === "membership") {
            await tx.bandUser.update({ where: { id: member.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: member.userId }, data: kind === "person" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        }
        await c.copy();
        expect(await tx.eventSegmentUserResponse.findUniqueOrThrow({ where: { bandUserId_eventSegmentId: { bandUserId: member.id, eventSegmentId: c.target.id } } })).toMatchObject({ attendanceId: c.attendance.id });
        await c.clear();
        expect(await tx.eventSegmentUserResponse.count({ where: { eventSegmentId: c.target.id } })).toBe(0);
    }));

    it.each(["source", "target"])("rejects an inconsistent foreign-band membership in the %s before any write", side => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const member = await tx.bandUser.findUniqueOrThrow({ where: { bandId_userId: { bandId: fixture.bands[1]!.id, userId: c.person.id } } });
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), eventSegmentId: side === "source" ? c.source.id : c.target.id, bandUserId: member.id, attendanceId: c.attendance.id } });
        const before = await captureState(tx, c.event.id);
        await expect(c.copy()).rejects.toThrow();
        if (side === "target") {
            await expect(c.clear()).rejects.toThrow();
        }
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));

    it.each(["source", "target"])("rejects a foreign-band %s segment", side => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Foreign", revision: 1, createdByUserId: c.person.id } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Foreign set", description: "", durationMillis: BigInt(0) } });
        const args = { ...c.copyArgs, ...(side === "source" ? { fromEventSegmentId: parsePublicId<"EventSegment">(segment.publicId) } : { toEventSegmentId: parsePublicId<"EventSegment">(segment.publicId) }) };
        const before = await captureState(tx, c.event.id);
        await expect(copyEventSegmentResponsesInTransaction(tx, c.auth, args)).rejects.toThrow();
        await expect(clearEventSegmentResponsesInTransaction(tx, c.auth, { ...c.clearArgs, eventSegmentId: parsePublicId<"EventSegment">(segment.publicId) })).rejects.toThrow();
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));

    it("rejects same-band cross-event copies and unknown segments", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Other", revision: 1, createdByUserId: c.person.id } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: event.id, name: "Other set", description: "", durationMillis: BigInt(0) } });
        const before = await captureState(tx, c.event.id);
        await expect(copyEventSegmentResponsesInTransaction(tx, c.auth, { ...c.copyArgs, toEventSegmentId: parsePublicId<"EventSegment">(segment.publicId) })).rejects.toThrow("same event");
        await expect(copyEventSegmentResponsesInTransaction(tx, c.auth, { ...c.copyArgs, toEventSegmentId: generatePublicId<"EventSegment">() })).rejects.toThrow();
        await expect(clearEventSegmentResponsesInTransaction(tx, c.auth, { ...c.clearArgs, eventSegmentId: generatePublicId<"EventSegment">() })).rejects.toThrow();
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));

    it.each(["private", "deleted"])("rejects a %s parent event", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.event.update({ where: { id: c.event.id }, data: kind === "private" ? { visiblePermissionId: null, createdByUserId: fixture.admin.id } : { isDeleted: true } });
        const before = await captureState(tx, c.event.id);
        await expect(c.copy()).rejects.toThrow();
        await expect(c.clear()).rejects.toThrow();
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));

    it("allows the private event's creator and does not substitute response/manage grants for admin authority", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...responseGrants, Permission.manage_events, Permission.change_others_event_responses]);
        await tx.event.update({ where: { id: c.event.id }, data: { visiblePermissionId: null, createdByUserId: c.person.id } });
        await expect(c.copy()).rejects.toThrow(Permission.admin_events);
        await expect(c.clear()).rejects.toThrow(Permission.admin_events);
        const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_events } });
        await tx.bandRolePermission.create({ data: { publicId: generatePublicId(), bandRoleId: c.role.id, permissionId: permission.id } });
        await c.copy();
        await c.clear();
    }));

    it.each(["grant", "membership", "person", "merged", "band"])("refreshes a revoked/deleted %s before copy or clear", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        if (kind === "grant") {
            const permission = await tx.permission.findUniqueOrThrow({ where: { name: Permission.admin_events } });
            await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: permission.id } });
        } else if (kind === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        } else if (kind === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        } else {
            await tx.user.update({ where: { id: c.person.id }, data: kind === "person" ? { isDeleted: true } : { mergedIntoUserId: fixture.admin.id } });
        }
        const before = await captureState(tx, c.event.id);
        await expect(c.copy()).rejects.toThrow();
        await expect(c.clear()).rejects.toThrow();
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));

    it("requires an authenticated selected-band context", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (const auth of [await loadAuthorizationForUser(null, tx, c.args.bandPublicId), await loadAuthorizationForUser(c.person, tx), await loadAuthorizationForUser(c.person, tx, parsePublicId<"Band">(fixture.bands[1]!.publicId))]) {
            await expect(copyEventSegmentResponsesInTransaction(tx, auth, c.copyArgs)).rejects.toThrow();
            await expect(clearEventSegmentResponsesInTransaction(tx, auth, c.clearArgs)).rejects.toThrow();
        }
        expect(await tx.change.count()).toBe(0);
    }));

    it.each([
        ["copy", "create"], ["copy", "audit"], ["copy", "revision"], ["copy", "calendar"],
        ["clear", "audit"], ["clear", "revision"], ["clear", "calendar"],
    ] as const)("rolls back %s when %s fails, including revisions and audits", (operation, failure) => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const before = await captureState(tx, c.event.id);
        const error = new Error("Injected bulk failure");
        const delegateName = failure === "create" ? "eventSegmentUserResponse" : failure === "audit" ? "change" : failure === "revision" ? "eventUserResponse" : "event";
        const methodName = failure === "create" || failure === "audit" ? "create" : "update";
        // Prisma exposes delegates through proxies; replace only the failing method, retaining real database work.
        const failing = new Proxy(tx, { get(target, key) {
            if (key === delegateName) {
                return new Proxy(Reflect.get(target, key), { get(delegate, method) {
                    if (method === methodName) {
                        return async () => { throw error; };
                    }
                    return Reflect.get(delegate, method);
                } });
            }
            return Reflect.get(target, key);
        } });
        const root = { $transaction: async <T>(work: (inner: Prisma.TransactionClient) => Promise<T>, policy: { isolationLevel: "Serializable" | "RepeatableRead" }) => {
            expect(policy.isolationLevel).toBe("Serializable");
            // A savepoint composes the production transaction wrapper with this fixture's Serializable transaction.
            await tx.$executeRawUnsafe("SAVEPOINT bulk_operation");
            try {
                return await work(failing);
            } catch (caught) {
                await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT bulk_operation");
                throw caught;
            } finally {
                await tx.$executeRawUnsafe("RELEASE SAVEPOINT bulk_operation");
            }
        } };
        await expect(operation === "copy" ? copyEventSegmentResponses(root, c.auth, c.copyArgs) : clearEventSegmentResponses(root, c.auth, c.clearArgs)).rejects.toThrow(error);
        expect(await captureState(tx, c.event.id)).toEqual(before);
    }));
});
