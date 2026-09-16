// @vitest-environment jsdom
import React from "react"
import { createRoot, Root } from "react-dom/client"
import { act, Simulate } from "react-dom/test-utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"

vi.mock("src/core/components/CMCoreComponents2", () => ({ KeyValueTable: () => null }))
vi.mock("src/core/components/DateTime/useEventsForDateRange", () => ({ useEventsForDateRange: () => ({ events: [], loading: false }) }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ bandTimeZone: "Asia/Tokyo" }) }))
import { EventDateTimeRangeControl } from "src/core/components/DateTime/DateTimeRangeControl"
import { DateTimeRange } from "shared/time"

let root: Root | undefined
let container: HTMLDivElement
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment)
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
})
function mount(initial: DateTimeRange) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  const onChange = vi.fn()
  function Editor() {
    const [value, setValue] = React.useState(initial)
    return React.createElement(EventDateTimeRangeControl, { value, onChange: next => { onChange(next); setValue(next) } })
  }
  act(() => root!.render(React.createElement(LocalizationProvider, { dateAdapter: AdapterDayjs }, React.createElement(Editor))))
  return onChange
}
const timed = () => new DateTimeRange({ startsAtDateTime: new Date("2026-07-10T15:30:12.345Z"), durationMillis: 1_200_789, isAllDay: false })

describe("band event editor", () => {
  it("renders the band date, clock and zone without modifying the stored instant", () => {
    const changed = mount(timed())
    expect(container.querySelector(".startDate")!.textContent).toContain("11")
    expect(container.querySelector<HTMLSelectElement>(".startTime")!.selectedOptions[0]!.textContent).toBe("00:30:12.345")
    expect(container.textContent).toContain("Time zone: Asia/Tokyo")
    expect(changed).not.toHaveBeenCalled()
  })
  it("saves the selected band clock as its absolute instant", () => {
    const changed = mount(timed())
    const select = container.querySelector<HTMLSelectElement>(".startTime")!
    act(() => { select.value = String(Date.parse("2026-07-10T15:45:00Z")); select.dispatchEvent(new Event("change", { bubbles: true })) })
    expect(changed.mock.calls[0]![0].getSpec()).toMatchObject({ startsAtDateTime: new Date("2026-07-10T15:45:00Z"), durationMillis: 1_200_789 })
  })
  it("preserves the band date through all-day and TBD toggles", () => {
    const changed = mount(timed())
    act(() => Simulate.change(container.querySelector<HTMLInputElement>(".allDayControl input")!, { target: { checked: true } } as any))
    expect(changed.mock.calls[0]![0].getSpec()).toMatchObject({ startsAtDateTime: new Date("2026-07-10T15:00:00Z"), isAllDay: true })
    act(() => Simulate.change(container.querySelector<HTMLInputElement>(".tbdControl input")!, { target: { checked: false } } as any))
    act(() => Simulate.change(container.querySelector<HTMLInputElement>(".tbdControl input")!, { target: { checked: true } } as any))
    expect(changed.mock.calls[2]![0].getSpec().startsAtDateTime).toEqual(new Date("2026-07-10T15:00:00Z"))
  })
  it("authors a real full day when determining a new zero-duration TBD value", () => {
    const changed = mount(new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true }))
    act(() => Simulate.change(container.querySelector<HTMLInputElement>(".tbdControl input")!, { target: { checked: true } } as any))
    const range = changed.mock.calls[0]![0] as DateTimeRange
    expect(range.getDurationMillis()).toBe(86_400_000)
    expect(range.getStartDateTime()!.getUTCHours()).toBe(15) // Tokyo midnight
  })
  it("changes the calendar day while retaining the precise band clock", () => {
    const changed = mount(timed())
    act(() => Simulate.click(container.querySelector(".startDate")!))
    const day = [...document.querySelectorAll<HTMLButtonElement>(".MuiPickersDay-root")].find(button => button.textContent === "12")!
    expect(day).toBeDefined()
    act(() => Simulate.click(day))
    expect(changed.mock.calls[0]![0].getSpec()).toMatchObject({ startsAtDateTime: new Date("2026-07-11T15:30:12.345Z"), durationMillis: 1_200_789 })
  })
})
