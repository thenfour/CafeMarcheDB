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

const owner = { ...createAuthorizationTestUser("normal", { id: 10 }), uid: "owner-uid" };
const cancelledId = 99;
const attendanceRows = [0, 33, 50, 51, 66, 100].map(strength => ({
    id: strength + 1, strength, isDeleted: true, isActive: false,
}));
const segment = (id: number, strength?: number | null, statusId: number | null = null) => ({
    id, name: `Segment ${id}`, uid: `segment-${id}`, description: "", statusId,
    startsAt: new Date("2026-10-01T10:00:00Z") as Date | null, isAllDay: false, durationMillis: BigInt(3_600_000),
    responses: strength === undefined ? [] : [{ userId: owner.id, attendanceId: strength === null ? null : strength + 1 }],
});
const makeEvent = (segments: ReturnType<typeof segment>[]) => ({
    id: 1, name: "Concert", revision: 1, locationDescription: "Hall", segments,
    songLists: [], responses: [], status: { significance: null as string | null },
});

const include = (segments: ReturnType<typeof segment>[], showDeclinedEvents = false, userId = owner.id) =>
    shouldIncludeEventInCalendarFeed({
        segments, showDeclinedEvents, userId,
        cancelledStatusIds: new Set([cancelledId]),
        attendanceById: new Map(attendanceRows.map(row => [row.id, row])),
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
});

beforeEach(() => {
    process.env.CMDB_BASE_URL = "https://band.test";
    authorizationTestDb.reset({
        user: [owner],
        userSetting: [{ id: 1, userId: owner.id, name: "calendar.showDeclinedEvents", value: false }],
        eventAttendance: attendanceRows,
        eventStatus: [{ id: cancelledId, significance: "Cancelled", isDeleted: true }],
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
});
