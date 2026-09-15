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

function mount(start: Date, end: Date) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  const onChange = vi.fn()
  act(() => root!.render(React.createElement(DateTimeRangeControl, {
    value: new DateTimeRange({ startsAtDateTime: start, durationMillis: end.valueOf() - start.valueOf(), isAllDay: false }),
    onChange,
  })))
  return { onChange, startSelect: container.querySelector<HTMLSelectElement>("select.startTime")!, endSelect: container.querySelector<HTMLSelectElement>("select.endTime")! }
}

describe("mounted clock controls", () => {
  it("displays exact existing times without emitting a change on mount", () => {
    const start = new Date(2026, 6, 10, 7, 47, 12, 345)
    const end = new Date(start.valueOf() + 1_200_789)
    const controls = mount(start, end)
    expect(controls.onChange).not.toHaveBeenCalled()
    expect(controls.startSelect.value).toBe(String(start.valueOf()))
    expect(controls.startSelect.selectedOptions[0]!.textContent).toBe("07:47:12.345")
    expect(controls.endSelect.value).toBe(String(end.valueOf()))
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
