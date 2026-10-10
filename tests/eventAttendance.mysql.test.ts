import { PrismaClient, type Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { bindDB3ReadSnapshot } from "src/core/db3/server/db3ReadExecution";
import { loadDashboardData } from "src/core/db3/server/db3DashboardData";
import { hydrateDashboardData } from "src/core/db3/shared/references/dashboardData";
import { eventParticipantFromMembership } from "src/core/db3/shared/entities/user/eventParticipant";
import { getInstrumentForEventUserResponse } from "src/core/db3/shared/schema/eventAPI";
import { readUserEventAttendance } from "src/core/db3/server/eventAttendanceRead";
import { updateEventAttendance, updateEventAttendanceInTransaction } from "src/core/db3/server/eventAttendanceWrite";
import { generatePublicId } from "src/server/publicId";
import { initializeAccessControl } from "src/setup/accessControl";
import { prepareEventAttendanceFixture as prepare, responseGrants } from "./support/eventAttendanceMysqlFixture";
import { settingsMysqlTestUrl, withSettingsMysqlFixture, type SettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("membership-owned event attendance on MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    beforeEach(() => { vi.stubEnv("CMDB_BASE_URL", "https://attendance.test.invalid"); });
    afterEach(() => { vi.unstubAllEnvs(); });
    afterAll(() => database.$disconnect());
    const fixtureTest = (work: (tx: Prisma.TransactionClient, fixture: SettingsMysqlFixture) => Promise<void>) => withSettingsMysqlFixture(database, work);

    it("writes a batch with public transport IDs, membership ownership, actor auditing and one response revision", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...responseGrants, Permission.manage_events]);
        const result = await c.write({ comment: "Need a lift", instrumentId: parsePublicId<"Instrument">(c.instrument.publicId), isInvited: false, segmentResponses: c.answers });
        expect(result).toMatchObject({ ...c.args, comment: "Need a lift" });
        expect(result).not.toHaveProperty("bandUserId");
        const response = await tx.eventUserResponse.findFirstOrThrow({ where: { eventId: c.event.id } });
        expect(response).toMatchObject({ bandUserId: c.member.id, bandInstrumentId: c.instrument.id, userComment: "Need a lift", isInvited: false, revision: 1 });
        expect(await tx.eventSegmentUserResponse.findMany()).toEqual(expect.arrayContaining(c.event.segments.map(segment => expect.objectContaining({ bandUserId: c.member.id, eventSegmentId: segment.id, attendanceId: c.attendance.id, createdByUserId: c.person.id, updatedByUserId: c.person.id }))));
        const audit = await tx.change.findMany({ where: { context: "updateUserEventAttendance" } });
        expect(audit).toHaveLength(3);
        expect(new Set(audit.map(row => row.operationId)).size).toBe(1);
        expect(audit.every(row => row.userId === c.person.id)).toBe(true);
        const event = await tx.event.findUniqueOrThrow({ where: { id: c.event.id } });
        expect(event).toMatchObject({ revision: 2, startsAt: c.event.startsAt, durationMillis: BigInt(7200000) });
        expect(event.calendarInputHash).toBeTruthy();
    }));

    it("keeps repeats idempotent and increments exactly once for multi-segment clears", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ segmentResponses: c.answers, comment: "" });
        const before = await tx.change.count();
        await c.write({ segmentResponses: c.answers, comment: "" });
        expect(await tx.change.count()).toBe(before);
        expect((await tx.eventUserResponse.findFirstOrThrow()).revision).toBe(1);
        await c.write({ segmentResponses: Object.fromEntries(c.event.segments.map(segment => [segment.publicId, { attendanceId: null }])), comment: null });
        expect((await tx.eventUserResponse.findFirstOrThrow()).revision).toBe(2);
        expect((await tx.eventSegmentUserResponse.findMany()).every(row => row.attendanceId === null)).toBe(true);
        expect((await tx.event.findUniqueOrThrow({ where: { id: c.event.id } })).revision).toBe(2);
    }));

    it.each(["event", "segment", "instrument"])("rejects a foreign-band %s before any write", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const foreign = await tx.event.create({ data: { publicId: generatePublicId(), bandId: fixture.bands[1]!.id, name: "Other band", revision: 1 } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: foreign.id, name: "Other set", description: "", durationMillis: BigInt(0) } });
        const group = await tx.bandInstrumentFunctionalGroup.create({ data: { publicId: generatePublicId(), bandId: foreign.bandId } });
        const instrument = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: foreign.bandId, functionalGroupId: group.id } });
        const patch = kind === "event" ? { eventId: parsePublicId<"Event">(foreign.publicId) }
            : kind === "segment" ? { segmentResponses: { ...c.answers, [segment.publicId]: { attendanceId: null } } }
                : { instrumentId: parsePublicId<"Instrument">(instrument.publicId) };
        await expect(c.write({ comment: "Must roll back", ...patch })).rejects.toThrow();
        expect(await tx.eventUserResponse.count()).toBe(0);
        expect(await tx.eventSegmentUserResponse.count()).toBe(0);
        expect(await tx.change.count()).toBe(0);
    }));

    it.each(["inactive", "deleted", "unknown"])("rejects %s choices atomically and retains retired history", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ segmentResponses: c.answers });
        await tx.eventAttendance.update({ where: { id: c.attendance.id }, data: kind === "inactive" ? { isActive: false } : { isDeleted: true } });
        expect((await c.read()).segmentResponses[0]!.attendanceId).toBe(c.attendance.publicId);
        const before = await tx.change.count();
        const attendanceId = kind === "unknown" ? generatePublicId<"EventAttendance">() : parsePublicId<"EventAttendance">(c.attendance.publicId);
        await expect(c.write({ comment: "Reject", segmentResponses: { [c.event.segments[0]!.publicId]: { attendanceId } } })).rejects.toThrow();
        expect(await tx.change.count()).toBe(before);
        expect((await tx.eventUserResponse.findFirstOrThrow()).userComment).toBe("");
        await c.write({ segmentResponses: { [c.event.segments[0]!.publicId]: { attendanceId: null } } });
        expect((await c.read()).segmentResponses[0]!.attendanceId).toBeNull();
    }));

    it("uses independent self, delegate and invitation grants and refreshes revoked grants", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...responseGrants, Permission.change_others_event_responses]);
        const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Target", email: "attendance@test.invalid" } });
        const target = await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: person.id } });
        const userId = parsePublicId<"User">(person.publicId);
        await c.write({ userId, comment: "By delegate", segmentResponses: c.answers });
        expect((await tx.eventUserResponse.findFirstOrThrow()).bandUserId).toBe(target.id);
        expect((await tx.eventSegmentUserResponse.findFirstOrThrow()).updatedByUserId).toBe(c.person.id);
        await expect(c.write({ userId, comment: "No mixed write", isInvited: true })).rejects.toThrow(`required: ${Permission.manage_events}`);
        const changeOthers = await tx.permission.findUniqueOrThrow({ where: { name: Permission.change_others_event_responses } });
        await tx.bandRolePermission.deleteMany({ where: { bandRoleId: c.role.id, permissionId: changeOthers.id } });
        await expect(c.write({ userId, comment: "Revoked" })).rejects.toThrow(`required: ${Permission.change_others_event_responses}`);
        expect((await tx.eventUserResponse.findFirstOrThrow()).userComment).toBe("By delegate");
        await c.write({ comment: "Self still allowed" });
    }));

    it("allows invitations without response authority and rejects mixed response edits", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [Permission.manage_events, Permission.visibility_members]);
        const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Invitee", email: "invite@test.invalid" } });
        await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: c.band.id, userId: person.id } });
        const userId = parsePublicId<"User">(person.publicId);
        await c.write({ userId, isInvited: false });
        await expect(c.write({ userId, isInvited: true, comment: "No" })).rejects.toThrow(`required: ${Permission.change_others_event_responses}`);
        expect((await tx.eventUserResponse.findFirstOrThrow()).isInvited).toBe(false);
        await c.write({ userId, isInvited: null });
        expect(await tx.eventUserResponse.findFirstOrThrow()).toMatchObject({ isInvited: null, revision: 2 });
        await expect(c.write({ comment: "No self permission" })).rejects.toThrow(`required: ${Permission.respond_to_events}`);
    }));

    it.each(["membership", "person", "merged", "event", "band", "role"])("rejects a stale %s on subsequent reads and writes", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ comment: "Original" });
        if (kind === "membership") {
            await tx.bandUser.update({ where: { id: c.member.id }, data: { isDeleted: true } });
        }
        if (kind === "person") {
            await tx.user.update({ where: { id: c.person.id }, data: { isDeleted: true } });
        }
        if (kind === "merged") {
            await tx.user.update({ where: { id: c.person.id }, data: { mergedIntoUserId: fixture.admin.id } });
        }
        if (kind === "event") {
            await tx.event.update({ where: { id: c.event.id }, data: { isDeleted: true } });
        }
        if (kind === "band") {
            await tx.band.update({ where: { id: c.band.id }, data: { isDeleted: true } });
        }
        if (kind === "role") {
            await tx.bandRole.update({ where: { id: c.role.id }, data: { isDeleted: true } });
        }
        await expect(c.write({ comment: "Stale" })).rejects.toThrow();
        await expect(c.read()).rejects.toThrow();
        expect((await tx.eventUserResponse.findFirstOrThrow()).userComment).toBe("Original");
    }));

    it("keeps the same person's memberships separate and rejects omitted or mismatched band context", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const band = fixture.bands[1]!;
        await tx.bandUser.update({ where: { bandId_userId: { bandId: band.id, userId: c.person.id } }, data: { bandRoleId: c.role.id } });
        const auth = await loadAuthorizationForUser(c.person, tx, parsePublicId<"Band">(band.publicId));
        const event = await tx.event.create({ data: { publicId: generatePublicId(), bandId: band.id, name: "Second band", revision: 1, createdByUserId: c.person.id, startsAt: new Date("2099-02-01") } });
        const args = { bandPublicId: parsePublicId<"Band">(band.publicId), userId: c.args.userId, eventId: parsePublicId<"Event">(event.publicId), comment: "Second" };
        await updateEventAttendanceInTransaction(tx, auth, args);
        await c.write({ comment: "First" });
        expect((await c.read()).comment).toBe("First");
        const secondRead = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
        expect((await readUserEventAttendance(secondRead, auth, { bandPublicId: args.bandPublicId, userId: args.userId, eventId: args.eventId })).comment).toBe("Second");
        await expect(updateEventAttendanceInTransaction(tx, auth, { ...c.args, comment: "Wrong context" })).rejects.toThrow();
        // Forged transport deliberately omits required context.
        await expect(c.write({ bandPublicId: undefined } as unknown as Parameters<typeof c.write>[0])).rejects.toThrow();
        expect((await c.history()).events.map(row => row.name)).toEqual(["Concert"]);
    }));

    it("projects public history/API references, intentional blanks/false and prior responses plus future events", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...responseGrants, Permission.manage_events]);
        await tx.event.update({ where: { id: c.event.id }, data: { startsAt: new Date("2020-01-01") } });
        await c.write({ comment: "", isInvited: false, instrumentId: parsePublicId<"Instrument">(c.instrument.publicId) });
        await tx.eventSegmentUserResponse.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, eventSegmentId: c.event.segments[0]!.id, attendanceId: c.attendance.id } });
        await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Before history", revision: 1, createdByUserId: c.person.id, startsAt: new Date("2010-01-01") } });
        await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Future", revision: 1, createdByUserId: c.person.id, startsAt: new Date("2099-05-01") } });
        const api = await c.read();
        expect(api).toMatchObject({ comment: "", instrumentId: c.instrument.publicId, segmentResponses: [{ segmentId: c.event.segments[0]!.publicId, attendanceId: c.attendance.publicId, durationMillis: 3600000 }] });
        expect(() => JSON.stringify(api)).not.toThrow();
        const history = await c.history();
        expect(history.events.map(row => row.name)).toEqual(["Future", "Concert"]);
        expect(history.events[1]).toMatchObject({ userComment: "", isInvited: false, instrumentId: c.instrument.publicId });
        expect((await c.history(1)).events.map(row => row.name)).toEqual(["Future"]);
        for (const row of history.events) {
            expect(row).not.toHaveProperty("id");
            expect(row).not.toHaveProperty("bandUserId");
            expect(row).not.toHaveProperty("bandId");
        }
    }));

    it("hides private events from other members and allows the creator", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await tx.event.update({ where: { id: c.event.id }, data: { visiblePermissionId: null, createdByUserId: fixture.admin.id } });
        await expect(c.write({ comment: "Hidden" })).rejects.toThrow();
        await expect(c.read()).rejects.toThrow();
        expect((await c.history()).events).toEqual([]);
        await tx.event.update({ where: { id: c.event.id }, data: { createdByUserId: c.person.id } });
        await c.write({ comment: "Owner" });
        expect((await c.read()).comment).toBe("Owner");
    }));

    it.each(["nonmember", "membership", "deleted", "merged"])("rejects a %s target person even with delegate authority", kind => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture, [...responseGrants, Permission.change_others_event_responses]);
        const person = await tx.user.create({ data: { publicId: generatePublicId(), name: "Target", email: "target@test.invalid", isDeleted: kind === "deleted", mergedIntoUserId: kind === "merged" ? fixture.admin.id : null } });
        await tx.bandUser.create({ data: { publicId: generatePublicId(), bandId: kind === "nonmember" ? fixture.bands[1]!.id : c.band.id, userId: person.id, isDeleted: kind === "membership" } });
        await expect(c.write({ userId: parsePublicId<"User">(person.publicId), comment: "Forbidden" })).rejects.toThrow();
        expect(await tx.eventUserResponse.count()).toBe(0);
        expect(await tx.change.count()).toBe(0);
    }));

    it("rejects another event's segment within the same band", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const other = await tx.event.create({ data: { publicId: generatePublicId(), bandId: c.band.id, name: "Other event", revision: 1 } });
        const segment = await tx.eventSegment.create({ data: { publicId: generatePublicId(), eventId: other.id, name: "Other set", description: "", durationMillis: BigInt(0) } });
        await expect(c.write({ comment: "Must not persist", segmentResponses: { [segment.publicId]: { attendanceId: null } } })).rejects.toThrow();
        expect(await tx.eventUserResponse.count()).toBe(0);
        expect(await tx.eventSegmentUserResponse.count()).toBe(0);
    }));

    it("keeps hidden instrument history readable, rejects new selections and allows clearing", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ instrumentId: parsePublicId<"Instrument">(c.instrument.publicId) });
        await tx.bandInstrument.update({ where: { id: c.instrument.id }, data: { isHidden: true } });
        expect((await c.read()).instrumentId).toBe(c.instrument.publicId);
        await expect(c.write({ instrumentId: parsePublicId<"Instrument">(c.instrument.publicId) })).rejects.toThrow();
        await c.write({ comment: "Keep existing instrument" });
        await c.write({ instrumentId: null });
        expect((await c.read()).instrumentId).toBeNull();
    }));

    it("requires authentication and explicit band scope on reads and writes", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        for (const auth of [await loadAuthorizationForUser(null, tx, c.args.bandPublicId), await loadAuthorizationForUser(c.person, tx)]) {
            await expect(updateEventAttendanceInTransaction(tx, auth, { ...c.args, comment: "Denied" })).rejects.toThrow();
            const snapshot = await bindDB3ReadSnapshot(tx, auth, { isolationLevel: "Serializable" });
            await expect(readUserEventAttendance(snapshot, auth, c.args)).rejects.toThrow();
        }
        expect(await tx.eventUserResponse.count()).toBe(0);
    }));

    it("uses shared instrument visibility, including a hidden functional group, before any write", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        await c.write({ instrumentId: parsePublicId<"Instrument">(c.instrument.publicId) });
        const before = await tx.change.count();
        await tx.bandInstrumentFunctionalGroup.update({ where: { id: c.instrument.functionalGroupId }, data: { isHidden: true } });
        await expect(c.write({ comment: "Must not save", instrumentId: parsePublicId<"Instrument">(c.instrument.publicId), segmentResponses: c.answers })).rejects.toThrow();
        expect(await tx.change.count()).toBe(before);
        expect(await tx.eventSegmentUserResponse.count()).toBe(0);
        expect((await c.read()).instrumentId).toBe(c.instrument.publicId);
        expect((await c.read()).comment).toBe("");
        await c.write({ instrumentId: null });
        expect((await c.read()).instrumentId).toBeNull();
    }));

    it("keeps event defaults live within each membership while explicit instruments persist until cleared", () => fixtureTest(async (tx, fixture) => {
        const c = await prepare(tx, fixture);
        const second = await tx.bandInstrument.create({ data: { publicId: generatePublicId(), bandId: c.band.id, functionalGroupId: c.instrument.functionalGroupId } });
        const primary = await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, bandInstrumentId: c.instrument.id, isPrimary: true } });
        const secondary = await tx.bandUserInstrument.create({ data: { publicId: generatePublicId(), bandUserId: c.member.id, bandInstrumentId: second.id } });
        const effective = async () => {
            const context = await bindDB3ReadSnapshot(tx, c.auth, { isolationLevel: "Serializable" });
            const dashboard = hydrateDashboardData(await loadDashboardData(context, c.auth, { bandPublicId: c.args.bandPublicId, routeLocale: "fr-BE" }));
            const user = eventParticipantFromMembership(dashboard.currentMembership)!;
            const stored = await c.read();
            return getInstrumentForEventUserResponse({ bandUserId: user.membershipId, bandInstrumentId: stored.instrumentId,
                isInvited: null, userComment: "" }, user.membershipId, { instrument: { find: predicate => dashboard.instrument.find(predicate) } }, [user]);
        };
        expect((await effective())?.publicId).toBe(c.instrument.publicId);
        await tx.bandUserInstrument.update({ where: { id: primary.id }, data: { isPrimary: false } });
        await tx.bandUserInstrument.update({ where: { id: secondary.id }, data: { isPrimary: true } });
        expect((await effective())?.publicId).toBe(second.publicId);
        expect(await tx.eventUserResponse.count()).toBe(0);
        await c.write({ instrumentId: parsePublicId<"Instrument">(c.instrument.publicId) });
        expect((await effective())?.publicId).toBe(c.instrument.publicId);
        await c.write({ instrumentId: null });
        expect((await effective())?.publicId).toBe(second.publicId);
        await tx.bandInstrument.update({ where: { id: second.id }, data: { isHidden: true } });
        expect(await effective()).toBeNull();
        expect((await c.read()).instrumentId).toBeNull();
    }));

    it("rolls back responses, revisions and audit when the calendar hook fails", async () => {
        const failure = new Error("Calendar hook failed");
        let eventId: number | undefined;
        let bandUserId: number | undefined;
        await expect(withSettingsMysqlFixture(database, async (fixtureTx, fixture) => {
            const c = await prepare(fixtureTx, fixture);
            eventId = c.event.id;
            bandUserId = c.member.id;
            const root = { $transaction: async <T>(work: (inner: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: "Serializable" | "RepeatableRead" }) => {
                expect(options.isolationLevel).toBe("Serializable");
                // Prisma's transaction API is retained; only its calendar update fails after response writes.
                const failing = new Proxy(fixtureTx, { get(target, key) {
                    if (key === "event") {
                        return { ...target.event, update: () => { throw failure; } };
                    }
                    return Reflect.get(target, key);
                } });
                return work(failing);
            } };
            await expect(updateEventAttendance(root, c.auth, { ...c.args, segmentResponses: c.answers })).rejects.toThrow(failure);
            // Throw out of the owning transaction rather than catching a partially written transaction.
            throw failure;
        })).rejects.toThrow(failure);
        expect(await database.eventUserResponse.count({ where: { eventId, bandUserId } })).toBe(0);
        expect(await database.eventSegmentUserResponse.count({ where: { bandUserId } })).toBe(0);
        expect(await database.change.count({ where: { context: "updateUserEventAttendance" } })).toBe(0);
    });
});
