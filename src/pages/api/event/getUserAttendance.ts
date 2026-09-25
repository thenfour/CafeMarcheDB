// TODO: unify with the normal search api.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { BigintToNumber } from "shared/utils";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { GetUserAttendanceArgs, GetUserAttendanceRet } from "src/core/db3/shared/apiTypes";
import { xEvent, xEventSegment, xEventAttendance, xEventStatus } from "src/core/db3/shared/schema/event";
import { xInstrument } from "src/core/db3/shared/schema/instrument";
import { ComposePrismaWhere, GetAuthorizedTableReadWhere } from "src/core/db3/server/db3ReadPolicy";




async function getUserAttendanceCore(
    { userId, eventId }: GetUserAttendanceArgs,
    eventPolicyWhere: Record<string, unknown>,
): Promise<GetUserAttendanceRet> {
    // validation.

    const user = await db.user.findFirst({
        where: { id: userId, isDeleted: false },
    });
    if (!user) throw new Error("User not found");
    const event = await db.event.findFirst({
        where: ComposePrismaWhere(eventPolicyWhere, { publicId: eventId }),
    });
    if (!event) throw new Error("Event not found");
    const eventResponse = await db.eventUserResponse.findFirst({
        where: {
            userId: userId,
            eventId: event.id,
        },
        select: {
            userComment: true,
            instrument: {
                select: {
                    publicId: true,
                },
            },
        },
    });
    const segmentResponses = await db.eventSegmentUserResponse.findMany({
        include: {
            eventSegment:
            {
                include:
                {
                    status: {
                        select: {
                            publicId: true

                        }
                    }
                }
            },
            attendance: {
                select: {
                    publicId: true

                }
            },
        },
        where: {
            userId: userId,
            eventSegment: {
                eventId: event.id,
            },
        },
        orderBy: {
            eventSegment: {
                startsAt: "asc",
            },
        },
    });

    return {
        eventId,
        userId: userId,
        comment: eventResponse?.userComment || null,
        instrumentId: eventResponse?.instrument
            ? xInstrument.parseIdentity(eventResponse.instrument.publicId)
            : null,
        segmentResponses: segmentResponses.map(sr => ({
            segmentId: xEventSegment.parseIdentity(sr.eventSegment.publicId),
            name: sr.eventSegment.name,
            statusId: sr.eventSegment.status ? xEventStatus.parseIdentity(sr.eventSegment.status.publicId) : null,
            startsAt: sr.eventSegment.startsAt,
            durationMillis: BigintToNumber(sr.eventSegment.durationMillis),
            isAllDay: sr.eventSegment.isAllDay,
            attendanceId: sr.attendance ? xEventAttendance.parseIdentity(sr.attendance.publicId) : null,
        })),
    };
}

function ParseQueryInput(query: any): GetUserAttendanceArgs {
    return {
        userId: parseInt(query.userId),
        eventId: xEvent.parseIdentity(query.eventId),
    };
}

export default api(async (req, res, origCtx: Ctx) => {
    try {
        // technically we should authorize your own attendance, or check sysadmin or something.
        origCtx.session.$authorize(Permission.visibility_members);
        const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
        if (!currentUser) throw new Error(`not authorized`);
        const eventPolicyWhere = await GetAuthorizedTableReadWhere({
            table: xEvent,
            currentUser,
        });

        const inp = ParseQueryInput(req.query);
        const slugs = await getUserAttendanceCore(inp, eventPolicyWhere);
        res.status(200).json(slugs);
    } catch (error) {
        console.error("Failed to fetch slugs", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});





