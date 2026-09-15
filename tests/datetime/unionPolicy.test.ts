import { beforeAll, describe, expect, it } from "vitest"
import type { UnionPolicyProbe } from "./fixtures/unionPolicyProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

describe.each(["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles", "Australia/Sydney"])(
  "DT-03 range aggregation in %s",
  timeZone => {
    let result: UnionPolicyProbe
    beforeAll(() => {
      result = runTimeZoneProbe("tests/datetime/fixtures/unionPolicyProbe.ts", timeZone)
    }, 20_000)

    it("runs in the requested native timezone", () => {
      expect(result.timeZone).toBe(timeZone)
    })

    it("preserves expected bounds across DST, midnight, leap-day and year boundaries in every order", () => {
      for (const fixture of result.results) {
        for (const order of fixture.orders) expect({ name: fixture.name, value: order.value }).toEqual({ name: fixture.name, value: fixture.expected })
      }
    })

    it("covers every included segment and midnight point, retaining gaps inside the aggregate", () => {
      for (const fixture of result.results) expect({ name: fixture.name, covered: fixture.orders.every(order => order.coversAll) }).toEqual({ name: fixture.name, covered: true })
    })

    it("preserves union bounds when its spec is reconstructed", () => {
      for (const fixture of result.results) for (const order of fixture.orders) expect(order.hydrated).toEqual(fixture.expected)
    })

    it("preserves binary union idempotence", () => {
      for (const value of result.idempotence) expect(value.actual).toEqual(value.expected)
    })

    it("keeps positive-interval binary reductions invariant under order and grouping", () => {
      for (const value of result.pairCases) {
        expect(value.left).toEqual(value.expected)
        expect(value.right).toEqual(value.expected)
      }
    })

    it("does not mutate source ranges", () => {
      expect(result.results.every(fixture => fixture.inputsUnchanged)).toBe(true)
    })

    it("uses the same bounds through the production event-segment aggregator", () => {
      for (const fixture of result.results) for (const order of fixture.orders) expect(order.aggregate).toEqual(fixture.expected)
    })

    it("excludes cancelled and TBD segments from the known aggregate", () => {
      expect(result.filtered).toEqual({ start: "2026-07-09T00:00:00.000Z", duration: 3 * 86_400_000, allDay: true })
    })

    it("keeps empty, all-TBD and all-cancelled collections undated", () => {
      for (const value of [result.empty, result.allTbd, result.allCancelled]) expect(value).toEqual({ start: null, duration: 86_400_000, allDay: true })
    })

    it("persists complete aggregate bounds through the actual writer for every segment order", () => {
      expect(result.writerUsesEventFilter).toBe(true)
      expect(result.writes).toHaveLength(6)
      for (const value of result.writes) expect(value).toEqual({ start: "2026-07-09T00:00:00.000Z", duration: 3 * 86_400_000, allDay: true, end: result.expectedWriteEnd })
    })

    it("does not inject the current time into the minimum segment date", () => {
      expect(result.minFuture).toBe("2099-07-10T07:47:12.345Z")
      expect(result.minEmpty).toBeNull()
    })
  },
)
