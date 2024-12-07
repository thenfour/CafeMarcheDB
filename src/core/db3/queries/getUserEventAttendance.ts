import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetFilteredSongsItemSongSelect, GetFilteredSongsRet } from "../shared/apiTypes";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
import { toSorted } from "shared/utils";

type UserEventAttendanceQueryResult_EventSegment = Prisma.EventSegmentGetPayload<{
    select: {
        id: true,
        name: true,
        statusId: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
    }
}> & {
    attendanceId: number | null;
};

type UserEventAttendanceQueryResult_Event = Prisma.EventGetPayload<{
    select: {
        id: true,
        name: true,
        statusId: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
        expectedAttendanceUserTagId: true,
    }
}> & Prisma.EventUserResponseGetPayload<{
    select: {
        instrumentId: true,
        userComment: true,
        isInvited: true,
    }
}> & {
    segments: UserEventAttendanceQueryResult_EventSegment[];
};

type UserEventAttendanceQueryResult = {
    events: UserEventAttendanceQueryResult_Event[];
};

export default resolver.pipe(
    resolver.authorize(Permission.view_events_nonpublic),
    resolver.zod(ZGetUserEventAttendanceArgrs),
    async (args, ctx: AuthenticatedCtx): Promise<UserEventAttendanceQueryResult> => {
        try {

            // Find the earliest event that this user responded to:
            const earliestUserEvent = await db.event.findFirst({
                where: {
                    isDeleted: false,
                    // TODO: visibility permission.
                    responses: {
                        some: { userId: args.userId }
                    },
                    NOT: {
                        startsAt: null
                    }
                },
                orderBy: { startsAt: "asc" },
                select: { startsAt: true },
            });

            // Find the earliest event that this user responded to:
            const earliestUserEventSegment = await db.eventSegment.findFirst({
                where: {
                    responses: {
                        some: { userId: args.userId }
                    },
                    NOT: {
                        startsAt: null
                    }
                },
                orderBy: { startsAt: "asc" },
                select: { startsAt: true },
            });

            // If the user has responded to events, we start from the earliest one.
            // If that earliest event is in the past, we also include events in the future by using today's date if it's later.
            const now = new Date();
            const candidates = toSorted([
                earliestUserEvent?.startsAt,
                earliestUserEventSegment?.startsAt,
                now,
            ].filter(x => !!x), (a, b) => a.valueOf() - b.valueOf());
            const earliestDateFilter = candidates[0]!;

            const q = await db.event.findMany({
                include: {
                    segments: {
                        include: {
                            responses: {
                                where: { userId: args.userId }
                            },
                        },
                    },
                    responses: {
                        where: { userId: args.userId }
                    },
                },
                where: {
                    AND: [
                        { isDeleted: false },
                        // TODO: visibility permission.
                        { startsAt: { gte: earliestDateFilter } }
                    ]
                }
            });

            // only include events between the requested user's first response
            // also include events which are in the future.

            const ret: UserEventAttendanceQueryResult = {
                events: q.map(event => {
                    assert(event.responses.length < 2, "designed for 1 user at a time");
                    const er = event.responses[0];
                    const eventRet: UserEventAttendanceQueryResult_Event = {
                        id: event.id,
                        name: event.name,
                        statusId: event.statusId,
                        startsAt: event.startsAt,
                        durationMillis: event.durationMillis,
                        isAllDay: event.isAllDay,
                        expectedAttendanceUserTagId: event.expectedAttendanceUserTagId,
                        //
                        instrumentId: er?.instrumentId || null,
                        userComment: er?.userComment || null,
                        isInvited: er?.isInvited || null,
                        //
                        segments: event.segments.map(seg => {
                            assert(seg.responses.length < 2, "designed for 1 user at a time");
                            const segRet: UserEventAttendanceQueryResult_EventSegment = {
                                id: seg.id,
                                name: seg.name,
                                statusId: seg.statusId,
                                startsAt: seg.startsAt,
                                durationMillis: seg.durationMillis,
                                isAllDay: seg.isAllDay,
                                attendanceId: seg.responses[0]?.attendanceId || null,
                            };
                            return segRet;
                        }),
                    }
                    return eventRet;
                })
            };



            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



