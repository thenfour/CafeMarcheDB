import React from "react"
import { JSDOM } from "jsdom"
import { DateTimeRange } from "../../../shared/time"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
})

// jsdom has no layout. Supply only row heights so the real calendar can measure
// capacity; its own localizer and layout code still choose dates and spans.
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  const height = this.classList.contains("rbc-month-row") ? 140 : 20
  return { x: 0, y: 0, top: 0, left: 0, right: 700, bottom: height, width: 700, height, toJSON: () => ({}) }
}
const { createRoot } = require("react-dom/client") as typeof import("react-dom/client")
const { act } = require("react-dom/test-utils") as typeof import("react-dom/test-utils")
const { Calendar, momentLocalizer } = require("react-big-calendar") as typeof import("react-big-calendar")
const moment = require("moment") as typeof import("moment")
require("moment/locale/nl-be")
const localizer = momentLocalizer(moment)

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function probe(startsAt: Date | null, durationMillis: number, isAllDay: boolean) {
  const range = new DateTimeRange({ startsAtDateTime: startsAt, durationMillis, isAllDay }).getCalendarDisplayRange()
  if (!range) return null
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(React.createElement(Calendar, {
    localizer,
    // The November view includes all three Oct 31-Nov 2 dates; October's grid
    // ends on Nov 1. Keep the full fixture within the rendered month grid.
    date: range.end,
    onNavigate: () => {},
    views: ["month"],
    events: [{ ...range, title: "probe" }],
    startAccessor: "start", endAccessor: "end", allDayAccessor: "allDay",
    components: { dateHeader: ({ date }: { date: Date }) => React.createElement("span", { "data-date": localDate(date) }) },
  })))
  const days: string[] = []
  for (const event of container.querySelectorAll<HTMLElement>(".rbc-event")) {
    const segment = event.closest<HTMLElement>(".rbc-row-segment")!
    const week = segment.closest(".rbc-month-row")!
    const headings = [...week.querySelectorAll<HTMLElement>("[data-date]")].map(e => e.dataset.date!)
    let offset = 0
    for (let sibling = segment.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      offset += Math.round(parseFloat((sibling as HTMLElement).style.flexBasis) * 7 / 100)
    }
    const length = Math.round(parseFloat(segment.style.flexBasis) * 7 / 100)
    days.push(...headings.slice(offset, offset + length))
  }
  act(() => root.unmount())
  container.remove()
  return {
    start: range.start.toISOString(), end: range.end.toISOString(),
    startDate: localDate(range.start), endDate: localDate(range.end),
    startHour: range.start.getHours(), endHour: range.end.getHours(),
    allDay: range.allDay, days,
  }
}

const allDayCases = {
  single: ["2026-07-10", 1],
  multi: ["2026-07-10", 4],
  brusselsSpring: ["2026-03-28", 3],
  brusselsFall: ["2026-10-24", 3],
  losAngelesSpring: ["2026-03-07", 3],
  losAngelesFall: ["2026-10-31", 3],
  sydneySpring: ["2026-10-03", 3],
  sydneyFall: ["2026-04-04", 3],
} as const
const allDay = Object.fromEntries(Object.entries(allDayCases).map(([name, [date, days]]) =>
  [name, probe(new Date(`${date}T00:00:00.000Z`), days * 86_400_000, true)!]))
const result = {
  allDay,
  tokyoMidnight: probe(new Date("2026-07-10T15:30:00.000Z"), 3_600_000, false)!,
  overnight: probe(new Date(2026, 6, 10, 23), 2 * 3_600_000, false)!,
  midnightEnd: probe(new Date(2026, 6, 10, 23), 3_600_000, false)!,
  zero: probe(new Date(2026, 6, 10), 0, false)!,
  preciseFold: probe(new Date("2026-10-25T01:30:12.345Z"), 1_200_789, false)!,
  tbd: probe(null, 86_400_000, true),
}
dom.window.close()
process.stdout.write(JSON.stringify(result))
export type CalendarDisplayProbe = typeof result
