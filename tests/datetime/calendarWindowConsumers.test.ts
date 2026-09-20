// @vitest-environment jsdom

import { CalendarDate, CalendarRange } from "shared/dateTimePolicy";
import React from "react"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("src/core/hooks/useSearchableList", async () => ({
  ...await vi.importActual<typeof import("src/core/hooks/useSearchableList")>("src/core/hooks/useSearchableList"),
  useSearchableList: vi.fn(),
}))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => {
  const eventStatus = { items: [{ id: 9, significance: "Cancelled" }], getById: (id: number | null) => id === 9 ? { significance: "Cancelled" } : undefined }
  return { useDashboardContext: () => ({ eventStatus, bandTimeZone: "Europe/Brussels" }) }
})

import { useEventsForDateRange } from "src/core/components/DateTime/useEventsForDateRange"
import { useSearchableList } from "src/core/hooks/useSearchableList"
import { eventSearchConfig } from "src/core/hooks/searchConfigs"
import { DateTimeRange } from "shared/time"
import type { EventsFilterSpec } from "src/core/components/event/EventClientBaseTypes"

const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment)
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
})

function mount(range: DateTimeRange, timeZone?: string) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true })
  const segment = (id: number, startsAt: Date | null, durationMillis: number, statusId: number | null = null) => ({
    id,
    dateRange: new DateTimeRange({ startsAtDateTime: startsAt, durationMillis, isAllDay: false }),
    statusId,
  })
  vi.mocked(useSearchableList).mockClear()
  vi.mocked(useSearchableList).mockReturnValue({
    enrichedItems: [{ id: 1, name: "Rehearsal", segments: [
      segment(1, new Date(2026, 5, 1), 3_600_000),
      segment(2, timeZone ? new Date("2026-07-10T15:30:00Z") : new Date(2026, 6, 11), 0),
      segment(3, null, 3_600_000),
      segment(4, new Date(2026, 6, 11), 3_600_000, 9),
    ] }], results: {} as any, loading: false, loadMoreData: vi.fn(),
  })
  let output: ReturnType<typeof useEventsForDateRange>
  function Probe() { output = useEventsForDateRange(new CalendarRange(new CalendarDate("2026-07-11", timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), new CalendarDate("2026-07-12", timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone))); return null }
  const container = document.createElement("div")
  const root = createRoot(container)
  unmount = () => { act(() => root.unmount()); container.remove() }
  act(() => root.render(React.createElement(Probe)))
  const filter = vi.mocked(useSearchableList).mock.calls[0]![0] as EventsFilterSpec
  return { output: output!, args: eventSearchConfig.getQueryArgs(filter, 0, 100) }
}

describe("picker calendar-window consumer", () => {
  it("uses band query bounds and band-date highlights when editing a shared event", () => {
    const { args, output } = mount(new DateTimeRange({ startsAtDateTime: new Date(2026, 6, 11), durationMillis: 0, isAllDay: false }), "Asia/Tokyo")
    expect(args.calendarWindow).toEqual({ startDate: "2026-07-11", endDateExclusive: "2026-07-12",
      startInstant: "2026-07-10T15:00:00.000Z", endInstantExclusive: "2026-07-11T15:00:00.000Z" })
    expect(output.events[1]!.dateRange.hitTest(new CalendarDate("2026-07-11", output.events[1]!.dateRange.start.timeZone)).inRange).toBe(true)
    expect(output.events[1]!.dateRange.hitTest(new CalendarDate("2026-07-10", output.events[1]!.dateRange.start.timeZone)).inRange).toBe(false)
  })

  it("carries an exclusive local-day window through the production search config", () => {
    const start = new Date(2026, 6, 11)
    const end = new Date(2026, 6, 12)
    const { args } = mount(new DateTimeRange({ startsAtDateTime: start, durationMillis: end.valueOf() - start.valueOf(), isAllDay: false }))
    expect(args.quickFilter).toBe("")
    expect(args.viewID).toBe("Event_Search")
    expect(args.calendarWindow).toEqual({ startDate: "2026-07-11", endDateExclusive: "2026-07-12", startInstant: start.toISOString(), endInstantExclusive: end.toISOString() })
  })

  it("highlights segment calendar days, including zero-duration points, instead of aggregate gaps", () => {
    const { output } = mount(new DateTimeRange({ startsAtDateTime: new Date(2026, 6, 11), durationMillis: 0, isAllDay: false }))
    expect(output.events.map(event => event.id)).toEqual(["1", "1"])
    // Highlight ranges represent calendar days after projection into the explicit zone.
    expect(output.events[1]!.dateRange.dayCount).toBe(1)
    const source = vi.mocked(useSearchableList).mock.results[0]!.value.enrichedItems[0].segments[1]
    expect(source.dateRange.getSpec().durationMillis).toBe(0)
    expect(output.events[1]!.dateRange.start.date).toBe("2026-07-11")
    expect(output.events.some(event => event.dateRange.hitTest(new CalendarDate("2026-07-10", output.events[1]!.dateRange.start.timeZone)).inRange)).toBe(false)
    expect(output.events[1]!.dateRange.hitTest(new CalendarDate("2026-07-11", output.events[1]!.dateRange.start.timeZone)).inRange).toBe(true)
    expect(output.error).toBeNull()
  })
})
