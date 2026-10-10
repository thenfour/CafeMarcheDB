import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { MemberSongCreditsInputSchema } from "../shared/entities/user/memberSongCredits";
import { readMemberSongCredits } from "../server/memberSongCredits";

export default resolver.pipe(
    resolver.zod(MemberSongCreditsInputSchema),
    async (args, ctx: Ctx) => readMemberSongCredits(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/queries/getUserCredits.ts:1-36
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: d27a3a3a8c7cc1f6031188fe2b568b452752652638b406610b82121c1ae0260c
// MIGRATION_REFERENCE_BEGIN
// import { cmauthorize } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import { Permission } from "shared/permissions";
// import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
// import * as db3 from "../db3";
// import { queryView } from "../server/db3QueryCore";
//
// // type UserGetCreditsQueryResult = {
// //     songs: UserGetCreditsQueryResult_Song[];
// //     wikiPages: UserGetCreditsQueryResult_WikiPage[];
// //     filesUploaded: UserGetCreditsQueryResult_FileUploaded[];
// //     eventsCreated: UserGetCreditsQueryResult_EventCreated[];
// // };
//
// export default resolver.pipe(
//     cmauthorize(Permission.manage_users), // ?
//     resolver.zod(ZGetUserEventAttendanceArgrs),
//     async (args, ctx) => {
//         const authorization = ctx.auth;
//         const result = await queryView({
//             cmdbQueryContext: "getUserCredits",
//             view: db3.songCreditUserView,
//             filter: {
//                 tableParams: {
//                     userId: args.userId,
//                 },
//             },
//             orderBy: undefined,
//             take: args.take,
//         }, authorization);
//
//         return {
//             songCredits: result.items,
//         };
//     }
// );
// MIGRATION_REFERENCE_END
