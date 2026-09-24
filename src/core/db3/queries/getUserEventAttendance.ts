import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import {
    parsePublicId,
    type EventStatusPublicId,
    type EventTypePublicId,
    type InstrumentPublicId,
} from "shared/publicId";
import { ZGetUserEventAttendanceArgrs } from "src/auth/schemas";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { ComposePrismaWhere, GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { xEvent } from "../shared/schema/event";

type UserEventAttendanceQueryResult_EventSegment = Omit<Prisma.EventSegmentGetPayload<{
    select: {
        id: true,
        name: true,
        statusId: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
    }
}>, "statusId"> & {
    statusId: EventStatusPublicId | null;
    attendanceId: number | null;
};

type UserEventAttendanceQueryResult_Event = Omit<Prisma.EventGetPayload<{
    select: {
        id: true,
        name: true,
        statusId: true,
        typeId: true,
        startsAt: true,
        durationMillis: true,
        isAllDay: true,
        expectedAttendanceUserTagId: true,
    }
}>, "statusId" | "typeId"> & {
    statusId: EventStatusPublicId | null;
    typeId: EventTypePublicId | null;
    instrumentId: InstrumentPublicId | null;
    userComment: string | null;
    isInvited: boolean | null;
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
            const currentUser = await getCurrentUserCore(ctx);
            if (!currentUser) throw new Error("Current user was not found.");
            const eventPolicyWhere = await GetAuthorizedTableReadWhere({
                table: xEvent,
                currentUser,
            });

            // Find the earliest event that this user responded to:
            const earliestUserEvent = await db.event.findFirst({
                where: ComposePrismaWhere(eventPolicyWhere, {
                    responses: {
                        some: { userId: args.userId },
                    },
                    NOT: { startsAt: null },
                }),
                orderBy: { startsAt: "asc" },
                select: { startsAt: true },
                take: 1,
            });

            // Find the earliest event that this user responded to:
            const earliestUserEventSegment = await db.eventSegment.findFirst({
                where: {
                    event: eventPolicyWhere,
                    responses: {
                        some: { userId: args.userId }
                    },
                    NOT: {
                        startsAt: null
                    }
                },
                orderBy: { startsAt: "asc" },
                select: { startsAt: true },
                take: 1,
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
                    type: { select: { publicId: true } },
                    status: { select: { publicId: true } },
                    segments: {
                        include: {
                            status: { select: { publicId: true } },
                            responses: {
                                where: { userId: args.userId }
                            },
                        },
                    },
                    responses: {
                        where: { userId: args.userId },
                        include: { instrument: { select: { publicId: true } } },
                    },
                },
                where: ComposePrismaWhere(eventPolicyWhere, {
                    startsAt: { gte: earliestDateFilter },
                }),
                take: args.take || 100,
                orderBy: [
                    { startsAt: "desc" }, // take the most recent / latest events first so the list is not stagnant
                    { id: "desc" },
                ],
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
                        statusId: event.status ? parsePublicId<"EventStatus">(event.status.publicId) : null,
                        typeId: event.type ? parsePublicId<"EventType">(event.type.publicId) : null,
                        startsAt: event.startsAt,
                        durationMillis: event.durationMillis,
                        isAllDay: event.isAllDay,
                        expectedAttendanceUserTagId: event.expectedAttendanceUserTagId,
                        //
                        instrumentId: er?.instrument
                            ? parsePublicId<"Instrument">(er.instrument.publicId)
                            : null,
                        userComment: er?.userComment || null,
                        isInvited: er?.isInvited || null,
                        //
                        segments: event.segments.map(seg => {
                            assert(seg.responses.length < 2, "designed for 1 user at a time");
                            const segRet: UserEventAttendanceQueryResult_EventSegment = {
                                id: seg.id,
                                name: seg.name,
                                statusId: seg.status ? parsePublicId<"EventStatus">(seg.status.publicId) : null,
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



