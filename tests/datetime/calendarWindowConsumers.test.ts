// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarDate, CalendarRange } from "shared/dateTimePolicy";
import { DateTimeRange, createAllDayRange } from "shared/time";
import { parsePublicId } from "shared/publicId";
import type * as SearchModule from "src/core/hooks/useSearchableList";
import type { EventSearchClient } from "src/core/db3/db3";
import { MakeEmptySearchResultsRet } from "src/core/db3/shared/apiTypes";

vi.mock("src/core/hooks/useSearchableList", async () => ({
    ...await vi.importActual<typeof SearchModule>("src/core/hooks/useSearchableList"), useSearchableList: vi.fn(),
}));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => dashboard }));
import { useEventsForDateRange } from "src/core/components/DateTime/useEventsForDateRange";
import { useSearchableList } from "src/core/hooks/useSearchableList";
import { eventSearchConfig } from "src/core/hooks/searchConfigs";

const cancelled = parsePublicId<"EventStatus">("CancelledStatus1");
const eventId = parsePublicId<"Event">("CalendarEvent001");
const dashboard = {
    bandTimeZone: "Europe/Brussels", formattingLocale: "fr-BE",
    eventStatus: { items: [{ publicId: cancelled, significance: "Cancelled" }],
        getById: (id: string | null | undefined) => id === cancelled ? { significance: "Cancelled" } : undefined },
};
let root: Root;
let container: HTMLDivElement;
let output: ReturnType<typeof useEventsForDateRange>;
const actDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove();
    if (actDescriptor) { Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actDescriptor); }
    else { Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT"); }
});
const segment = (start: string | null, durationMillis: number, statusId: string | null = null) => ({
    dateRange: new DateTimeRange({ startsAtDateTime: start ? new Date(start) : null, durationMillis, isAllDay: false }), statusId,
});
function setEvents(segments: ReturnType<typeof segment>[], loading = false) {
    // Only the hydrated fields read by this hook are needed; all catalog/query contracts stay real.
    const events = [{ publicId: eventId, name: "Rehearsal", type: { color: { id: "green" } }, segments }] as unknown as EventSearchClient[];
    vi.mocked(useSearchableList).mockReturnValue({ enrichedItems: events, results: MakeEmptySearchResultsRet(), loading, loadMoreData: vi.fn() });
}
async function render(zone = "UTC", date = "2026-07-11", end = "2026-07-12") {
    function Probe() {
        output = useEventsForDateRange(new CalendarRange(new CalendarDate(date, zone), new CalendarDate(end, zone)));
        return null;
    }
    await act(async () => root.render(React.createElement(Probe)));
    const filter = vi.mocked(useSearchableList).mock.calls.at(-1)![0];
    // The mock records this specific hook's Event filter, although the underlying function is generic.
    return eventSearchConfig.getQueryArgs(filter as Parameters<typeof eventSearchConfig.getQueryArgs>[0], 0, 100);
}

describe("picker calendar-window consumer", () => {
    it("carries exclusive picker bounds, cancellation filters and public view identity through the existing search config", async () => {
        setEvents([segment("2026-07-10T15:30:00Z", 0)]);
        const args = await render("Asia/Tokyo");
        expect(args).toMatchObject({ quickFilter: "", viewID: "Event_Search", take: 100,
            calendarWindow: { startDate: "2026-07-11", endDateExclusive: "2026-07-12", startInstant: "2026-07-10T15:00:00.000Z", endInstantExclusive: "2026-07-11T15:00:00.000Z" } });
        expect(args.discreteCriteria?.find(item => item.db3Column === "status")?.options).toEqual([cancelled]);
        expect(output.events[0]!.dateRange.start.date).toBe("2026-07-11");
        expect(output.events[0]!.dateRange.dayCount).toBe(1);
    });
    it("highlights individual segments and point events without painting aggregate gaps, TBD or cancelled dates", async () => {
        setEvents([segment("2026-06-01T00:00:00Z", 3600000), segment("2026-07-11T00:00:00Z", 0),
            segment(null, 3600000), segment("2026-07-11T00:00:00Z", 3600000, cancelled)]);
        await render();
        expect(output.events.map(event => event.id)).toEqual([eventId, eventId]);
        expect(output.events[1]).toMatchObject({ title: "Rehearsal", color: "green" });
        expect(output.events[1]!.dateRange.dayCount).toBe(1);
        expect(output.events.some(event => event.dateRange.hitTest(new CalendarDate("2026-07-10", "UTC")).inRange)).toBe(false);
        expect(output.error).toBeNull();
    });
    it("leaves status filtering open when the catalog has no cancelled status", async () => {
        const statuses = dashboard.eventStatus.items;
        dashboard.eventStatus.items = [];
        try {
            setEvents([segment("2026-07-11T12:00:00Z", 3600000)]);
            const args = await render();
            expect(args.discreteCriteria?.find(item => item.db3Column === "status"))
                .toMatchObject({ behavior: "alwaysMatch", options: [] });
            expect(output.events).toHaveLength(1);
        } finally {
            dashboard.eventStatus.items = statuses;
        }
    });
    it.each(["Asia/Tokyo", "America/Los_Angeles", "UTC"])("keeps all-day band dates when the picker uses %s", async zone => {
        const allDay = createAllDayRange({ startDate: "2026-07-11", endDateExclusive: "2026-07-13" }, dashboard.bandTimeZone);
        setEvents([{ dateRange: allDay, statusId: null }]); await render(zone);
        expect(output.events[0]!.dateRange.dates).toEqual({ startDate: "2026-07-11", endDateExclusive: "2026-07-13" });
        expect(output.events[0]!.dateRange.start.timeZone).toBe(zone);
    });
    it.each([["2026-03-29", "2026-03-30", 23], ["2026-10-25", "2026-10-26", 25]] as const)(
        "queries the %s DST window with separate midnights", async (date, end, hours) => {
            setEvents([]); const { calendarWindow } = await render("Europe/Brussels", date, end);
            expect(Date.parse(calendarWindow!.endInstantExclusive) - Date.parse(calendarWindow!.startInstant)).toBe(hours * 3600000);
        });
    it("clears highlights immediately when the shared search discards an earlier band, locale or date request", async () => {
        setEvents([segment("2026-07-11T12:00:00Z", 3600000)]); await render(); expect(output.events).toHaveLength(1);
        vi.mocked(useSearchableList).mockReturnValue({ enrichedItems: [], results: MakeEmptySearchResultsRet(), loading: true, loadMoreData: vi.fn() });
        await render(); expect(output.events).toEqual([]); expect(output.loading).toBe(true);
    });
});
