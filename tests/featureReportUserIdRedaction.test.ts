// MIGRATION_DEFERRED_TEST
export {};

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:tests/featureReportUserIdRedaction.test.ts:1-31
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: c71c21ffb0946f485eb04d67c121abd00d6482eaff33cee5e80e99142922b696
// MIGRATION_REFERENCE_BEGIN
// import {
//     GeneralActivityReportDetailArgs,
//     GetFeatureReportDetailResultArgs
// } from "src/core/components/featureReports/activityReportTypes";
// import { describe, expect, it } from "vitest";
//
// const rawAction = {
//     id: 1,
//     userId: 42,
//     uri: "https://band.test/backstage/user/867/profile?tab=activity",
//     event: null,
//     song: null,
//     songCreditType: null,
//     eventSegment: null,
//     attendance: null,
//     eventSongList: null,
//     frontpageGalleryItem: null,
//     instrument: null,
// };
//
// describe("activity report User identity boundary", () => {
//     it("selects only safe fields from related rows", () => {
//         expect(GeneralActivityReportDetailArgs.include).not.toHaveProperty("user");
//         expect(GeneralActivityReportDetailArgs.include.file).toEqual({
//             select: { publicId: true, fileLeafName: true, storedLeafName: true, externalURI: true },
//         });
//         expect(GetFeatureReportDetailResultArgs.select).not.toHaveProperty("user");
//         expect(GetFeatureReportDetailResultArgs.select.customLink).toEqual({ select: { publicId: true, name: true } });
//         expect(GetFeatureReportDetailResultArgs.select.menuLink).toEqual({ select: { publicId: true, caption: true } });
//     });
// });
// MIGRATION_REFERENCE_END
