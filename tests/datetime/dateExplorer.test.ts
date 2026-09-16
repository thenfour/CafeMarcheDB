// @vitest-environment jsdom
import React from "react"
import { createRoot, Root } from "react-dom/client"
import { act, Simulate } from "react-dom/test-utils"
import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("src/auth/server/serverPageAuthorization", () => ({ makeServerSidePermissionGuard: () => () => ({ props: {} }) }))
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ bandTimeZone: "Europe/Brussels" }) }))
vi.mock("src/core/components/DateTime/useEventsForDateRange", () => ({ useEventsForDateRange: () => ({ events: [], loading: false }) }))

import { DateTestPageCtrl } from "src/pages/backstage/test/date"

let root: Root | undefined
let container: HTMLDivElement
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment)
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
})
function mount() {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(React.createElement(LocalizationProvider, { dateAdapter: AdapterDayjs }, React.createElement(DateTestPageCtrl))))
}
const value = (label: string) => [...container.querySelectorAll("dt")].find(dt => dt.textContent === label)!.nextElementSibling!.textContent
function changeZone(label: string, zone: string) {
  const input = [...container.querySelectorAll<HTMLInputElement>("input")].find(input => input.labels?.[0]?.textContent === label)!
  expect(input).toBeTruthy()
  act(() => { input.focus(); Simulate.change(input, { target: { value: zone } } as any) })
  act(() => Simulate.keyDown(input, { key: "Enter", keyCode: 13 }))
}

describe("manual date explorer", () => {
  it("changes presentation timezone without changing the stored sample and rejects invalid zones", () => {
    mount()
    const before = value("Stored start (UTC ISO)")
    expect(container.querySelector('[aria-label="Panel B"]')!.textContent).toContain("00:30:12.345 +09:00")
    changeZone("Panel B: display / editing timezone", "UTC")
    expect(container.querySelector('[aria-label="Panel B"]')!.textContent).toContain("15:30:12.345 +00:00")
    expect(value("Stored start (UTC ISO)")).toBe(before)
    expect(container.textContent).toContain("Recent editor writes (0)")
    changeZone("Panel B: display / editing timezone", "Moon/Base")
    expect(container.textContent).toContain("Enter a named timezone")
    expect(value("Stored start (UTC ISO)")).toBe(before)
  })
  it("propagates a real clock edit to storage and the other editor", () => {
    mount()
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Panel A"] .startTime')!
    const choice = [...select.options].find(option => option.textContent === "18:00")!
    act(() => Simulate.change(select, { target: { value: choice.value } } as any))
    expect(value("Stored start (UTC ISO)")).toBe("2026-07-10T16:00:00.000Z")
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Panel B"] .startTime')!.selectedOptions[0]!.textContent).toBe("01:00")
    expect(container.textContent).toContain("Recent editor writes (1)")
  })
  it("separates all-day storage, editor zones and the simulated lifecycle timezone", () => {
    mount()
    const presets = container.querySelector<HTMLSelectElement>('[aria-label="Load a sample"]')!
    act(() => Simulate.change(presets, { target: { value: "5" } } as any))
    expect(value("Stored start (UTC ISO)")).toBe("2026-03-28T23:00:00.000Z")
    expect(value("Elapsed hours")).toBe("23")
    changeZone("Panel B: display / editing timezone", "UTC")
    expect(value("Elapsed hours")).toBe("23")
    changeZone("Simulated band lifecycle timezone", "UTC")
    expect(value("Elapsed hours")).toBe("24")
    expect(value("Stored start (UTC ISO)")).toBe("2026-03-29T00:00:00.000Z")
  })
})
