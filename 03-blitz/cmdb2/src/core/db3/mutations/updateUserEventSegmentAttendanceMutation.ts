import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateUserEventSegmentAttendanceMutationArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("updateUserEventSegmentAttendanceMutation", Permission.login),
    async (args: TupdateUserEventSegmentAttendanceMutationArgs, ctx: AuthenticatedMiddlewareCtx) => {
        const existing = await db.eventSegmentUserResponse.findFirst({
            where: {
                userId: args.userId,
                eventSegmentId: args.eventSegmentId,
            }
        });

        if (existing) {
            await mutationCore.updateImpl(db3.xEventSegmentUserResponse, existing.id, {
                attendanceId: args.attendanceId,
                attendanceComment: args.comment,
                instrumentId: args.instrumentId,
            }, ctx);
            return args; // blitz is weird and wants the return type to be the same as the input type.
        }

        const fields: Prisma.EventSegmentUserResponseUncheckedCreateInput = {
            userId: args.userId,
            eventSegmentId: args.eventSegmentId,

            attendanceId: args.attendanceId,
            attendanceComment: args.comment,
            instrumentId: args.instrumentId,
        };

        await mutationCore.insertImpl(db3.xEventSegmentUserResponse, fields, ctx);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

