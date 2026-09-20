import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DateTimeRange } from "shared/time"

// Inspect the real month component's calendar boundary. The widget itself is
// mounted with this display contract in calendarDisplay's five-zone probes.
vi.mock("react-big-calendar", () => ({ Calendar: vi.fn(() => null), momentLocalizer: () => ({}) }))
vi.mock("src/core/db3/components/IconMap", () => ({ gCharMap: { LeftTriangle: () => "<", RightTriangle: () => ">" } }))
vi.mock("src/core/components/CMCoreComponents", () => ({ CMSinglePageSurfaceCard: ({ children }: React.PropsWithChildren) => children }))
vi.mock("src/core/components/CMCoreComponents2", () => ({ AdminInspectObject: () => null, useURLState: () => ["202607", () => {}] }))
vi.mock("src/core/components/AppContext", () => ({ AppContextMarker: ({ children }: React.PropsWithChildren) => children }))
vi.mock("src/core/components/event/EventComponentsBase", () => ({}))
vi.mock("src/core/components/event/EventComponents", () => ({}))
vi.mock("src/core/hooks/useSearchableList", () => ({ useSearchableList: vi.fn(() => ({ enrichedItems: [], results: {} })) }))
vi.mock("src/core/hooks/searchConfigs", () => ({ eventSearchConfig: {} }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({
  bandTimeZone: "Europe/Brussels",
  eventStatus: { getById: (id: number) => id === 9 ? { significance: "Cancelled" } : undefined },
}) }))

import { Calendar } from "react-big-calendar"
import { BigEventCalendarInner, BigEventCalendarMonth, BigEventCalendarMonthProps } from "src/core/components/EventCalendar"
import { useSearchableList } from "src/core/hooks/useSearchableList"
import type { EventsFilterSpec } from "src/core/components/event/EventClientBaseTypes"

beforeEach(() => { vi.mocked(Calendar).mockClear() })

function render() {
  const segment = (id: number, name: string, startsAt: Date | null, durationMillis: number, isAllDay: boolean, statusId: number | null = null) => ({
    id,
    name,
    dateRange: new DateTimeRange({ startsAtDateTime: startsAt, durationMillis, isAllDay }),
    statusId,
  })
  const segments = [
    segment(1, "All day", new Date("2026-07-09T22:00:00.000Z"), 86_400_000, true),
    segment(2, "Timed", new Date("2026-07-10T15:30:12.345Z"), 1_200_789, false),
    segment(3, "TBD", null, 86_400_000, true),
    segment(4, "Cancelled", new Date("2026-07-09T22:00:00.000Z"), 86_400_000, true, 9),
  ]
  const event = { id: 10, name: "Rehearsal", segments }
  const result = {}
  const setSelectedEvent = vi.fn()
  const props = {
    date: new Date(2026, 6, 1), setMonthStr: vi.fn(), selectedEvent: null,
    setSelectedEvent, filterSpec: {}, results: result,
    enrichedEvents: [{ event, result }],
  } as unknown as BigEventCalendarMonthProps
  renderToStaticMarkup(React.createElement(BigEventCalendarMonth, props))
  // The captured props belong to the production component, whose private event
  // item type deliberately remains private to that component.
  const calendar = vi.mocked(Calendar).mock.calls[0]![0] as any
  return { calendar, event, result, segments, setSelectedEvent }
}

describe("month calendar consumer", () => {
  it("requests its padded month with explicit viewer and calendar bounds", () => {
    renderToStaticMarkup(React.createElement(BigEventCalendarInner, {}))
    const filter = vi.mocked(useSearchableList).mock.calls[0]![0] as EventsFilterSpec
    expect(filter.quickFilter).toBe("")
    expect(filter.calendarWindow).toEqual({
      startDate: "2026-06-22", endDateExclusive: "2026-08-09",
      startInstant: new Date(2026, 5, 22).toISOString(),
      endInstantExclusive: new Date(2026, 7, 9).toISOString(),
    })
  })

  it("passes matching semantic endpoints and excludes TBD/cancelled segments", () => {
    const { calendar } = render()
    expect(calendar.events.map((item: any) => item.segment.id)).toEqual([1, 2])
    const [allDay, timed] = calendar.events
    expect(calendar.startAccessor(allDay)).toEqual(new Date(2026, 6, 10))
    expect(calendar.endAccessor(allDay)).toEqual(new Date(2026, 6, 11))
    expect(calendar.allDayAccessor(allDay)).toBe(true)
    expect(calendar.startAccessor(timed).toISOString()).toBe("2026-07-10T15:30:12.345Z")
    expect(calendar.endAccessor(timed).toISOString()).toBe("2026-07-10T15:50:13.134Z")
    expect(calendar.allDayAccessor(timed)).toBe(false)
  })

  it("retains event/segment identity and selection data after adapting dates", () => {
    const { calendar, event, result, segments, setSelectedEvent } = render()
    const item = calendar.events[0]
    expect(item.event).toBe(event)
    expect(item.segment).toBe(segments[0])
    expect(item.result).toBe(result)
    expect(calendar.titleAccessor(item)).toBe("Rehearsal: All day")
    calendar.onSelectEvent(item)
    expect(setSelectedEvent).toHaveBeenCalledWith(item)
  })
})
