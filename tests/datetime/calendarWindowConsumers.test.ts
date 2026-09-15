// @vitest-environment jsdom
import React from "react"
import dayjs from "dayjs"
import { act } from "react-dom/test-utils"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("src/core/hooks/useSearchableList", () => ({ useSearchableList: vi.fn() }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => {
  const eventStatus = { items: [{ id: 9, significance: "Cancelled" }], getById: (id: number | null) => id === 9 ? { significance: "Cancelled" } : undefined }
  return { useDashboardContext: () => ({ eventStatus }) }
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

function mount(range: DateTimeRange) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true })
  const segment = (id: number, startsAt: Date | null, durationMillis: number, statusId: number | null = null) => ({ id, startsAt, durationMillis: BigInt(durationMillis), isAllDay: false, statusId })
  vi.mocked(useSearchableList).mockReturnValue({
    enrichedItems: [{ id: 1, name: "Rehearsal", startsAt: new Date("2026-06-01T00:00:00Z"), segments: [
      segment(1, new Date(2026, 5, 1), 3_600_000),
      segment(2, new Date(2026, 6, 11), 0),
      segment(3, null, 3_600_000),
      segment(4, new Date(2026, 6, 11), 3_600_000, 9),
    ] }], results: {} as any, loading: false, loadMoreData: vi.fn(),
  })
  let output: ReturnType<typeof useEventsForDateRange>
  function Probe() { output = useEventsForDateRange(range); return null }
  const container = document.createElement("div")
  const root = createRoot(container)
  unmount = () => { act(() => root.unmount()); container.remove() }
  act(() => root.render(React.createElement(Probe)))
  const filter = vi.mocked(useSearchableList).mock.calls[0]![0] as EventsFilterSpec
  return { output: output!, args: eventSearchConfig.getQueryArgs(filter, 0, 100) }
}

describe("picker calendar-window consumer", () => {
  it("carries an exclusive local-day window through the production search config", () => {
    const start = new Date(2026, 6, 11)
    const end = new Date(2026, 6, 12)
    const { args } = mount(new DateTimeRange({ startsAtDateTime: start, durationMillis: end.valueOf() - start.valueOf(), isAllDay: false }))
    expect(args.quickFilter).toBe("")
    expect(args.calendarWindow).toEqual({ startDate: "2026-07-11", endDateExclusive: "2026-07-12", startInstant: start.toISOString(), endInstantExclusive: end.toISOString() })
  })

  it("highlights segments rather than gaps in the cached aggregate and preserves zero duration", () => {
    const { output } = mount(new DateTimeRange({ startsAtDateTime: new Date(2026, 6, 11), durationMillis: 0, isAllDay: false }))
    expect(output.events.map(event => event.id)).toEqual(["1", "1"])
    expect(output.events[1]!.dateRange.getSpec().durationMillis).toBe(0)
    expect(output.events[1]!.dateRange.getStartDateTime()).toEqual(new Date(2026, 6, 11))
    expect(output.events.some(event => event.dateRange.hitTestDay(dayjs(new Date(2026, 6, 10))).inRange)).toBe(false)
    expect(output.events[1]!.dateRange.hitTestDay(dayjs(new Date(2026, 6, 11))).inRange).toBe(true)
    expect(output.error).toBeNull()
  })
})
