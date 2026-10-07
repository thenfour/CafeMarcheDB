// this is a bit ad-hoc querying; should be cleaned up.

import type { Prisma } from "@prisma/client";
import { parsePublicId } from "shared/publicId";
import { BigintToNumber } from "shared/utils";
import { GetBandUserEventAttendanceSchema } from "src/auth/schemas";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { z } from "zod";
import { ZGetUserAttendanceArgs, type GetUserAttendanceArgs, type GetUserAttendanceRet } from "../shared/apiTypes";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { findAttendanceMember, requireAttendanceRead, requireAttendanceTarget, visibleAttendanceEvents } from "./eventAttendancePolicy";

export function readUserEventAttendance(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: GetUserAttendanceArgs,
): Promise<GetUserAttendanceRet> {
    const args = ZGetUserAttendanceArgs.parse(input);
    return executeDB3Read(database, authorization, async ({ database: tx, authorization: auth }) => {
        requireAttendanceRead(auth, args.bandPublicId);
        const { member, event } = await requireAttendanceTarget(tx, auth, args);
        const [response, segments] = await Promise.all([
            tx.eventUserResponse.findUnique({ where: { bandUserId_eventId: { bandUserId: member.id, eventId: event.id } }, select: { userComment: true, bandInstrument: { select: { publicId: true } } } }),
            tx.eventSegmentUserResponse.findMany({
                where: { bandUserId: member.id, eventSegment: { eventId: event.id } },
                select: {
                    attendance: { select: { publicId: true } },
                    eventSegment: { select: { publicId: true, name: true, startsAt: true, durationMillis: true, isAllDay: true, status: { select: { publicId: true } } } },
                },
                orderBy: [{ eventSegment: { startsAt: "asc" } }, { eventSegmentId: "asc" }],
            }),
        ]);
        return {
            userId: args.userId, eventId: args.eventId, comment: response?.userComment ?? null,
            instrumentId: response?.bandInstrument ? parsePublicId<"Instrument">(response.bandInstrument.publicId) : null,
            segmentResponses: segments.map(({ eventSegment: segment, attendance }) => ({
                segmentId: parsePublicId<"EventSegment">(segment.publicId), name: segment.name,
                statusId: segment.status ? parsePublicId<"EventStatus">(segment.status.publicId) : null,
                attendanceId: attendance ? parsePublicId<"EventAttendance">(attendance.publicId) : null,
                startsAt: segment.startsAt, durationMillis: BigintToNumber(segment.durationMillis), isAllDay: segment.isAllDay,
            })),
        };
    });
}

function loadAttendanceHistoryEvents(database: Prisma.TransactionClient, visible: Prisma.EventWhereInput, bandUserId: number, earliest: Date, take: number) {
    return database.event.findMany({
        where: { AND: [visible, { startsAt: { gte: earliest } }] }, take,
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        select: {
            publicId: true, name: true, startsAt: true, durationMillis: true, isAllDay: true,
            type: { select: { publicId: true } }, status: { select: { publicId: true } }, expectedAttendanceUserTag: { select: { publicId: true } },
            responses: { where: { bandUserId }, select: { userComment: true, isInvited: true, bandInstrument: { select: { publicId: true } } } },
            segments: {
                orderBy: [{ startsAt: "asc" }, { id: "asc" }], select: {
                    publicId: true, name: true, startsAt: true, durationMillis: true, isAllDay: true,
                    status: { select: { publicId: true } }, responses: { where: { bandUserId }, select: { attendance: { select: { publicId: true } } } },
                }
            },
        },
    });
}

async function loadFirstAttendanceDate(database: Prisma.TransactionClient, visible: Prisma.EventWhereInput, bandUserId: number): Promise<Date> {
    const [firstEvent, firstSegment] = await Promise.all([
        database.event.findFirst({ where: { AND: [visible, { responses: { some: { bandUserId } }, startsAt: { not: null } }] }, orderBy: { startsAt: "asc" }, select: { startsAt: true } }),
        database.eventSegment.findFirst({ where: { event: visible, responses: { some: { bandUserId } }, startsAt: { not: null } }, orderBy: { startsAt: "asc" }, select: { startsAt: true } }),
    ]);
    // Include visible history from the first answer onward, and future events for members with no answers.
    return new Date(Math.min(Date.now(), firstEvent?.startsAt?.valueOf() ?? Infinity, firstSegment?.startsAt?.valueOf() ?? Infinity));
}

// lsmb todo: ideally this should invoke db3's native query mechanisms
// instead of duplicating its flow (auth, sanitization, validation)
function projectAttendanceHistoryEvent(event: Awaited<ReturnType<typeof loadAttendanceHistoryEvents>>[number]) {
    const response = event.responses[0];
    return {
        publicId: parsePublicId<"Event">(event.publicId), name: event.name,
        statusId: event.status ? parsePublicId<"EventStatus">(event.status.publicId) : null,
        typeId: event.type ? parsePublicId<"EventType">(event.type.publicId) : null,
        expectedAttendanceUserTagId: event.expectedAttendanceUserTag ? parsePublicId<"UserTag">(event.expectedAttendanceUserTag.publicId) : null,
        startsAt: event.startsAt, durationMillis: event.durationMillis, isAllDay: event.isAllDay,
        instrumentId: response?.bandInstrument ? parsePublicId<"Instrument">(response.bandInstrument.publicId) : null,
        userComment: response?.userComment ?? null, isInvited: response?.isInvited ?? null,
        segments: event.segments.map(segment => ({
            publicId: parsePublicId<"EventSegment">(segment.publicId), name: segment.name,
            statusId: segment.status ? parsePublicId<"EventStatus">(segment.status.publicId) : null,
            startsAt: segment.startsAt, durationMillis: segment.durationMillis, isAllDay: segment.isAllDay,
            attendanceId: segment.responses[0]?.attendance ? parsePublicId<"EventAttendance">(segment.responses[0].attendance.publicId) : null,
        })),
    };
}


// this is the effective entrypoint of getUserEventAttendance
// lsmb todo: ideally this should invoke db3's native query mechanisms
// instead of duplicating its flow (auth, sanitization, validation)
export function readUserAttendanceHistory(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: z.infer<typeof GetBandUserEventAttendanceSchema>,
) {
    const args = GetBandUserEventAttendanceSchema.parse(input);
    return executeDB3Read(database, authorization, async ({ database: tx, authorization: auth }) => {
        const bandId = requireAttendanceRead(auth, args.bandPublicId);
        const member = await findAttendanceMember(tx, bandId, args.userId);
        if (!member) {
            return { events: [] };
        }
        const visible = visibleAttendanceEvents(auth);
        const earliest = await loadFirstAttendanceDate(tx, visible, member.id);
        const events = await loadAttendanceHistoryEvents(tx, visible, member.id, earliest, args.take);
        return { events: events.map(projectAttendanceHistoryEvent) };
    });
}
