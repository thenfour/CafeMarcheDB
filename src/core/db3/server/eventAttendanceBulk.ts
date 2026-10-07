import type { Prisma } from "@prisma/client";
import { NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization, CMServerAuthorizationWithUser } from "src/auth/server/serverAuthorization";
import { generatePublicId } from "src/server/publicId";
import {
    ClearEventSegmentResponsesSchema, CopyEventSegmentResponsesSchema,
    type ClearEventSegmentResponsesArgs, type CopyEventSegmentResponsesArgs,
} from "../shared/eventAttendanceBulk";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";
import { RecalcEventDateRangeAndIncrementRevision } from "./db3mutationCore";
import { requireAttendanceBand, visibleAttendanceEvents } from "./eventAttendancePolicy";
import { saveEventAttendanceResponse } from "./eventAttendanceWrite";

type BulkAttendanceOperation =
    | { kind: "copy"; args: CopyEventSegmentResponsesArgs }
    | { kind: "clear"; args: ClearEventSegmentResponsesArgs };

interface SegmentAnswer {
    bandUserId: number;
    attendanceId: number | null;
}

async function resolveSegments(database: Prisma.TransactionClient, auth: CMServerAuthorization, operation: BulkAttendanceOperation) {
    const publicIds = operation.kind === "copy"
        ? [operation.args.fromEventSegmentId, operation.args.toEventSegmentId]
        : [operation.args.eventSegmentId];
    const segments = await database.eventSegment.findMany({
        where: { publicId: { in: publicIds }, event: visibleAttendanceEvents(auth) },
        select: { id: true, publicId: true, eventId: true },
    });
    if (segments.length !== publicIds.length) {
        throw new NotFoundError();
    }
    const targetPublicId = operation.kind === "copy" ? operation.args.toEventSegmentId : operation.args.eventSegmentId;
    const target = segments.find(segment => segment.publicId === targetPublicId)!;
    const source = operation.kind === "copy" ? segments.find(segment => segment.publicId === operation.args.fromEventSegmentId)! : null;
    if (source && source.eventId !== target.eventId) {
        throw new Error("Segments must belong to the same event.");
    }
    return { source, target };
}

async function loadSegmentAnswers(database: Prisma.TransactionClient, segmentId: number, bandId: number) {
    const rows = await database.eventSegmentUserResponse.findMany({
        where: { eventSegmentId: segmentId },
        select: { id: true, bandUserId: true, attendanceId: true, bandUser: { select: { bandId: true } } },
        orderBy: { bandUserId: "asc" },
    });
    if (rows.some(row => row.bandUser.bandId !== bandId)) {
        throw new NotFoundError();
    }
    // Bulk maintenance copies recorded history, including null/retired answers and former members.
    // Direct member responses still require active memberships and active catalog choices.
    return rows;
}

type PersistedSegmentAnswer = Awaited<ReturnType<typeof loadSegmentAnswers>>[number];

function planSegmentAnswerReplacement(existing: PersistedSegmentAnswer[], desired: SegmentAnswer[]) {
    const existingByMember = new Map(existing.map(row => [row.bandUserId, row]));
    const desiredByMember = new Map(desired.map(row => [row.bandUserId, row]));
    const removed = existing.filter(row => !desiredByMember.has(row.bandUserId));
    const changed = desired.filter(row => {
        const previous = existingByMember.get(row.bandUserId);
        return !previous || previous.attendanceId !== row.attendanceId;
    });
    return { removed, changed, existingByMember };
}

async function replaceSegmentAnswers(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser,
    eventSegmentId: number, plan: ReturnType<typeof planSegmentAnswerReplacement>,
): Promise<number[]> {
    await database.eventSegmentUserResponse.deleteMany({ where: { id: { in: plan.removed.map(row => row.id) } } });
    for (const answer of plan.changed) {
        const existing = plan.existingByMember.get(answer.bandUserId);
        if (existing) {
            await database.eventSegmentUserResponse.update({ where: { id: existing.id }, data: { attendanceId: answer.attendanceId, updatedByUserId: auth.userId } });
        } else {
            await database.eventSegmentUserResponse.create({ data: {
                publicId: generatePublicId(), eventSegmentId, bandUserId: answer.bandUserId, attendanceId: answer.attendanceId,
                createdByUserId: auth.userId, updatedByUserId: auth.userId,
            } });
        }
    }
    return [...new Set([...plan.removed, ...plan.changed].map(row => row.bandUserId))];
}

function auditAnswers(rows: SegmentAnswer[]): SegmentAnswer[] {
    // Audit rows retain natural membership/catalog keys, including explicit unanswered records.
    return rows.map(({ bandUserId, attendanceId }) => ({ bandUserId, attendanceId }));
}

async function executeBulkAttendanceInTransaction(database: Prisma.TransactionClient, authorization: CMServerAuthorization,
    operation: BulkAttendanceOperation,
): Promise<null> {
    const auth = (await authorization.refresh(database)).requireUser();
    const bandId = requireAttendanceBand(auth, operation.args.bandPublicId);
    auth.requirePermission(Permission.admin_events);
    const { source, target } = await resolveSegments(database, auth, operation);
    const [existing, desired] = await Promise.all([
        loadSegmentAnswers(database, target.id, bandId),
        source ? loadSegmentAnswers(database, source.id, bandId) : Promise.resolve<SegmentAnswer[]>([]),
    ]);
    const plan = planSegmentAnswerReplacement(existing, desired);
    if (plan.removed.length === 0 && plan.changed.length === 0) {
        return null;
    }
    const changeContext = CreateChangeContext(operation.kind === "copy" ? "copyEventSegmentResponses" : "clearEventSegmentResponses");
    const changedMembers = await replaceSegmentAnswers(database, auth, target.id, plan);
    await RegisterChange({
        action: operation.kind === "copy" ? ChangeAction.update : ChangeAction.delete,
        changeContext, table: "EventSegmentUserResponse", pkid: target.id,
        oldValues: auditAnswers(existing), newValues: operation.kind === "copy" ? auditAnswers(desired) : undefined,
        // Collection replacement must audit additions/removals as well as values at existing array positions.
        options: { dontCalculateChanges: operation.kind === "copy" },
        auth, db: database,
    });
    for (const bandUserId of changedMembers) {
        await saveEventAttendanceResponse(database, auth, changeContext, bandUserId, target.eventId, {}, true);
    }
    await RecalcEventDateRangeAndIncrementRevision({ eventId: target.eventId, updatingEventModel: {}, db: database });
    return null;
}

/** Composition boundaries: callers must own a Serializable transaction. */
export function copyEventSegmentResponsesInTransaction(database: Prisma.TransactionClient, auth: CMServerAuthorization, args: CopyEventSegmentResponsesArgs) {
    return executeBulkAttendanceInTransaction(database, auth, { kind: "copy", args: CopyEventSegmentResponsesSchema.parse(args) });
}

export function clearEventSegmentResponsesInTransaction(database: Prisma.TransactionClient, auth: CMServerAuthorization, args: ClearEventSegmentResponsesArgs) {
    return executeBulkAttendanceInTransaction(database, auth, { kind: "clear", args: ClearEventSegmentResponsesSchema.parse(args) });
}

export function copyEventSegmentResponses(database: DB3ReadRootDatabase, auth: CMServerAuthorization, args: CopyEventSegmentResponsesArgs) {
    return database.$transaction(transaction => copyEventSegmentResponsesInTransaction(transaction, auth, args), { isolationLevel: "Serializable" });
}

export function clearEventSegmentResponses(database: DB3ReadRootDatabase, auth: CMServerAuthorization, args: ClearEventSegmentResponsesArgs) {
    return database.$transaction(transaction => clearEventSegmentResponsesInTransaction(transaction, auth, args), { isolationLevel: "Serializable" });
}
