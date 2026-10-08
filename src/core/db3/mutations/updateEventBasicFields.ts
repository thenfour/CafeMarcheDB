import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("eventWorkflows"),
);

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/mutations/updateEventBasicFields.ts:1-74
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: 6a6ddf1046fe20f804450e1c6615e8b21a4509db65373fb53b6b69d1acbddaa4
// MIGRATION_REFERENCE_BEGIN
// // updateEventBasicFields
// import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { resolvePublicForeignIds, resolvePublicId } from "../server/db3PublicIds";
// import { TupdateEventBasicFieldsArgs } from "../shared/apiTypes";
//
// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     cmauthorize(Permission.login),
//     async (args: TupdateEventBasicFieldsArgs, ctx: CMAuthCtxWithUser) => {
//         const auth = ctx.auth;
//         const eventId = await resolvePublicId(db3.xEvent, args.eventId, auth, db, true);
//         const resolvedForeignIds = await resolvePublicForeignIds(
//             db3.xEvent,
//             {
//                 typeId: args.typeId,
//                 statusId: args.statusId,
//                 expectedAttendanceUserTagId: args.expectedAttendanceUserTagId,
//                 visiblePermissionId: args.visiblePermissionId,
//             },
//             auth,
//             db,
//         );
//
//         // Verbose on purpose in order to validate the resolved public identities
//         // against Prisma's natural-key update input at the trusted boundary.
//         const fields: Prisma.EventUncheckedUpdateInput = {
//             name: args.name,
//             //slug: args.slug,
//             //description: args.description,
//             typeId: resolvedForeignIds.typeId,
//             visiblePermissionId: resolvedForeignIds.visiblePermissionId,
//             locationDescription: args.locationDescription,
//             locationURL: args.locationURL,
//             isDeleted: args.isDeleted,
//             statusId: resolvedForeignIds.statusId,
//             expectedAttendanceUserTagId: resolvedForeignIds.expectedAttendanceUserTagId,
//
//             frontpageVisible: args.frontpageVisible,
//             frontpageDate: args.frontpageDate,
//             frontpageTime: args.frontpageTime,
//             frontpageTitle: args.frontpageTitle,
//             frontpageDetails: args.frontpageDetails,
//             frontpageLocation: args.frontpageLocation,
//             frontpageLocationURI: args.frontpageLocationURI,
//             frontpageTags: args.frontpageTags,
//
//             frontpageDate_nl: args.frontpageDate_nl,
//             frontpageTime_nl: args.frontpageTime_nl,
//             frontpageTitle_nl: args.frontpageTitle_nl,
//             frontpageDetails_nl: args.frontpageDetails_nl,
//             frontpageLocation_nl: args.frontpageLocation_nl,
//             frontpageLocationURI_nl: args.frontpageLocationURI_nl,
//             frontpageTags_nl: args.frontpageTags_nl,
//
//             frontpageDate_fr: args.frontpageDate_fr,
//             frontpageTime_fr: args.frontpageTime_fr,
//             frontpageTitle_fr: args.frontpageTitle_fr,
//             frontpageDetails_fr: args.frontpageDetails_fr,
//             frontpageLocation_fr: args.frontpageLocation_fr,
//             frontpageLocationURI_fr: args.frontpageLocationURI_fr,
//             frontpageTags_fr: args.frontpageTags_fr,
//         };
//
//
//         await mutationCore.updateImpl(db3.xEvent, eventId, fields, ctx.auth);
//
//         return args;
//     }
// );
// MIGRATION_REFERENCE_END
