import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("eventWorkflows"),
);

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/mutations/setEventRelevanceClassOverride.ts:1-31
// Reason: Event screens still mount incomplete search, editing and invitation contracts.
// Restore: Restore event search/detail/editing, segments, invitations and frontpage editing through explicit band snapshots, public references and localized catalogs; retain migrated creation, attendance and calendar endpoints.
// Verification: Verify two-band search/facets/paging, event and segment edits, invitation precedence, visibility, revoked grants and complete built-browser workflows.
// SHA256: b9341cad42af3009a1fb0f65ce77288a038d2ad172f868961227fe1950620670
// MIGRATION_REFERENCE_BEGIN
// import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { resolvePublicId } from "../server/db3PublicIds";
// import { gEventRelevanceClass } from "../shared/eventRelevance";
//
// const ZArgs = z.object({
//     eventId: db3.xEvent.identitySchema,
//     relevanceClassOverrideName: z.string().nullable(),
// });
//
// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     cmauthorize(Permission.login),
//     resolver.zod(ZArgs),
//     async (args, ctx: CMAuthCtxWithUser) => {
//         const eventId = await resolvePublicId(db3.xEvent, args.eventId, ctx.auth, db, true);
//         const relevanceClassValue = args.relevanceClassOverrideName == null ? null : gEventRelevanceClass[args.relevanceClassOverrideName] || null;
//
//         const fields: Prisma.EventUncheckedUpdateInput = {
//             relevanceClassOverride: relevanceClassValue,
//         };
//
//         await mutationCore.updateImpl(db3.xEvent, eventId, fields, ctx.auth);
//         return args;
//     }
// );
// MIGRATION_REFERENCE_END
