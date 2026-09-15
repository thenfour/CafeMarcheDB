import { beforeAll, describe, expect, it } from "vitest"
import type { CalendarDisplayProbe } from "./fixtures/calendarDisplayProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney", "UTC"])(
  "calendar display in %s", timeZone => {
    let result: CalendarDisplayProbe
    beforeAll(() => { result = runTimeZoneProbe("tests/datetime/fixtures/calendarDisplayProbe.ts", timeZone) })

    it.each([
      ["single", ["2026-07-10"], "2026-07-11"],
      ["multi", ["2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13"], "2026-07-14"],
      ["brusselsSpring", ["2026-03-28", "2026-03-29", "2026-03-30"], "2026-03-31"],
      ["brusselsFall", ["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-27"],
      ["losAngelesSpring", ["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-10"],
      ["losAngelesFall", ["2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-03"],
      ["sydneySpring", ["2026-10-03", "2026-10-04", "2026-10-05"], "2026-10-06"],
      ["sydneyFall", ["2026-04-04", "2026-04-05", "2026-04-06"], "2026-04-07"],
    ])("places all-day %s on exactly its selected dates", (name, days, endDate) => {
      const displayed = result.allDay[name as string]!
      expect(displayed.days).toEqual(days)
      expect(displayed.startDate).toBe(days[0])
      expect(displayed.endDate).toBe(endDate)
      expect(displayed.startHour).toBe(0)
      expect(displayed.endHour).toBe(0)
      expect(displayed.allDay).toBe(true)
    })

    it("places a timed instant on the viewer's calendar date", () => {
      const expected = ["Asia/Tokyo", "Australia/Sydney"].includes(timeZone) ? "2026-07-11" : "2026-07-10"
      expect(result.tokyoMidnight.days).toEqual([expected])
      expect(result.tokyoMidnight.start).toBe("2026-07-10T15:30:00.000Z")
      expect(result.tokyoMidnight.end).toBe("2026-07-10T16:30:00.000Z")
      expect(result.tokyoMidnight.allDay).toBe(false)
    })

    it("places an overnight timed event on both dates", () => {
      expect(result.overnight.days).toEqual(["2026-07-10", "2026-07-11"])
    })

    it("places a zero-duration midnight event on its date", () => {
      expect(result.zero.days).toEqual(["2026-07-10"])
      expect(result.zero.end).toBe(result.zero.start)
    })

    it("does not place an exclusive midnight end on the following day", () => {
      expect(result.midnightEnd.days).toEqual(["2026-07-10"])
    })

    it("preserves the exact later fold occurrence and elapsed duration", () => {
      expect(result.preciseFold.start).toBe("2026-10-25T01:30:12.345Z")
      expect(result.preciseFold.end).toBe("2026-10-25T01:50:13.134Z")
    })

    it("omits TBD ranges from calendar placement", () => {
      expect(result.tbd).toBeNull()
    })
  },
)
