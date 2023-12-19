// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedMiddlewareCtx } from "blitz";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { TupdateUserEventInvitationMutationArgs } from "../shared/apiTypes";

// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     resolver.authorize(Permission.login),
//     async (args: TupdateUserEventInvitationMutationArgs, ctx: AuthenticatedMiddlewareCtx) => {
//         const currentUser = await mutationCore.getCurrentUserCore(ctx);
//         const clientIntention: db3.xTableClientUsageContext = {
//             intention: "user",
//             mode: "primary",
//             currentUser,
//         };

//         // TODO: authorize

//         // in ALL cases, we will ensure a EventUserResponse is existing.
//         const existing = await db.eventUserResponse.findFirst({
//             where: {
//                 userId: args.userId,
//                 eventId: args.eventId,
//             }
//         });

//         if (existing) {
//             const fields: Prisma.EventUserResponseUncheckedUpdateInput = {
//                 isInvited: args.isInvited,
//             };

//             await mutationCore.updateImpl(db3.xEventSegmentUserResponse, existing.id, fields, ctx, clientIntention);
//             return args;
//         }

//         const fields: Prisma.EventUserResponseUncheckedCreateInput = {
//             userId: args.userId,
//             eventId: args.eventId,

//             isInvited: args.isInvited,
//             userComment: "",
//             instrumentId: null,
//         };

//         await mutationCore.insertImpl(db3.xEventUserResponse, fields, ctx, clientIntention);
//         return args;
//     }
// );

