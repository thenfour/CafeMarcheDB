import { beforeAll, describe, expect, it } from "vitest"
import { runTimeZoneProbe } from "./support/runTimeZoneProbe"
import type { BandPolicyConsumersProbe } from "./fixtures/bandPolicyConsumersProbe"

describe.each(["UTC", "Europe/Brussels", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"])("POL-01 consumers in %s", zone => {
  let result: BandPolicyConsumersProbe
  beforeAll(() => { result = runTimeZoneProbe("tests/datetime/fixtures/bandPolicyConsumersProbe.ts", zone) }, 20_000)
  it("shares exact all-day boundaries for each configured band zone", () => {
    for (const bound of result.bounds) expect(bound.timing).toEqual(["Future", "Present", "Present", "Past"])
  })
  it("resolves 23-hour and 25-hour all-day intervals", () => {
    expect(result.spring).toEqual({ start: "2026-03-28T23:00:00.000Z", end: "2026-03-29T22:00:00.000Z" })
    expect(result.fall).toEqual({ start: "2026-10-24T22:00:00.000Z", end: "2026-10-25T23:00:00.000Z" })
  })
  it("keeps timed instants and elapsed duration independent of band time", () => {
    expect(result.foldInterval).toEqual({ start: "2026-10-25T01:30:12.345Z", end: "2026-10-25T01:50:13.134Z" })
  })
  it("distinguishes viewer calendar labels from globally ongoing", () => {
    expect(result.ongoingLabel.bucket).toBe("HappeningNow")
    expect(result.ongoingLabel.label).toBe(["UTC", "America/Los_Angeles"].includes(zone) ? "Tomorrow" : "Today")
    expect(result.endedLabel.label).toBe(["UTC", "America/Los_Angeles"].includes(zone) ? "Today" : "Yesterday")
    expect(result.endedLabel.bucket).not.toBe("HappeningNow")
  })
  it("projects mixed aggregate dates in the configured band zone", () => {
    expect(result.mixed).toEqual({ startsAtDateTime: "2026-07-10T00:00:00.000Z", durationMillis: 2 * 86_400_000, isAllDay: true })
    expect(result.mixedWestern.durationMillis).toBe(86_400_000)
  })
  it("persists band-derived mixed bounds through the real aggregate writer", () => {
    expect(result.persisted).toMatchObject({ startsAt: "2026-07-10T00:00:00.000Z", durationMillis: 2 * 86_400_000, isAllDay: true, endDateTime: "2026-07-11T22:00:00.000Z" })
  })
  it("changes a start date while retaining band clock time and precise duration", () => {
    expect(result.changedDate.startsAtDateTime).toBe("2026-07-11T22:30:12.345Z")
    expect(result.changedDate.durationMillis).toBe(1_200_789)
    expect(result.sameFoldDate.startsAtDateTime).toBe("2026-10-25T01:30:12.345Z")
  })
  it("uses compatible gap/fold handling only for newly authored dates", () => {
    expect(result.gap.startsAtDateTime).toBe("2026-03-29T01:30:00.000Z")
    expect(result.foldAuthoring.startsAtDateTime).toBe("2026-10-25T00:30:00.000Z")
  })
  it("preserves the selected band calendar date across all-day toggles", () => {
    expect(result.toAllDay.startsAtDateTime).toBe("2026-07-11T00:00:00.000Z")
    expect(result.toTimed.startsAtDateTime).toBe("2026-07-11T21:59:12.000Z")
  })
})
