import { attendancePublicId } from "./support/eventAttendanceFixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: (await import("./authorization/support/inMemoryPrisma")).authorizationTestDb,
}));
vi.mock("src/core/db3/server/db3QueryCore", () => ({ queryTable: vi.fn() }));

import { CalExportCore } from "src/core/db3/server/ical";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import { shouldIncludeEventInCalendarFeed } from "src/core/db3/shared/calendarAttendance";
import { createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";
import type { UserForCalBackendPayload } from "src/core/db3/shared/schema/prismArgs";
import { parsePublicId, type EventStatusPublicId } from "shared/publicId";

const owner = { ...createAuthorizationTestUser("normal", { id: 10 }), uid: "owner-uid" };
const cancelledDbId = 99;
const cancelledId = parsePublicId<"EventStatus">("CalendarStatus01");
const attendanceRows = [0, 33, 50, 51, 66, 100].map(strength => ({
    id: strength + 1, publicId: attendancePublicId(strength + 1), strength, isDeleted: true, isActive: false,
}));
const segment = (id: number, strength?: number | null, statusId: EventStatusPublicId | null = null) => ({
    id, name: `Segment ${id}`, uid: `segment-${id}`, description: "", statusId,
    startsAt: new Date("2026-10-01T10:00:00Z") as Date | null, isAllDay: false, durationMillis: BigInt(3_600_000),
    responses: strength === undefined ? [] : [{ userId: owner.id, attendanceId: strength === null ? null : attendancePublicId(strength + 1) }],
});
const makeEvent = (segments: ReturnType<typeof segment>[]) => ({
    id: 1, name: "Concert", revision: 1, locationDescription: "Hall", segments,
    songLists: [], responses: [] as { userId: number; isInvited: boolean | null }[],
    expectedAttendanceUserTag: null as { userAssignments: { userId: number }[] } | null,
    status: { significance: null as string | null },
});

const include = (segments: ReturnType<typeof segment>[], showDeclinedEvents = false, userId = owner.id, showUninvitedEvents = true) =>
    shouldIncludeEventInCalendarFeed({
        segments, showDeclinedEvents, userId,
        showUninvitedEvents, isInvited: false,
        cancelledStatusIds: new Set([cancelledId]),
        attendanceById: new Map(attendanceRows.map(row => [row.publicId, row])),
    });

describe("event-level calendar attendance", () => {
    it.each([0, 33, 50])("hides events declined with strength %s", strength => {
        expect(include([segment(1, strength), segment(2, 0)])).toBe(false);
    });
    it.each([undefined, null, 51, 66, 100])("retains an event with one non-declined response (%s)", strength => {
        expect(include([segment(1, 0), segment(2, strength)])).toBe(true);
    });
    it.each([undefined, null, 100])("ignores cancelled segments when classifying attendance (%s)", strength => {
        expect(include([segment(1, 0), segment(2, strength, cancelledId)])).toBe(false);
    });
    it("handles no active segments and a TBD active segment", () => {
        expect(include([])).toBe(false);
        expect(include([segment(1, 100, cancelledId)])).toBe(false);
        expect(include([segment(1, 0), { ...segment(2), startsAt: null }])).toBe(true);
    });
    it("keeps declined events when the preference is enabled", () => {
        expect(include([segment(1, 0)], true)).toBe(true);
    });
    it("uses only the subscribing user's responses", () => {
        expect(include([segment(1, 0)], false, 20)).toBe(true);
    });

    it.each([
        [undefined, false], [null, false], [0, false], [33, false], [50, false],
        [51, true], [66, true], [100, true], [999, false],
    ] as const)("requires an explicit going response to override the invitation filter (%s => %s)", (strength, expected) => {
        const segments = [segment(1, 0), segment(2, strength)];
        expect(include(segments, false, owner.id, false)).toBe(expected);
        expect(include(segments, true, owner.id, false)).toBe(expected);
    });

    it("does not use cancelled segments or another user's going response to override the invitation filter", () => {
        expect(include([segment(1), segment(2, 100, cancelledId)], true, owner.id, false)).toBe(false);
        expect(include([segment(1, 100)], true, 20, false)).toBe(false);
        expect(include([], true, owner.id, false)).toBe(false);
    });
});

beforeEach(() => {
    process.env.CMDB_BASE_URL = "https://band.test";
    authorizationTestDb.reset({
        user: [owner],
        userSetting: [{ id: 1, userId: owner.id, name: "calendar.showDeclinedEvents", value: false }],
        eventAttendance: attendanceRows,
        eventStatus: [{ id: cancelledDbId, publicId: cancelledId, significance: "Cancelled", isDeleted: true }],
    });
});

describe("calendar export integration", () => {
    const exportFeed = () => CalExportCore({
        type: "upcoming", currentUser: owner as UserForCalBackendPayload,
    });

    it("retains all dated active segments of a qualifying event, including declined ones", async () => {
        vi.mocked(queryTable).mockResolvedValue({ items: [makeEvent([
            segment(1, 0), segment(2, 100), segment(3, 100, cancelledId),
        ])] } as never);
        const calendar = await exportFeed();
        expect(calendar.events()).toHaveLength(2);
        expect(calendar.events().map(event => event.summary())).toEqual([
            expect.stringContaining("Segment 1"), expect.stringContaining("Segment 2"),
        ]);
    });

    it("removes and restores the same entries as settings and responses change", async () => {
        const event = makeEvent([segment(1, 0), segment(2, 50)]);
        vi.mocked(queryTable).mockResolvedValue({ items: [event] } as never);
        expect((await exportFeed()).events()).toHaveLength(0);
        await authorizationTestDb.userSetting!.update({ where: { id: 1 }, data: { value: true } });
        const original = await exportFeed();
        expect(original.events()).toHaveLength(2);
        expect(original.events()[0]!.summary()).not.toContain("👍");
        await authorizationTestDb.userSetting!.update({ where: { id: 1 }, data: { value: false } });
        event.segments[1]!.responses = [];
        const restored = await exportFeed();
        expect(restored.events().map(event => event.uid())).toEqual(original.events().map(event => event.uid()));
    });

    it("omits cancelled events and undated segments without changing attendance eligibility", async () => {
        const event = makeEvent([segment(1, 0), { ...segment(2), startsAt: null }]);
        vi.mocked(queryTable).mockResolvedValue({ items: [event] } as never);
        expect((await exportFeed()).events()).toHaveLength(1);
        event.status.significance = "Cancelled";
        expect((await exportFeed()).events()).toHaveLength(0);
    });

    it.each([
        { showDeclinedEvents: true, showUninvitedEvents: true, retained: [1, 2, 3, 4] },
        { showDeclinedEvents: false, showUninvitedEvents: true, retained: [1, 3] },
        { showDeclinedEvents: true, showUninvitedEvents: false, retained: [1, 2, 3] },
        { showDeclinedEvents: false, showUninvitedEvents: false, retained: [1, 3] },
    ])("combines invitation and attendance preferences: %j", async ({ showDeclinedEvents, showUninvitedEvents, retained }) => {
        await authorizationTestDb.userSetting!.update({ where: { id: 1 }, data: { value: showDeclinedEvents } });
        await authorizationTestDb.userSetting!.create({ data: {
            userId: owner.id, name: "calendar.showUninvitedEvents", value: showUninvitedEvents,
        } });
        const events = [
            { ...makeEvent([segment(1, 100)]), responses: [{ userId: owner.id, isInvited: true }] },
            { ...makeEvent([segment(2, 0)]), responses: [{ userId: owner.id, isInvited: true }] },
            // Going keeps this event in the feed despite the lack of an invitation.
            { ...makeEvent([segment(3, 100)]), responses: [{ userId: 20, isInvited: true }] },
            makeEvent([segment(4, 0)]),
        ].map((event, index) => ({ ...event, id: index + 1, name: `Event ${index + 1}` }));
        vi.mocked(queryTable).mockResolvedValue({ items: events } as never);
        const calendar = await exportFeed();
        expect(calendar.events().map(event => event.summary())).toEqual(
            retained.map(id => expect.stringContaining(`Event ${id}`)),
        );
    });

    it("retains all active dated segments when an uninvited subscriber goes, and rechecks changed responses", async () => {
        await authorizationTestDb.userSetting!.create({ data: {
            userId: owner.id, name: "calendar.showUninvitedEvents", value: false,
        } });
        const event = makeEvent([segment(1, 0), segment(2, 51), segment(3, 100, cancelledId)]);
        vi.mocked(queryTable).mockResolvedValue({ items: [event] } as never);
        const original = await exportFeed();
        expect(original.events().map(event => event.summary())).toEqual([
            expect.stringContaining("Segment 1"), expect.stringContaining("Segment 2"),
        ]);
        event.segments[1]!.responses = [];
        expect((await exportFeed()).events()).toHaveLength(0);
        event.segments[1]!.responses = segment(2, 100).responses;
        expect((await exportFeed()).events().map(event => event.uid()))
            .toEqual(original.events().map(event => event.uid()));
    });

    it("rechecks invitation membership and preferences on each fetch, preserving segment UIDs", async () => {
        const invitationSetting = await authorizationTestDb.userSetting!.create({ data: {
            userId: owner.id, name: "calendar.showUninvitedEvents", value: false,
        } });
        const event = makeEvent([segment(1, 0), segment(2)]);
        const tag = { userAssignments: [{ userId: owner.id }] };
        event.expectedAttendanceUserTag = tag;
        event.responses = [{ userId: owner.id, isInvited: false }];
        vi.mocked(queryTable).mockResolvedValue({ items: [event] } as never);

        // The tag overrides the stored false, and one unanswered segment retains the whole event.
        const original = await exportFeed();
        expect(original.events()).toHaveLength(2);
        tag.userAssignments = [{ userId: 20 }];
        expect((await exportFeed()).events()).toHaveLength(0);
        event.expectedAttendanceUserTag = null;
        event.responses[0]!.isInvited = true;
        expect((await exportFeed()).events().map(event => event.uid()))
            .toEqual(original.events().map(event => event.uid()));
        event.responses = [];
        expect((await exportFeed()).events()).toHaveLength(0);
        await authorizationTestDb.userSetting!.update({ where: {
            id: invitationSetting.id,
        }, data: { value: true } });
        expect((await exportFeed()).events().map(event => event.uid()))
            .toEqual(original.events().map(event => event.uid()));
    });
});
