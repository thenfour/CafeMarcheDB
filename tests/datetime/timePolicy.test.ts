import { beforeAll, describe, expect, it } from "vitest"
import type { TimePolicyProbe } from "./fixtures/timePolicyProbe"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"

// Each expected failure asserts desired behavior, rather than preserving the bug.
// Strict mode exposes the red regressions for audit/reproduction. Remove .fails
// as each finding is fixed; an unexpected pass also fails the normal audit suite.
const zones = ["UTC", "Europe/Brussels", "Asia/Tokyo", "America/Los_Angeles"] as const
const observations = new Map<string, TimePolicyProbe>()
const inZone = (zone: string) => observations.get(zone)!

beforeAll(() => {
  for (const zone of zones) {
    observations.set(zone, runTimeZoneProbe<TimePolicyProbe>("tests/datetime/fixtures/timePolicyProbe.ts", zone))
  }
}, 30_000)

describe.each(zones)("date/time policy in %s", zone => {
  it("runs native Date in the requested timezone", () => {
    expect(inZone(zone).timeZone).toBe(zone)
  })

  it("captures an authored all-day calendar date as its actual band midnight instant", () => {
    expect(inZone(zone).authoredDate).toBe("2026-07-09T22:00:00.000Z")
  })

  it("preserves ordinary timed instants and elapsed durations across viewers", () => {
    expect(inZone(zone).timedStart).toBe("2026-07-10T07:45:00.000Z")
    expect(inZone(zone).timedEnd).toBe("2026-07-10T08:45:00.000Z")
  })

  it("treats start as inclusive and end as exclusive", () => {
    expect(inZone(zone).timedBoundaries).toEqual(["Future", "Present", "Present", "Past"])
  })

  it("keeps TBD outside every ongoing interval", () => {
    expect(inZone(zone).tbd).toEqual({
      start: null, end: null, timing: "Future", relative: { bucket: "TBD", label: "TBD" },
    })
  })

  it("does not place a timed event on its exclusive midnight end date", () => {
    expect(inZone(zone).midnightEndMembership).toEqual([true, false])
  })

  it("uses calendar tomorrow even when the start is only twenty minutes away", () => {
    expect(inZone(zone).tomorrowLabel).toBe("Tomorrow")
  })

  it("places a date described as Today on that same calendar date", () => {
    expect(inZone(zone).todayLabelAgreesWithCalendar).toBe(true)
  })

  it("sorts known instants chronologically with TBD last", () => {
    expect(inZone(zone).sortedDates).toEqual(["2026-07-10T00:00:00.000Z", "2026-07-11T00:00:00.000Z", null])
  })

  it("DT-02: reading a timed start preserves minutes, seconds and milliseconds", () => {
    expect(inZone(zone).offGridStart).toBe("2026-07-10T07:47:12.345Z")
  })

  it("DT-02: reading a duration preserves its elapsed milliseconds", () => {
    expect(inZone(zone).offGridDuration).toBe(20 * 60_000)
  })

  it("DT-08: a historical timestamp is not an ongoing fifteen-minute event", () => {
    expect(inZone(zone).timestampLabelAfterOneMinute).not.toBe("Happening now")
  })
})

describe("persisted all-day calendar dates", () => {
  it.each(zones.filter(zone => zone !== "America/Los_Angeles"))("preserves the stored date in %s", zone => {
    expect(inZone(zone).loadedDate).toBe("2026-07-09T22:00:00.000Z")
    expect(inZone(zone).displayedAllDayDate).toEqual([2026, 7, 10])
  })

  it("DT-01: loading a UTC all-day instant west of UTC preserves that date", () => {
    expect(inZone("America/Los_Angeles").loadedDate).toBe("2026-07-09T22:00:00.000Z")
  })

  it("DT-01: reconstructing a range from its spec is idempotent", () => {
    expect(inZone("America/Los_Angeles").loadedAgainDate).toBe(inZone("America/Los_Angeles").loadedDate)
  })

  it("DT-01: the displayed all-day date agrees with its persisted calendar date", () => {
    expect(inZone("America/Los_Angeles").displayedAllDayDate).toEqual([2026, 7, 10])
  })
})

describe("shared all-day lifecycle policy (band timezone Europe/Brussels)", () => {
  it("uses the agreed boundaries when the host already uses the band timezone", () => {
    expect(inZone("Europe/Brussels").allDayBandBoundaries).toEqual(["Future", "Present", "Present", "Past"])
  })

  for (const zone of zones.filter(zone => zone !== "Europe/Brussels")) {
    it(`POL-01: ${zone} observes the same absolute all-day start/end as the band`, () => {
      expect(inZone(zone).allDayBandBoundaries).toEqual(["Future", "Present", "Present", "Past"])
    })
  }
})

describe("DST and event aggregate ranges", () => {
  it("advances between calendar midnights through Brussels DST", () => {
    expect(inZone("Europe/Brussels").springDayElapsedHours).toBe(23)
    expect(inZone("Europe/Brussels").autumnDayElapsedHours).toBe(25)
  })

  it("DT-03: unioning an all-day event with itself preserves one day on the autumn transition", () => {
    expect(inZone("Europe/Brussels").identicalAutumnUnionHours).toBe(25)
  })

  it("DT-02: reading the second Brussels 02:30 preserves the specified UTC instant", () => {
    expect(inZone("Europe/Brussels").foldStart).toBe("2026-10-25T01:30:00.000Z")
  })

  it("DT-02: reading the second Pacific 01:30 preserves the specified UTC instant", () => {
    expect(inZone("America/Los_Angeles").pacificFoldStart).toBe("2026-11-01T09:30:00.000Z")
  })

  it("DT-03: an event aggregate covers every segment regardless of segment order", () => {
    const unions = inZone("UTC").mixedUnions
    expect({
      sameBoundsForEveryOrder: new Set(unions.map(range => `${range.start}/${range.end}`)).size === 1,
      coversEverySegment: unions.every(range => range.coversEverySegment),
    }).toEqual({ sameBoundsForEveryOrder: true, coversEverySegment: true })
  })

  it.each(["UTC", "Europe/Brussels", "Asia/Tokyo"])("keeps adjacent leap-year dates contiguous in %s", zone => {
    expect(inZone(zone).leapDayUnionHours).toBe(48)
  })
})
