import { describe, expect, it } from "vitest";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { parsePublicId } from "shared/publicId";
import { CalendarDate } from "shared/dateTimePolicy";
import { GeneralFeatureReportInputSchema, type GeneralFeatureReportInput } from "src/core/components/featureReports/activityReportTypes";
import { activityReportDateRange, type ActivityReportPeriod } from "src/core/components/featureReports/activityReportTiming";
import { activityTimeZonePeriods } from "src/core/components/featureReports/server/activityTimeline";

const input: GeneralFeatureReportInput = {
    bandPublicId: parsePublicId<"Band">("ActivityBand0001"),
    startDate: new Date("2026-01-01T00:00:00Z"), endDateExclusive: new Date("2026-04-01T00:00:00Z"),
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        includeFeatures: [], excludeFeatures: [], contextBeginsWith: null },
};

describe("activity timeline input", () => {
    it("requires caller-owned defaults and explicit public band context", () => {
        expect(GeneralFeatureReportInputSchema.parse(input)).toEqual(input);
        expect(GeneralFeatureReportInputSchema.safeParse({ ...input, bandPublicId: undefined }).success).toBe(false);
        expect(GeneralFeatureReportInputSchema.safeParse({ ...input, filterSpec: {} }).success).toBe(false);
    });
    it.each([
        { bandPublicId: 1 }, { bandId: 1 }, { timeZone: "Asia/Tokyo" }, { endDate: input.endDateExclusive },
        { startDate: "2026-01-01" }, { startDate: new Date("invalid") },
        { startDate: input.endDateExclusive }, { endDateExclusive: input.startDate },
        { startDate: new Date("1899-12-31") }, { endDateExclusive: new Date("3001-01-01") },
    ])("rejects forged context and invalid bounds: %j", overrides => {
        expect(GeneralFeatureReportInputSchema.safeParse({ ...input, ...overrides }).success).toBe(false);
    });
    it.each([
        { userId: 42 }, { eventId: "PrivateEvent001" }, { bucketSize: "fortnight" }, { excludeYourself: "false" },
        { excludeSysadmins: undefined }, { contextBeginsWith: "x".repeat(257) }, { includeFeatures: [""] },
    ])("rejects unsupported or malformed filters: %j", overrides => {
        expect(GeneralFeatureReportInputSchema.safeParse({ ...input, filterSpec: { ...input.filterSpec, ...overrides } }).success).toBe(false);
    });
});

describe("band calendar reporting periods", () => {
    it("includes today in the band's zone even when UTC is on the previous day", () => {
        const range = activityReportDateRange(new Date("2026-01-31T16:00:00Z"), "Asia/Tokyo", "month");
        expect(range).toEqual({ startDate: new Date("2025-12-31T15:00:00Z"), endDateExclusive: new Date("2026-02-01T15:00:00Z") });
    });
    it("uses midnight boundaries through DST and clamps calendar month subtraction", () => {
        const range = activityReportDateRange(new Date("2026-03-31T12:00:00Z"), "Europe/Brussels", "month");
        expect(range).toEqual({ startDate: new Date("2026-02-27T23:00:00Z"), endDateExclusive: new Date("2026-03-31T22:00:00Z") });
    });
    const periods: Array<[ActivityReportPeriod, string]> = [
        ["year", "2025-03-31"], ["sixMonths", "2025-09-30"], ["threeMonths", "2025-12-31"], ["month", "2026-02-28"], ["twoWeeks", "2026-03-17"],
    ];
    it.each(periods)("uses calendar arithmetic for %s", (period, expectedStart) => {
        const range = activityReportDateRange(new Date("2026-03-31T12:00:00Z"), "Europe/Brussels", period);
        expect(CalendarDate.fromInstant({ value: range.startDate, timeZone: "Europe/Brussels" }).date).toBe(expectedStart);
    });
});

describe("reporting time-zone offsets", () => {
    it("splits spring and autumn at the exact UTC transitions", () => {
        expect(activityTimeZonePeriods(new Date("2026-03-29T00:00:00Z"), new Date("2026-10-25T03:00:00Z"), "Europe/Brussels"))
            .toEqual([
                { start: new Date("2026-03-29T00:00:00Z"), endExclusive: new Date("2026-03-29T01:00:00Z"), offsetSeconds: 3600 },
                { start: new Date("2026-03-29T01:00:00Z"), endExclusive: new Date("2026-10-25T01:00:00Z"), offsetSeconds: 7200 },
                { start: new Date("2026-10-25T01:00:00Z"), endExclusive: new Date("2026-10-25T03:00:00Z"), offsetSeconds: 3600 },
            ]);
    });
    it("uses the new offset at a transition and does not create an empty trailing period", () => {
        expect(activityTimeZonePeriods(new Date("2026-03-29T01:00:00Z"), new Date("2026-10-25T01:00:00Z"), "Europe/Brussels"))
            .toEqual([{ start: new Date("2026-03-29T01:00:00Z"), endExclusive: new Date("2026-10-25T01:00:00Z"), offsetSeconds: 7200 }]);
    });
    it("keeps a fixed-offset zone in one period", () => {
        expect(activityTimeZonePeriods(input.startDate, input.endDateExclusive, "Asia/Tokyo"))
            .toEqual([{ start: input.startDate, endExclusive: input.endDateExclusive, offsetSeconds: 32400 }]);
    });
});
