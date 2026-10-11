import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { assessUserDependencyRisk, measureUserActivity } from "src/core/db3/shared/userDependencyRisk";
import { UserMassAnalysisRequestSchema } from "src/core/db3/shared/userMassAnalysisRequest";

const contentCounts = { createdSongs: 0, createdEvents: 0, createdWikiPages: 0, createdGalleryItems: 0, uploadedFiles: 0,
    createdMenuLinks: 0, createdCustomLinks: 0, songCredits: 0, setlistPlans: 0, wikiPageRevisions: 0 };
const participationCounts = { eventResponses: 0, eventSegmentResponses: 0, taggedFiles: 0, instruments: 0, userTags: 0 };
const activityMetrics = { accountAgeInDays: 90, hasEverLoggedIn: false, lastActivityDate: null, daysSinceLastActivity: null };
const input = { isProtectedAdministrator: false, hasElevatedGlobalRole: false, globalRoleName: null, isMerged: false,
    activeSessions: 0, contentCounts, participationCounts, activityMetrics };

describe("preserved account dependency risk thresholds", () => {
    it.each([{ count: 5, risk: "low", warn: false }, { count: 6, risk: "medium", warn: false },
        { count: 10, risk: "medium", warn: false }, { count: 11, risk: "medium", warn: true }])("keeps creator-content boundaries at $count", ({ count, risk, warn }) => {
        const result = assessUserDependencyRisk({ ...input, contentCounts: { ...contentCounts, createdSongs: count } });
        expect(result.riskLevel).toBe(risk);
        expect(result.safeToDelete).toBe(risk === "low");
        expect(result.warnings.length > 0).toBe(warn);
    });
    it.each([{ count: 10, risk: "low", warn: false }, { count: 11, risk: "medium", warn: false },
        { count: 20, risk: "medium", warn: false }, { count: 21, risk: "medium", warn: true }])("keeps participation boundaries including credits at $count", ({ count, risk, warn }) => {
        const result = assessUserDependencyRisk({ ...input, participationCounts: { ...participationCounts, eventResponses: count - 2 },
            contentCounts: { ...contentCounts, songCredits: 2 } });
        expect(result.riskLevel).toBe(risk);
        expect(result.warnings.length > 0).toBe(warn);
    });
    it("retains the original heuristic categories while all categories remain available in inventory", () => {
        const result = assessUserDependencyRisk({ ...input, contentCounts: { ...contentCounts, createdMenuLinks: 50, createdCustomLinks: 50, setlistPlans: 50, wikiPageRevisions: 50 },
            participationCounts: { ...participationCounts, taggedFiles: 50, instruments: 50, userTags: 50 } });
        expect(result).toEqual({ riskLevel: "low", safeToDelete: true, warnings: [], blockers: [] });
    });
    it.each([null, 0, 29, 30])("preserves the recent activity boundary and missing activity: %s", days => {
        const result = assessUserDependencyRisk({ ...input, activityMetrics: { ...activityMetrics, daysSinceLastActivity: days } });
        expect(result.warnings.length).toBe(days !== null && days < 30 ? 1 : 0);
    });
    it("raises combined warnings at three and never permits administrator or merged-account deletion", () => {
        const warned = { ...input, hasElevatedGlobalRole: true, globalRoleName: "", activeSessions: 1 };
        expect(assessUserDependencyRisk(warned).riskLevel).toBe("low");
        expect(assessUserDependencyRisk({ ...warned, activityMetrics: { ...activityMetrics, daysSinceLastActivity: 0 } }).riskLevel).toBe("medium");
        for (const authority of [{ isProtectedAdministrator: true }, { isMerged: true }]) {
            expect(assessUserDependencyRisk({ ...input, ...authority })).toMatchObject({ riskLevel: "high", safeToDelete: false });
        }
    });
    it("floors elapsed days, keeps missing activity distinct from today and clamps future timestamps", () => {
        const now = new Date("2026-03-30T03:00:00Z");
        expect(measureUserActivity(new Date("2026-03-28T04:00:00Z"), null, 0, now)).toEqual({
            accountAgeInDays: 1, hasEverLoggedIn: false, lastActivityDate: null, daysSinceLastActivity: null,
        });
        expect(measureUserActivity(now, now, 1, now)).toMatchObject({ accountAgeInDays: 0, hasEverLoggedIn: true, daysSinceLastActivity: 0 });
        expect(measureUserActivity(new Date("2099-01-01"), new Date("2099-01-01"), 1, now)).toMatchObject({ accountAgeInDays: 0, daysSinceLastActivity: 0 });
    });
});

describe("account-wide request contract", () => {
    const userId = parsePublicId<"User">("AnalysisPerson01");
    it("retains ordered preferences and invalidation with a public account identity", () => {
        const request = { userId, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "fresh" };
        expect(UserMassAnalysisRequestSchema.parse(request)).toEqual(request);
    });
    it.each([{ userId: 42 }, { userId: "42" }, { userId, bandPublicId: null }, { userId, bandId: 7 }, { userId, includeDeleted: false }])("rejects natural IDs and forged scope: %s", request => {
        expect(UserMassAnalysisRequestSchema.safeParse(request).success).toBe(false);
    });
});
