import { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange, type ChangeContext } from "src/auth/server/activityLog";
import type { CMServerAuthorization, CMServerAuthorizationWithUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import { ZupdateUserEventAttendanceMutationArgs, type TupdateUserEventAttendanceMutationArgs } from "../shared/apiTypes";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";
import { RecalcEventDateRangeAndIncrementRevision } from "./db3mutationCore";
import { requireAttendanceBand, requireAttendanceTarget } from "./eventAttendancePolicy";

export class EventAttendanceAuthorizationError extends AuthorizationError {
    constructor(permission: Permission) {
        super(`Not authorized to update event attendance; required: ${permission}.`);
        this.name = "EventAttendanceAuthorizationError";
    }
}

function authorizeAttendanceChanges(auth: CMServerAuthorization, args: TupdateUserEventAttendanceMutationArgs): void {
    requireAttendanceBand(auth, args.bandPublicId);
    const permissions: Permission[] = [];
    if (args.comment !== undefined || args.instrumentId !== undefined || Object.keys(args.segmentResponses ?? {}).length > 0) {
        permissions.push(auth.userPublicId === args.userId ? Permission.respond_to_events : Permission.change_others_event_responses);
    }
    if (args.isInvited !== undefined) {
        permissions.push(Permission.manage_events);
    }
    for (const permission of permissions) {
        if (!auth.hasPermission(permission)) {
            throw new EventAttendanceAuthorizationError(permission);
        }
    }
}

async function resolveAttendanceChanges(
    database: Prisma.TransactionClient,
    eventId: number,
    bandId: number,
    args: TupdateUserEventAttendanceMutationArgs,
) {
    const requested = Object.entries(args.segmentResponses ?? {}).flatMap(([publicId, response]) => response ? [{ publicId, attendanceId: response.attendanceId }] : []);
    const attendancePublicIds = [...new Set(requested.flatMap(response => response.attendanceId === null ? [] : [response.attendanceId]))];
    const [segments, attendances, instrument] = await Promise.all([
        database.eventSegment.findMany({ where: { eventId, publicId: { in: requested.map(response => response.publicId) } }, select: { id: true, publicId: true } }),
        database.eventAttendance.findMany({ where: { publicId: { in: attendancePublicIds }, isDeleted: false, isActive: true }, select: { id: true, publicId: true } }),
        args.instrumentId == null ? null : database.bandInstrument.findFirst({ where: { publicId: args.instrumentId, bandId, isHidden: false }, select: { id: true } }),
    ]);
    if (segments.length !== requested.length || attendances.length !== attendancePublicIds.length || (args.instrumentId != null && !instrument)) {
        throw new NotFoundError();
    }
    const segmentIds = new Map(segments.map(segment => [segment.publicId, segment.id]));
    const attendanceIds = new Map(attendances.map(attendance => [attendance.publicId, attendance.id]));
    return {
        bandInstrumentId: args.instrumentId == null ? args.instrumentId : instrument!.id,
        segments: requested.map(response => ({ eventSegmentId: segmentIds.get(response.publicId)!, attendanceId: response.attendanceId === null ? null : attendanceIds.get(response.attendanceId)! })),
    };
}

// lsmb todo: this should invoke db3's native mutation routines
// instead of duplicating its flow (auth, sanitization, validation)
async function saveSegmentResponses(
    database: Prisma.TransactionClient,
    auth: CMServerAuthorizationWithUser,
    changeContext: ChangeContext,
    bandUserId: number,
    segments: Awaited<ReturnType<typeof resolveAttendanceChanges>>["segments"],
): Promise<boolean> {
    let changed = false;
    for (const response of segments) {
        const existing = await database.eventSegmentUserResponse.findUnique({
            where: { bandUserId_eventSegmentId: { bandUserId, eventSegmentId: response.eventSegmentId } }
        });
        if (existing?.attendanceId === response.attendanceId) {
            // same response, no need to update
            continue;
        }
        const saved = existing
            ? await database.eventSegmentUserResponse.update({ where: { id: existing.id }, data: { attendanceId: response.attendanceId, updatedByUserId: auth.userId } })
            : await database.eventSegmentUserResponse.create({ data: { ...response, bandUserId, publicId: generatePublicId(), createdByUserId: auth.userId, updatedByUserId: auth.userId } });
        await RegisterChange({ action: existing ? ChangeAction.update : ChangeAction.insert, changeContext, table: "EventSegmentUserResponse", pkid: saved.id, oldValues: existing, newValues: saved, auth, db: database });
        changed = true;
    }
    return changed;
}

// lsmb todo: this should invoke db3's native mutation routines
// instead of duplicating its flow (auth, sanitization, validation)
export async function saveEventAttendanceResponse(
    database: Prisma.TransactionClient,
    auth: CMServerAuthorizationWithUser,
    changeContext: ChangeContext,
    bandUserId: number,
    eventId: number,
    fields: { userComment?: string | null; bandInstrumentId?: number | null; isInvited?: boolean | null },
    segmentsChanged: boolean,
): Promise<void> {
    const existing = await database.eventUserResponse.findUnique({
        where: { bandUserId_eventId: { bandUserId, eventId } }
    });
    if (existing && !segmentsChanged
        && (fields.userComment === undefined || fields.userComment === existing.userComment)
        && (fields.bandInstrumentId === undefined || fields.bandInstrumentId === existing.bandInstrumentId)
        && (fields.isInvited === undefined || fields.isInvited === existing.isInvited)) {
        return;
    }
    const saved = existing
        ? await database.eventUserResponse.update({
            where: { id: existing.id },
            data: { ...fields, revision: { increment: 1 } }
        })
        : await database.eventUserResponse.create({
            data: {
                userComment: "",
                ...fields,
                publicId: generatePublicId(),
                bandUserId,
                eventId
            }
        });
    await RegisterChange({
        action: existing ? ChangeAction.update : ChangeAction.insert,
        changeContext,
        table: "EventUserResponse",
        pkid: saved.id,
        oldValues: existing,
        newValues: saved,
        auth,
        db: database
    });
}

/** Composition boundary: callers must own a Serializable transaction, including any surrounding writes. */
// exported for unit tests
export async function updateEventAttendanceInTransaction(
    database: Prisma.TransactionClient,
    authorization: CMServerAuthorization,
    input: TupdateUserEventAttendanceMutationArgs,
): Promise<TupdateUserEventAttendanceMutationArgs> {
    const args = ZupdateUserEventAttendanceMutationArgs.parse(input);
    const auth = (await authorization.refresh(database)).requireUser();
    authorizeAttendanceChanges(auth, args);
    const { member, event, bandId } = await requireAttendanceTarget(database, auth, args);
    const changes = await resolveAttendanceChanges(database, event.id, bandId, args);
    const changeContext = CreateChangeContext("updateUserEventAttendance");
    const segmentsChanged = await saveSegmentResponses(database, auth, changeContext, member.id, changes.segments);
    await saveEventAttendanceResponse(database, auth, changeContext, member.id, event.id, {
        ...(args.comment !== undefined ? { userComment: args.comment } : {}),
        ...(args.instrumentId !== undefined ? { bandInstrumentId: changes.bandInstrumentId } : {}),
        ...(args.isInvited !== undefined ? { isInvited: args.isInvited } : {}),
    }, segmentsChanged);
    if (segmentsChanged) {
        // Attendance changes share the calendar/date hook with other event changes, once per batch.
        await RecalcEventDateRangeAndIncrementRevision({ eventId: event.id, updatingEventModel: {}, db: database });
    }
    return args;
}

export function updateEventAttendance(database: DB3ReadRootDatabase, authorization: CMServerAuthorization, args: TupdateUserEventAttendanceMutationArgs) {
    return database.$transaction(transaction => updateEventAttendanceInTransaction(transaction, authorization, args), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
