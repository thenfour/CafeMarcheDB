import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Inspect the real month component's calendar boundary. The widget itself is
// mounted with this display contract in calendarDisplay's five-zone probes.
vi.mock("react-big-calendar", () => ({ Calendar: vi.fn(() => null), momentLocalizer: () => ({}) }))
vi.mock("src/core/db3/components/IconMap", () => ({ gCharMap: { LeftTriangle: () => "<", RightTriangle: () => ">" } }))
vi.mock("src/core/components/CMCoreComponents", () => ({}))
vi.mock("src/core/components/CMCoreComponents2", () => ({ AdminInspectObject: () => null }))
vi.mock("src/core/components/AppContext", () => ({}))
vi.mock("src/core/components/event/EventComponentsBase", () => ({}))
vi.mock("src/core/components/event/EventComponents", () => ({}))
vi.mock("src/core/hooks/useSearchableList", () => ({}))
vi.mock("src/core/hooks/searchConfigs", () => ({}))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({
  eventStatus: { getById: (id: number) => id === 9 ? { significance: "Cancelled" } : undefined },
}) }))

import { Calendar } from "react-big-calendar"
import { BigEventCalendarMonth, BigEventCalendarMonthProps } from "src/core/components/EventCalendar"

beforeEach(() => { vi.mocked(Calendar).mockClear() })

function render() {
  const segments = [
    { id: 1, name: "All day", startsAt: new Date("2026-07-10T00:00:00.000Z"), durationMillis: BigInt(86_400_000), isAllDay: true, statusId: null },
    { id: 2, name: "Timed", startsAt: new Date("2026-07-10T15:30:12.345Z"), durationMillis: BigInt(1_200_789), isAllDay: false, statusId: null },
    { id: 3, name: "TBD", startsAt: null, durationMillis: BigInt(86_400_000), isAllDay: true, statusId: null },
    { id: 4, name: "Cancelled", startsAt: new Date("2026-07-10T00:00:00.000Z"), durationMillis: BigInt(86_400_000), isAllDay: true, statusId: 9 },
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
