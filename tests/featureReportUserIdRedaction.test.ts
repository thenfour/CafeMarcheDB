import {
    GeneralActivityReportDetailArgs,
    GetFeatureReportDetailResultArgs
} from "src/core/components/featureReports/activityReportTypes";
import { describe, expect, it } from "vitest";

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
    it("selects only safe fields from related rows", () => {
        expect(GeneralActivityReportDetailArgs.include).not.toHaveProperty("user");
        expect(GeneralActivityReportDetailArgs.include.file).toEqual({
            select: { publicId: true, fileLeafName: true, storedLeafName: true, externalURI: true },
        });
        expect(GetFeatureReportDetailResultArgs.select).not.toHaveProperty("user");
        expect(GetFeatureReportDetailResultArgs.select.customLink).toEqual({ select: { id: true, name: true } });
    });
});
