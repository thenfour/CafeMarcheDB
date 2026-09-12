import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { EventShortDate as EventShortDateComponent } from "../../../src/core/components/event/RelevantEvents"

// EventShortDate shares a module with the complete dashboard. Its sibling
// components are not involved in this render, so omit their module imports.
// React and the production date helpers still execute unchanged.
//
// todo: isolate EventShortDate better to avoid this hack.
const moduleLoader = require("node:module")
const nativeLoad = moduleLoader._load
moduleLoader._load = function (request: string, parent: { filename?: string }, ...args: unknown[]) {
  if (parent?.filename?.replace(/\\/g, "/").endsWith("/event/RelevantEvents.tsx")
    && !["react", "react/jsx-runtime", "shared/time"].includes(request)) return {}
  return nativeLoad.call(this, request, parent, ...args)
}
let EventShortDate: typeof EventShortDateComponent
try {
  EventShortDate = require("../../../src/core/components/event/RelevantEvents").EventShortDate
} finally {
  moduleLoader._load = nativeLoad
}

// Render the real date used by the dashboard's compact event cards. Only the
// clock and browser locale are supplied; date interpretation remains app code.
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "en-US" },
})

const NativeDate = Date
let now = new NativeDate("2026-07-10T18:00:00.000Z")
class FixedDate extends NativeDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(now.valueOf())
    else if (args.length === 1) super(args[0])
    else super(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0)
  }
  static now() { return now.valueOf() }
}
globalThis.Date = FixedDate as DateConstructor

function renderEvent(startsAt: string, durationMillis: number, isAllDay: boolean, refTime: string) {
  now = new NativeDate(refTime)
  const event = { startsAt: new Date(startsAt), durationMillis: BigInt(durationMillis), isAllDay }
  return renderToStaticMarkup(React.createElement(EventShortDate, { event }))
}

const result = {
  ongoingTimed: renderEvent("2026-07-10T16:00:00.000Z", 4 * 3_600_000, false, "2026-07-10T18:00:00.000Z"),
  allDay: renderEvent("2026-07-10T00:00:00.000Z", 86_400_000, true, "2026-07-10T12:00:00.000Z"),
  tokyoToday: renderEvent("2026-07-10T15:30:00.000Z", 3_600_000, false, "2026-07-10T15:10:00.000Z"),
  tbd: renderToStaticMarkup(React.createElement(EventShortDate, { event: { startsAt: null } })),
}
globalThis.Date = NativeDate
process.stdout.write(JSON.stringify(result))

export type EventDateConsumersProbe = typeof result
