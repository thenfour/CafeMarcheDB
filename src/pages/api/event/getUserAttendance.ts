// TODO: unify with the normal search api.

import { Ctx } from "@blitzjs/next";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { BigintToNumber } from "shared/utils";
import { api } from "src/blitz-server";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { GetUserAttendanceArgs, GetUserAttendanceRet } from "src/core/db3/shared/apiTypes";




async function getUserAttendanceCore({ userId, eventId }: GetUserAttendanceArgs): Promise<GetUserAttendanceRet> {
    // validation.

    const user = await db.user.findUnique({
        where: { id: userId },
    });
    if (!user) throw new Error("User not found");
    const event = await db.event.findUnique({
        where: { id: eventId },
    });
    if (!event) throw new Error("Event not found");
    const eventResponse = await db.eventUserResponse.findFirst({
        where: {
            userId: userId,
            eventId: eventId,
        },
    });
    const segmentResponses = await db.eventSegmentUserResponse.findMany({
        include: {
            eventSegment: true,
        },
        where: {
            userId: userId,
            eventSegment: {
                eventId: eventId,
            },
        },
        orderBy: {
            eventSegment: {
                startsAt: "asc",
            },
        },
    });

    return {
        eventId: eventId,
        userId: userId,
        comment: eventResponse?.userComment || null,
        instrumentId: eventResponse?.instrumentId || null,
        segmentResponses: segmentResponses.map(sr => ({
            segmentId: sr.eventSegmentId,
            name: sr.eventSegment.name,
            statusId: sr.eventSegment.statusId,
            startsAt: sr.eventSegment.startsAt,
            durationMillis: BigintToNumber(sr.eventSegment.durationMillis),
            isAllDay: sr.eventSegment.isAllDay,
            eventSegmentId: sr.eventSegmentId,
            attendanceId: sr.attendanceId,
        })),
    };
}

function ParseQueryInput(query: any): GetUserAttendanceArgs {
    return {
        userId: parseInt(query.userId),
        eventId: parseInt(query.eventId),
    };
}

export default api(async (req, res, origCtx: Ctx) => {
    return new Promise(async (resolve, reject) => {
        try {
            // technically we should authorize your own attendance, or check sysadmin or something.
            origCtx.session.$authorize(Permission.visibility_members);
            const ctx: AuthenticatedCtx = origCtx as any; // authorize ensures this.
            const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;
            if (!currentUser) throw new Error(`not authorized`);

            const inp = ParseQueryInput(req.query);
            const slugs = await getUserAttendanceCore(inp);
            res.status(200).json(slugs);
        } catch (error) {
            console.error("Failed to fetch slugs", error);
            res.status(500).json({ error: "Failed to fetch data" });
        }
    }); // return new promise
});





