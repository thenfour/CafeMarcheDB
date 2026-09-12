import { beforeAll, describe, expect, it } from "vitest"
import type { EventDateConsumersProbe } from "./fixtures/eventDateConsumersProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

const policyGap = process.env.CMDB_DATETIME_AUDIT_STRICT === "1" ? it : it.fails

describe.each(["Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "UTC"])(
  "compact event date presentation in %s",
  timeZone => {
    let result: EventDateConsumersProbe
    beforeAll(() => {
      // gather evidence before asserting policy
      result = runTimeZoneProbe("tests/datetime/fixtures/eventDateConsumersProbe.ts", timeZone)
    })

    policyGap("describes a timed event as ongoing throughout its actual interval", () => {
      // date consumers should all agree on representation of relative time.
      // if an event is happening now, it's happening now for all users regardless of tz
      expect(result.ongoingTimed).toContain("Happening now")
    })

    it("does not describe a TBD event as ongoing", () => {
      expect(result.tbd).not.toContain("Happening now")
    })

    const allDayDate = timeZone === "America/Los_Angeles" ? policyGap : it
    allDayDate("preserves an all-day event's selected July 10 calendar date", () => {
      expect(result.allDay).toContain("Friday July 10")
    })

    if (timeZone === "Asia/Tokyo") {
      it("uses July 11 and Today for an upcoming local 00:30 event in Japan", () => {
        expect(result.tokyoToday).toContain("Saturday July 11")
        expect(result.tokyoToday).toContain(">Today<")
      })
    }
  },
)
