import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateUserEventAttendanceMutationArgs } from "../shared/apiTypes";
import { AreAllDefined, AreAnyDefined } from "shared/utils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateUserEventAttendanceMutationArgs, ctx: AuthenticatedMiddlewareCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        if (args.segmentResponses) {
            const entries = Object.entries(args.segmentResponses);
            for (let i = 0; i < entries.length; ++i) {
                const [eventSegmentIdStr, segmentArgs] = entries[i]!;
                //await Object.entries(args.segmentResponses).forEach(async ([eventSegmentIdStr, segmentArgs]) => {
                const eventSegmentId = parseInt(eventSegmentIdStr); // why does Object.entries force this to string i don't understand. or rather why does Record<> allow setting the key type if it's always string?
                const existing = await db.eventSegmentUserResponse.findFirst({
                    where: {
                        userId: args.userId,
                        eventSegmentId,
                    }
                });

                if (existing) {
                    await mutationCore.updateImpl(db3.xEventSegmentUserResponse, existing.id, {
                        attendanceId: segmentArgs.attendanceId,
                    }, ctx, clientIntention);
                    continue;
                }

                const fields: Prisma.EventSegmentUserResponseUncheckedCreateInput = {
                    userId: args.userId,
                    eventSegmentId,

                    attendanceId: segmentArgs.attendanceId,
                };

                await mutationCore.insertImpl(db3.xEventSegmentUserResponse, fields, ctx, clientIntention);

            };
        }

        // EVENT response stuff.
        if (args.eventId != null && AreAnyDefined([args.comment, args.instrumentId, args.isInvited])) {
            const existing = await db.eventUserResponse.findFirst({
                where: {
                    userId: args.userId,
                    eventId: args.eventId,
                }
            });

            if (existing) {
                const fields: Prisma.EventUserResponseUncheckedUpdateInput = {
                    userComment: args.comment,
                    instrumentId: args.instrumentId,
                    isInvited: args.isInvited,
                };

                await mutationCore.updateImpl(db3.xEventUserResponse, existing.id, fields, ctx, clientIntention);
                return args;
            }

            const fields: Prisma.EventUserResponseUncheckedCreateInput = {
                userId: args.userId,
                eventId: args.eventId,

                userComment: args.comment || "",
                instrumentId: args.instrumentId,
                isInvited: args.isInvited,
            };

            await mutationCore.insertImpl(db3.xEventUserResponse, fields, ctx, clientIntention);
        }
        return args;
    }
);

