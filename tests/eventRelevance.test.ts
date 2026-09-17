import { describe, expect, it } from "vitest";
import {
    GetRelevantEvents,
    gEventRelevanceClass,
    kMaxRelevantEventsToShow,
} from "src/core/db3/shared/eventRelevance";

type RelevanceEvent = Parameters<typeof GetRelevantEvents>[0][number];
type RelevanceContext = Parameters<typeof GetRelevantEvents>[1];

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const now = new Date("2026-01-10T12:00:00.000Z");

const context: RelevanceContext = {
    now,
    twentyFourHoursAgo: new Date(now.getTime() - day),
    sevenDaysFromNow: new Date(now.getTime() + 7 * day),
};

const at = (offsetMillis: number) => new Date(now.getTime() + offsetMillis);

const event = (
    id: number,
    startsAt: Date | null,
    endDateTime: Date | null,
    relevanceClassOverride: RelevanceEvent["relevanceClassOverride"] = null,
): RelevanceEvent => ({
    id,
    startsAt,
    endDateTime,
    relevanceClassOverride,
    durationMillis: startsAt && endDateTime ? endDateTime.getTime() - startsAt.getTime() : 0,
    isAllDay: false,
});

const ids = (events: RelevanceEvent[]) =>
    GetRelevantEvents(events, context).map(item => item.id);

describe("event relevance", () => {
    it("classifies and orders ongoing, upcoming, and recent events by class", () => {
        expect(ids([
            event(3, at(-2 * hour), at(-hour)),
            event(2, at(hour), at(2 * hour)),
            event(1, at(-hour), at(hour)),
            event(4, at(8 * day), at(8 * day + hour)),
            event(5, at(-3 * day), at(-2 * day)),
        ])).toEqual([1, 2, 3]);
    });

    it("shows only the nearest future event when no nearer class is relevant", () => {
        expect(ids([
            event(2, at(10 * day), at(10 * day + hour)),
            event(1, at(8 * day), at(8 * day + hour)),
        ])).toEqual([1]);
    });

    it("keeps a pinned future event ahead of ordinary non-future events", () => {
        expect(ids([
            event(2, at(-hour), at(hour)),
            event(1, at(8 * day), at(8 * day + hour), gEventRelevanceClass.Pinned),
        ])).toEqual([1, 2]);
    });

    it("keeps multiple pinned future events while limiting the unpinned fallback", () => {
        expect(ids([
            event(4, at(11 * day), at(11 * day + hour)),
            event(3, at(10 * day), at(10 * day + hour), gEventRelevanceClass.Pinned),
            event(2, at(9 * day), at(9 * day + hour)),
            event(1, at(8 * day), at(8 * day + hour), gEventRelevanceClass.Pinned),
        ])).toEqual([1, 3, 2]);
    });

    it("keeps an explicitly pinned event that is too old for a date-based class", () => {
        expect(ids([
            event(1, at(-3 * day), at(-2 * day), gEventRelevanceClass.Pinned),
            event(2, at(-hour), at(hour)),
        ])).toEqual([1, 2]);
    });

    it("shows a TBD event only when it is explicitly pinned", () => {
        expect(ids([
            event(1, null, null),
            event(2, null, null, gEventRelevanceClass.Pinned),
        ])).toEqual([2]);
    });

    it("honors an explicit hidden override", () => {
        expect(ids([
            event(1, at(-hour), at(hour), gEventRelevanceClass.Hidden),
            event(2, at(-hour), at(hour)),
        ])).toEqual([2]);
    });

    it("limits the normal relevant-event list after ordering", () => {
        const events = Array.from({ length: kMaxRelevantEventsToShow + 2 }, (_, index) =>
            event(index + 1, at((index + 1) * hour), at((index + 2) * hour)),
        );

        expect(ids(events)).toEqual([1, 2, 3, 4, 5]);
    });
});
