import { describe, expect, it } from "vitest";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { parsePublicId } from "shared/publicId";
import { FacetedBreakdownInputSchema, type FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import { activityBucketIntervals } from "src/core/components/featureReports/server/activityBucketSelection";
import { activityParticipantToken } from "src/core/components/featureReports/server/activityAnonymization";
import { changeActivityFacetFilter, emptyActivityFacetFilters, type ActivityReportFilters } from "src/core/components/featureReports/ClientFacetHandlers";

const input: FacetedBreakdownInput = {
    bandPublicId: parsePublicId<"Band">("ActivityBand0001"),
    startDate: new Date("2026-01-01T00:00:00Z"), endDateExclusive: new Date("2027-01-01T00:00:00Z"),
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        includeFeatures: [], excludeFeatures: [], contextBeginsWith: null },
    selectedBucket: "2026-04-01", facetFilters: emptyActivityFacetFilters(),
};

describe("activity facet input", () => {
    it("requires explicit filter choices, dates and public band context", () => {
        expect(FacetedBreakdownInputSchema.parse(input)).toEqual(input);
        expect(FacetedBreakdownInputSchema.safeParse({ ...input, facetFilters: {} }).success).toBe(false);
    });
    it.each([
        { bandId: 1 }, { bandPublicId: 1 }, { selectedBucket: null }, { selectedBucket: "" }, { timeZone: "UTC" },
        { startDate: input.endDateExclusive }, { userId: 42 },
    ])("rejects unsupported context: %j", override => {
        expect(FacetedBreakdownInputSchema.safeParse({ ...input, ...override }).success).toBe(false);
    });
    it.each([{ includeSongIds: [1] }, { includeEventIds: ["invalid"] }, { excludeMenuLinkIds: ["42"] },
        { includeUserIds: [42] }, { includeBrowserNames: [""] }, { includeTimezones: ["x".repeat(257)] },
        { includeLocales: Array(257).fill("en") },
    ])("rejects invalid or unsupported facet filters: %j", overrides => {
        expect(FacetedBreakdownInputSchema.safeParse({ ...input, facetFilters: { ...input.facetFilters, ...overrides } }).success).toBe(false);
    });
});

describe("selected band-calendar bucket", () => {
    const intervals = (bucket: string, bucketSize = ActivityReportTimeBucketSize.day) => activityBucketIntervals(
        { ...input, filterSpec: { ...input.filterSpec, bucketSize } }, bucket, "Europe/Brussels");
    it("uses half-open local days with spring and autumn DST durations", () => {
        expect(intervals("2026-03-29")).toEqual([
            { start: new Date("2026-03-28T23:00:00Z"), endExclusive: new Date("2026-03-29T01:00:00Z") },
            { start: new Date("2026-03-29T01:00:00Z"), endExclusive: new Date("2026-03-29T22:00:00Z") },
        ]);
        expect(intervals("2026-10-25").reduce((sum, range) => sum + range.endExclusive.valueOf() - range.start.valueOf(), 0)).toBe(25 * 3600000);
    });
    it("selects both repeated hours and matches no nonexistent hour", () => {
        expect(intervals("2026-10-25 02:00:00", ActivityReportTimeBucketSize.hour)).toEqual([
            { start: new Date("2026-10-25T00:00:00Z"), endExclusive: new Date("2026-10-25T01:00:00Z") },
            { start: new Date("2026-10-25T01:00:00Z"), endExclusive: new Date("2026-10-25T02:00:00Z") },
        ]);
        expect(intervals("2026-03-29 02:00:00", ActivityReportTimeBucketSize.hour)).toEqual([]);
    });
    it("keeps the ISO week-year and clips partial buckets to the report dates", () => {
        expect(intervals("2026-01", ActivityReportTimeBucketSize.week)).toEqual([
            { start: input.startDate, endExclusive: new Date("2026-01-04T23:00:00Z") },
        ]);
        expect(intervals("2026", ActivityReportTimeBucketSize.year).at(-1)?.endExclusive).toEqual(new Date("2026-12-31T23:00:00Z"));
        expect(intervals("all", ActivityReportTimeBucketSize.all)).toEqual([{ start: input.startDate, endExclusive: input.endDateExclusive }]);
    });
    it.each([
        ["2026-02-30", ActivityReportTimeBucketSize.day], ["2026-00", ActivityReportTimeBucketSize.week],
        ["2025-53", ActivityReportTimeBucketSize.week], ["2026-13", ActivityReportTimeBucketSize.month],
        ["2026-01-01 24:00:00", ActivityReportTimeBucketSize.hour], ["all", ActivityReportTimeBucketSize.day],
        ["2026-01", ActivityReportTimeBucketSize.all],
    ])("rejects a malformed %s bucket", (bucket, size) => {
        expect(() => intervals(bucket, size)).toThrow();
    });
});

describe("activity facet controls", () => {
    const filters: ActivityReportFilters = { timeline: input.filterSpec, facets: input.facetFilters };
    it("isolates, hides and clears without mutating the previous selection", () => {
        const hidden = changeActivityFacetFilter(filters, "browsers", "hide", "Chrome");
        const repeated = changeActivityFacetFilter(hidden, "browsers", "hide", "Chrome");
        expect(repeated.facets.excludeBrowserNames).toEqual(["Chrome"]);
        const isolated = changeActivityFacetFilter(repeated, "browsers", "isolate", "Firefox");
        expect(isolated.facets.includeBrowserNames).toEqual(["Firefox"]);
        expect(isolated.facets.excludeBrowserNames).toEqual([]);
        expect(changeActivityFacetFilter(isolated, "browsers", "clear", "").facets).toEqual(filters.facets);
        expect(filters.facets.excludeBrowserNames).toEqual([]);
    });
    it("updates top-level feature/context filters and retains unrelated filters", () => {
        const feature = changeActivityFacetFilter(filters, "features", "isolate", "event_view");
        const context = changeActivityFacetFilter(feature, "contexts", "isolate", "parent/child");
        expect(context.timeline).toMatchObject({ includeFeatures: ["event_view"], contextBeginsWith: "parent/child" });
        expect(changeActivityFacetFilter(context, "contexts", "removeInclude", "parent/child").timeline.contextBeginsWith).toBeNull();
    });
    it("validates public entity keys and removes individual filter chips", () => {
        const song = parsePublicId<"Song">("ActivitySong0001");
        const isolated = changeActivityFacetFilter(filters, "songs", "isolate", song);
        expect(isolated.facets.includeSongIds).toEqual([song]);
        expect(changeActivityFacetFilter(isolated, "songs", "removeInclude", song).facets.includeSongIds).toEqual([]);
        expect(() => changeActivityFacetFilter(filters, "songs", "isolate", "42")).toThrow();
        expect(() => changeActivityFacetFilter(filters, "users", "isolate", "42")).toThrow();
    });
});

describe("anonymous person tokens", () => {
    it("correlates the same selection without exposing or permanently tracking a person", () => {
        const token = activityParticipantToken(42, input);
        expect(token).toMatch(/^[a-f0-9]{64}$/);
        expect(activityParticipantToken(42, input)).toBe(token);
        expect(activityParticipantToken(43, input)).not.toBe(token);
        expect(activityParticipantToken(42, { ...input, bandPublicId: parsePublicId<"Band">("ActivityBand0002") })).not.toBe(token);
        expect(activityParticipantToken(42, { ...input, selectedBucket: "2026-04-02" })).not.toBe(token);
        expect(activityParticipantToken(42, { ...input, facetFilters: { ...input.facetFilters, includeLocales: ["fr-BE"] } })).not.toBe(token);
    });
});
