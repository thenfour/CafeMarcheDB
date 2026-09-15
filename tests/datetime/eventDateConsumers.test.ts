import { beforeAll, describe, expect, it } from "vitest"
import type { EventDateConsumersProbe } from "./fixtures/eventDateConsumersProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "UTC"])(
  "compact event date presentation in %s",
  timeZone => {
    let result: EventDateConsumersProbe
    beforeAll(() => {
      // gather evidence before asserting policy
      result = runTimeZoneProbe("tests/datetime/fixtures/eventDateConsumersProbe.ts", timeZone)
    })

    it("describes a timed event as ongoing throughout its actual interval", () => {
      // date consumers should all agree on representation of relative time.
      // if an event is happening now, it's happening now for all users regardless of tz
      expect(result.ongoingTimed).toContain("Happening now")
    })

    it("does not describe a TBD event as ongoing", () => {
      expect(result.tbd).toBe("")
    })

    it("preserves an all-day event's selected July 10 calendar date", () => {
      expect(result.allDay).toContain("Friday July 10")
    })

    it.each([
      ["before", false],
      ["start", true],
      ["lastMillisecond", true],
      ["end", false],
      ["after", false],
    ] as const)("uses the actual half-open interval at %s", (boundary, ongoing) => {
      expect(result.boundaries[boundary].includes("Happening now")).toBe(ongoing)
    })

    it("does not describe a zero-duration event as ongoing", () => {
      expect(result.zeroDuration).not.toContain("Happening now")
    })

    it("keeps an overnight event ongoing after its start date", () => {
      expect(result.overnight).toContain("Happening now")
    })

    it("preserves a multi-day event's start date while describing it as Today", () => {
      expect(result.multiDay).toContain("Friday July 10")
      expect(result.multiDay).toContain(">Today<")
    })

    it("shows the year only when it differs from the supplied reference year", () => {
      expect(result.priorYear).toContain("2025")
      expect(result.sameYear).not.toContain("2025")
    })

    if (timeZone === "Asia/Tokyo") {
      it("uses July 11 and Today for an upcoming local 00:30 event in Japan", () => {
        expect(result.tokyoToday).toContain("Saturday July 11")
        expect(result.tokyoToday).toContain(">Today<")
      })
    }
  },
)
