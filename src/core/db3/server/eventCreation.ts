import { Prisma } from "@prisma/client";
import { AuthorizationError, NotFoundError, assert } from "blitz";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "src/auth/server/activityLog";
import type { CMServerAuthorization, CMServerAuthorizationWithUser } from "src/auth/server/serverAuthorization";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import * as db3 from "../db3";
import { prepareDB3ReadSelection } from "../shared/core/db3ReadSelection";
import { ZinsertEventArgs, type TinsertEventArgs, type TinsertEventSong } from "../shared/apiTypes";
import type { DB3ReadRootDatabase } from "./db3ReadExecution";
import { authorizeAndProjectDB3ViewModel, resolvePublicId, resolvePublicIds } from "./db3PublicIds";
import { GetAuthorizedTableReadWhere } from "./db3ReadPolicy";
import { resolveDB3ReadGraph } from "./db3ResolvedFields";
import { db3Server } from "./db3Server";
import { insertImpl, RecalcEventDateRangeAndIncrementRevision } from "./db3mutationCore";
import { findAttendanceMember } from "./eventAttendancePolicy";

async function resolveEventFields(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser, args: TinsertEventArgs) {
    const resolveOptional = (table: db3.xTable, publicId: string | null) => publicId === null ? null : resolvePublicId(table, publicId, auth, database);
    const [typeId, statusId, tags, expectedAttendanceUserTagId, visibility] = await Promise.all([
        resolveOptional(db3.xEventType, args.event.typeId),
        resolveOptional(db3.xEventStatus, args.event.statusId),
        resolvePublicIds(db3.xBandEventTag, args.event.tags, auth, database),
        resolveOptional(db3.xBandUserTag, args.event.expectedAttendanceUserTagId),
        // LSMB todo: don't do ad-hoc visibility/soft-delete/permissions checks here. use db3 mechanisms.
        args.event.visiblePermissionId === null ? null : database.permission.findFirst({
            where: {
                publicId: args.event.visiblePermissionId,
                isDeleted: false,
                isVisibility: true,
                id: { in: [...auth.effectivePermissions.ids] }
            },
            select: { id: true },
        }),
    ]);
    if (args.event.visiblePermissionId !== null && !visibility) {
        throw new NotFoundError();
    }
    // The DB3 writer supplies band, public identity and creator from trusted authorization.
    const fields: Omit<Prisma.EventUncheckedCreateInput, "publicId" | "bandId"> & { tags: number[] } = {
        name: args.event.name, locationDescription: args.event.locationDescription ?? "",
        typeId, statusId, tags, expectedAttendanceUserTagId, visiblePermissionId: visibility?.id ?? null, revision: 0,
    };
    return fields;
}

async function resolveInitialSongs(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser, songs: TinsertEventSong[]) {
    const publicIds = [...new Set(songs.map(song => song.songId))];
    if (publicIds.length === 0) {
        return new Map<string, number>();
    }
    // Song's general DB3 workflow is still deferred. This aggregate reader applies its
    // existing visibility policy and explicit band ownership without enabling that workflow.
    const where = await GetAuthorizedTableReadWhere({ table: db3.xSong, auth });
    const targets = await database.song.findMany({
        where: {
            AND: [
                where,
                {
                    bandId: auth.requireBand().id,
                    isDeleted: false,
                    publicId: { in: publicIds }
                }]
        },
        select: { id: true, publicId: true },
    });
    if (targets.length !== publicIds.length) {
        throw new NotFoundError();
    }
    return new Map(targets.map(song => [song.publicId, song.id]));
}

async function createInitialSetlist(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser, eventId: number, songs: TinsertEventSong[]) {
    const targetIds = await resolveInitialSongs(database, auth, songs);
    const changeContext = CreateChangeContext("insertEvent:setlist");
    // Only the newly created, authorized Event owns these children. General setlist
    // editing remains deferred; these typed aggregate writes retain its insert audits.
    const list = await db3Server.table(db3.xEventSongList).createWithPublicId(publicId => database.eventSongList.create({
        data: {
            publicId,
            eventId,
            name: "Setlist", // lsmb todo : use localized strings
            description: "",
            sortOrder: 0,
        }
    }));
    await RegisterChange({
        action: ChangeAction.insert,
        changeContext,
        table: "EventSongList",
        pkid: list.id,
        newValues: list,
        auth,
        db: database
    });
    for (const [sortOrder, song] of songs.entries()) {
        const item = await db3Server.table(db3.xEventSongListSong).createWithPublicId(publicId => database.eventSongListSong.create({
            data: {
                publicId,
                eventSongListId: list.id,
                songId: targetIds.get(song.songId)!,
                sortOrder,
                subtitle: song.comment,
            }
        }));
        await RegisterChange({
            action: ChangeAction.insert,
            changeContext,
            table: "EventSongListSong",
            pkid: item.id,
            newValues: item,
            auth,
            db: database
        });
    }
    await RecalcEventDateRangeAndIncrementRevision({ eventId, updatingEventModel: {}, db: database });
}

async function createInitialResponses(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser, segmentId: number, responses: NonNullable<TinsertEventArgs["responses"]>) {
    if (responses.length === 0) {
        return;
    }
    auth.requirePermission(Permission.change_others_event_responses);
    for (const response of responses) {
        const [member, attendance] = await Promise.all([
            findAttendanceMember(database, auth.requireBand().id, response.userId),
            database.eventAttendance.findFirst({
                where: {
                    publicId: response.attendanceId,
                    isDeleted: false,
                    isActive: true
                },
                select: { id: true }
            }),
        ]);
        if (!member || !attendance) {
            throw new NotFoundError();
        }
        await insertImpl(db3.xEventSegmentUserResponse, {
            eventSegmentId: segmentId,
            bandUserId: member.id,
            attendanceId: attendance.id
        }, auth, database);
    }
}

async function readCreatedEvent(database: Prisma.TransactionClient, auth: CMServerAuthorizationWithUser, eventId: number, segmentId: number, preferences: LocalePreferenceInput) {
    const eventSelection = await db3.xEvent.CalculateSelectionArgs(auth, { items: [] }, false, db3.eventEditorView.getSelectionArgs);
    const segmentSelection = await db3.xEventSegment.CalculateSelectionArgs(auth, { items: [] }, false, db3.eventSegmentEditorView.getSelectionArgs);
    assert(eventSelection && segmentSelection, "Created event views require readable selections.");
    const eventRead = prepareDB3ReadSelection(db3.xEvent, eventSelection);
    const segmentRead = prepareDB3ReadSelection(db3.xEventSegment, segmentSelection);
    const [event, segment] = await Promise.all([
        database.event.findUnique({
            where: { id: eventId },
            ...eventRead.selection
        }),
        database.eventSegment.findUnique({
            where: { id: segmentId },
            ...segmentRead.selection
        }),
    ]);
    assert(event && segment, "Created event rows must remain readable.");
    const [resolvedEvent] = await resolveDB3ReadGraph(db3.xEvent, [event], database, auth, preferences);
    const [resolvedSegment] = await resolveDB3ReadGraph(db3.xEventSegment, [segment], database, auth, preferences);
    assert(resolvedEvent && resolvedSegment, "Created event views must resolve.");
    const authorizedEvent = authorizeAndProjectDB3ViewModel(db3.xEvent, resolvedEvent, auth, "insertEvent:event");
    const authorizedSegment = authorizeAndProjectDB3ViewModel(db3.xEventSegment, resolvedSegment, auth, "insertEvent:segment");
    assert(authorizedEvent && authorizedSegment, "Created event rows must remain authorized.");
    return {
        event: db3.eventEditorView.parseDto(eventRead.stripSupportFields(authorizedEvent)),
        segment: db3.eventSegmentEditorView.parseDto(segmentRead.stripSupportFields(authorizedSegment)),
    };
}

/** Composition boundary: the caller owns a Serializable transaction, including surrounding writes. */
export async function insertEventInTransaction(database: Prisma.TransactionClient, authorization: CMServerAuthorization, input: TinsertEventArgs) {
    const args = ZinsertEventArgs.parse(input);
    const auth = (await authorization.refresh(database)).requireUser();
    if (auth.requireBand().publicId !== args.bandPublicId) {
        throw new AuthorizationError("Event creation requires the selected band.");
    }
    auth.requirePermission(Permission.manage_events);
    const eventFields = await resolveEventFields(database, auth, args);
    const event = await insertImpl<Prisma.EventGetPayload<{}>>(db3.xEvent, eventFields, auth, database);
    const segmentFields: Omit<Prisma.EventSegmentUncheckedCreateInput, "publicId"> = {
        ...args.segment,
        name: args.segment.name || "Set 1",
        durationMillis: BigInt(args.segment.durationMillis),
        eventId: event.id,
    };
    const segment = await insertImpl<Prisma.EventSegmentGetPayload<{}>>(db3.xEventSegment, segmentFields, auth, database);
    if (args.songList) {
        await createInitialSetlist(database, auth, event.id, args.songList);
    }
    if (args.responses) {
        await createInitialResponses(database, auth, segment.id, args.responses);
    }
    return readCreatedEvent(database, auth, event.id, segment.id, args);
}

export function insertEvent(database: DB3ReadRootDatabase, authorization: CMServerAuthorization, args: TinsertEventArgs) {
    return database.$transaction(transaction => insertEventInTransaction(transaction, authorization, args), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000,
    });
}
