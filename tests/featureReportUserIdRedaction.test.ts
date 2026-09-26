import { describe, expect, it } from "vitest";
import {
    GeneralActivityReportDetailArgs,
    GetFeatureReportDetailResultArgs,
    projectFeatureReportDetailItem,
    projectGeneralActivityReportDetailItem,
} from "src/core/components/featureReports/activityReportTypes";

const rawAction = {
    id: 1,
    userId: 42,
    uri: "https://band.test/backstage/user/867/profile?tab=activity",
    event: null,
    song: null,
    songCreditType: null,
    eventSegment: null,
    attendance: null,
    eventSongList: null,
    frontpageGalleryItem: null,
    instrument: null,
};

describe("activity report User identity boundary", () => {
    it("keeps only the user hash slot and redacts historic numeric profile URLs", () => {
        // This fixture supplies only fields read by the projection functions.
        const general = projectGeneralActivityReportDetailItem(rawAction as unknown as Parameters<typeof projectGeneralActivityReportDetailItem>[0], "anonymous");
        const detail = projectFeatureReportDetailItem(rawAction as unknown as Parameters<typeof projectFeatureReportDetailItem>[0]);
        for (const projected of [general, detail]) {
            expect(projected).not.toHaveProperty("userId");
            expect(projected).not.toHaveProperty("user");
            expect(projected.uri).toBe("https://band.test/backstage/user/[legacy-user]/profile?tab=activity");
        }
    });

    it("selects only safe fields from related rows", () => {
        expect(GeneralActivityReportDetailArgs.include).not.toHaveProperty("user");
        expect(GeneralActivityReportDetailArgs.include.file).toEqual({
            select: { publicId: true, fileLeafName: true, storedLeafName: true, externalURI: true },
        });
        expect(GetFeatureReportDetailResultArgs.select).not.toHaveProperty("user");
        expect(GetFeatureReportDetailResultArgs.select.customLink).toEqual({ select: { id: true, name: true } });
    });
});
