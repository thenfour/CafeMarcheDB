import { expect, it } from "vitest"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

it("preserves the established compact English date and clock forms", () => {
  expect(runTimeZoneProbe("tests/datetime/fixtures/compactFormattingProbe.ts", "UTC")).toEqual([
    "Friday, 10 July 2026 @ 20-22h",
    "Friday, 10 July 2026 @ 20:15-22:30h",
    "Friday, 10 July 2026 @ 23-3h",
    "Friday, 10 July 2026",
    "10 - 11 July 2026",
    "31 July - 1 August 2026",
    "31 December 2026 - 2 January 2027",
    "TBD",
  ])
})
