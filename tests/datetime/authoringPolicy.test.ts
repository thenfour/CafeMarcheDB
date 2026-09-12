import { beforeAll, describe, expect, it } from "vitest"
import type { AuthoringPolicyProbe } from "./fixtures/authoringPolicyProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

// Record verified policy violations without leaving the normal suite red.
// Strict audit mode turns each expected failure into an ordinary failing test.
const policyGap = process.env.CMDB_DATETIME_AUDIT_STRICT === "1" ? it : it.fails

describe.each(["Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "UTC"])(
  "event date-control contracts in %s",
  timeZone => {
    let result: AuthoringPolicyProbe
    beforeAll(() => {
      result = runTimeZoneProbe("tests/datetime/fixtures/authoringPolicyProbe.ts", timeZone)
    })

    it("presents the selected clock hour on an ordinary editing day", () => {
      expect(result.clockOptions.ordinaryDay).toBe(3)
    })

    it("preserves the selected end time on an ordinary event day", () => {
      const selection = result.endSelections.find(item => item.caseName === "ordinary")!
      expect(selection.actualEnd).toBe(selection.expectedEnd)
    })

    it("preserves the selected day when turning all-day off at 23:45", () => {
      const toggle = result.allDayToggles.find(item => item.currentMinute === 45)!
      expect(toggle.actualDay).toEqual(toggle.expectedDay)
    })

    policyGap("preserves the selected day when turning all-day off at 23:50", () => {
      const toggle = result.allDayToggles.find(item => item.currentMinute === 50)!
      expect(toggle.actualDay).toEqual(toggle.expectedDay)
    })

    const transitionCase = timeZone === "Europe/Brussels" || timeZone === "America/Los_Angeles"
      ? policyGap
      : it

    transitionCase("presents July's 03:00 correctly when editing on the spring clock-change day", () => {
      expect(result.clockOptions.springTransitionDay).toBe(3)
    })

    transitionCase("presents July's 03:00 correctly when editing on the autumn clock-change day", () => {
      expect(result.clockOptions.autumnTransitionDay).toBe(3)
    })

    for (const caseName of ["spring", "autumn"] as const) {
      transitionCase(`preserves the selected 03:30 end across the ${caseName} transition`, () => {
        const selection = result.endSelections.find(item => item.caseName === caseName)!
        expect(selection.actualEnd).toBe(selection.expectedEnd)
      })
    }
  },
)
