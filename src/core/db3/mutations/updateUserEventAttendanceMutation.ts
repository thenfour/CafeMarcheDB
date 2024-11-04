import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { AreAnyDefined, CreateChangeContext, ObjectDiff } from "shared/utils";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateUserEventAttendanceMutationArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateUserEventAttendanceMutationArgs, ctx: AuthenticatedCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        let didSegmentChangesOccur = false;

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
                    const ur = await mutationCore.updateImpl(db3.xEventSegmentUserResponse, existing.id, {
                        attendanceId: segmentArgs.attendanceId,
                    }, ctx, clientIntention);
                    didSegmentChangesOccur = didSegmentChangesOccur || ur.didChangesOccur;
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
        if (args.eventId != null) {//} && AreAnyDefined([args.comment, args.instrumentId, args.isInvited])) {
            const existing = await db.eventUserResponse.findFirst({
                where: {
                    userId: args.userId,
                    eventId: args.eventId,
                }
            });

            if (existing) {
                const desired: Prisma.EventUserResponseUncheckedUpdateInput = {
                    userComment: args.comment,
                    instrumentId: args.instrumentId,
                    isInvited: args.isInvited,
                    revision: existing.revision + 1,
                };

                // avoid incrementing revision when nothing changed.
                let isEventUserResponseDifferent = false;
                if (args.comment !== undefined && args.comment !== existing.userComment) isEventUserResponseDifferent = true;
                if (args.instrumentId !== undefined && args.instrumentId !== existing.instrumentId) isEventUserResponseDifferent = true;
                if (args.isInvited !== undefined && args.isInvited !== existing.isInvited) isEventUserResponseDifferent = true;

                if (isEventUserResponseDifferent || didSegmentChangesOccur) {
                    await mutationCore.updateImpl(db3.xEventUserResponse, existing.id, desired, ctx, clientIntention);
                }
                return args;
            }

            const fields: Prisma.EventUserResponseUncheckedCreateInput = {
                userId: args.userId,
                eventId: args.eventId,

                userComment: args.comment || "",
                instrumentId: args.instrumentId,
                isInvited: args.isInvited,
                revision: 1,
            };

            await mutationCore.insertImpl(db3.xEventUserResponse, fields, ctx, clientIntention);
        }
        return args;
    }
);

