// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { createRoot, Root } from "react-dom/client"
import { act } from "react-dom/test-utils"

// Isolate unrelated dashboard/query siblings. The real range control, native
// selects, MUI wrappers and date/time routines remain mounted and executing.
vi.mock("src/core/components/CMCoreComponents2", () => ({ KeyValueTable: () => null }))
vi.mock("src/core/components/DateTime/useEventsForDateRange", () => ({ useEventsForDateRange: () => ({ events: [], loading: false }) }))

import { DateTimeRangeControl } from "src/core/components/DateTime/DateTimeRangeControl"
import { DateTimeRange } from "shared/time"

let root: Root | undefined
let container: HTMLDivElement | undefined
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, writable: true, value: true })
})
afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = undefined
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment)
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
})

function mount(start: Date, end: Date, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  const onChange = vi.fn()
  act(() => root!.render(React.createElement(DateTimeRangeControl, {
    timeZone,
    value: new DateTimeRange({ startsAtDateTime: start, durationMillis: end.valueOf() - start.valueOf(), isAllDay: false }),
    onChange,
  })))
  return { onChange, startSelect: container.querySelector<HTMLSelectElement>("select.startTime")!, endSelect: container.querySelector<HTMLSelectElement>("select.endTime")! }
}

function valueToReadibleStr(value: string | number) {
  if (typeof value === "number") {
    return new Date(value).toISOString()
  }
  const date = new Date(Number(value))
  return date.toISOString()
}

describe("mounted clock controls", () => {
  it("shows one compact choice while retaining a stored second clock occurrence", () => {
    const start = new Date("2026-10-25T01:30:00Z")
    const controls = mount(start, new Date("2026-10-25T02:00:00Z"), "Europe/Brussels")
    const repeatedClockOptions = Array.from(controls.startSelect.options)
      .filter(option => option.textContent === "02:30")
    expect(repeatedClockOptions).toHaveLength(1)

    // following test fails:
    // - Expected   "2026-10-25T01:30:00.000Z"
    // + Received   "2026-10-25T00:30:00.000Z"
    expect(valueToReadibleStr(repeatedClockOptions[0]!.value))
      .toBe(valueToReadibleStr(start.valueOf()))

    expect(controls.startSelect.value).toBe(String(start.valueOf()))
  })

  it("displays existing start & end times by rounding to nearest 15-minute boundary", () => {
    const start = new Date(2026, 6, 10, 7, 47, 12, 345)
    const end = new Date(start.valueOf() + 1_200_789)
    const controls = mount(start, end)
    expect(controls.onChange).not.toHaveBeenCalled()

    // following test fails:
    // - Expected   "2026-07-10T05:45:00.000Z"
    // + Received   "2026-07-10T06:00:00.000Z"    
    expect(valueToReadibleStr(controls.startSelect.value))
      .toBe(valueToReadibleStr(new Date(2026, 6, 10, 7, 45).valueOf()))

    expect(controls.startSelect.selectedOptions[0]!.textContent)
      .toBe("07:45")
    expect(valueToReadibleStr(controls.endSelect.value))
      .toBe(valueToReadibleStr(end.valueOf()))
    expect(controls.endSelect.selectedOptions[0]!.textContent).toContain("20m 789ms")
  })

  it("saves the selected end instant as elapsed duration, including the host DST transition", () => {
    const start = new Date(2026, 2, 29, 1, 30)
    const expectedEnd = new Date(2026, 2, 29, 3, 30)
    const controls = mount(start, new Date(2026, 2, 29, 3))
    act(() => {
      controls.endSelect.value = String(expectedEnd.valueOf())
      controls.endSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })
    const changed: DateTimeRange = controls.onChange.mock.calls[0]![0]
    expect(changed.getEndDateTime()).toEqual(expectedEnd)
    expect(changed.getSpec().durationMillis).toBe(expectedEnd.valueOf() - start.valueOf())
    expect(changed.getStartDateTime()).toEqual(start)
  })

  it("saves the selected start instant and preserves the existing precise duration", () => {
    const start = new Date(2026, 6, 10, 7, 47, 12, 345)
    const selected = new Date(2026, 6, 10, 8, 15)
    const controls = mount(start, new Date(start.valueOf() + 1_200_789))
    act(() => {
      controls.startSelect.value = String(selected.valueOf())
      controls.startSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })
    const changed: DateTimeRange = controls.onChange.mock.calls[0]![0]
    expect(changed.getStartDateTime()).toEqual(selected)
    expect(changed.getSpec().durationMillis).toBe(1_200_789)
  })
})
