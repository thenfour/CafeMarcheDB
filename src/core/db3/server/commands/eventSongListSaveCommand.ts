import type { EventSongListPublicId } from "shared/publicId";
import type { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import {
    xEvent,
    xEventSongListDivider,
    xEventSongList,
    xEventSongListSong,
    saveEventSongListCommand,
    xSong,
    type EventSongListDividerCommand,
    type EventSongListMutationCommand,
    type EventSongListSongCommand,
} from "../../db3";
import {
    DB3CommandError,
    defineCommandHandler,
    type DB3CommandExecutionContext,
} from "../db3CommandCore";

type PersistedSong = Prisma.EventSongListSongGetPayload<{}>;
type PersistedDivider = Prisma.EventSongListDividerGetPayload<{}>;

function requireUniquePersistedIds(
    collectionName: string,
    values: readonly { publicId?: string }[],
): void {
    const ids = values.flatMap(value => value.publicId === undefined ? [] : [value.publicId]);
    if (new Set(ids).size !== ids.length) {
        throw new DB3CommandError(`Duplicate persisted IDs in ${collectionName}.`);
    }
}

function requireOwnedIds(
    collectionName: string,
    currentIds: ReadonlySet<string>,
    values: readonly { publicId?: string }[],
): void {
    for (const value of values) {
        if (value.publicId !== undefined && !currentIds.has(value.publicId)) {
            throw new DB3CommandError(
                `${collectionName} item '${value.publicId}' does not belong to this setlist.`,
            );
        }
    }
}

function fieldsDiffer(
    current: TAnyModel,
    desired: TAnyModel,
): boolean {
    return Object.entries(desired).some(([fieldName, value]) => current[fieldName] !== value);
}

async function synchronizeSongs(
    songListId: number,
    songListPublicId: EventSongListPublicId,
    desired: readonly EventSongListSongCommand[],
    context: DB3CommandExecutionContext,
): Promise<void> {
    requireUniquePersistedIds("setlist songs", desired);

    const current = await context.transaction.eventSongListSong.findMany({
        where: { eventSongListId: songListId },
    });
    // The transaction delegate is dynamic; this query returns complete Prisma rows.
    const rows = current as PersistedSong[];
    const currentById = new Map(rows.map(item => [item.publicId, item]));
    requireOwnedIds("Setlist song", new Set(currentById.keys()), desired);

    const desiredIds = new Set<string>(desired.flatMap(item => item.publicId === undefined ? [] : [item.publicId]));
    for (const existing of rows) {
        if (!desiredIds.has(existing.publicId)) {
            await context.rowServices.delete(xEventSongListSong, xEventSongListSong.parseIdentity(existing.publicId), "hard");
        }
    }

    for (const item of desired) {
        const { publicId, ...values } = item;
        if (publicId === undefined) {
            await context.rowServices.insert(xEventSongListSong, {
                ...values,
                eventSongListId: songListPublicId,
            });
            continue;
        }

        const existing = currentById.get(publicId)!;
        if (fieldsDiffer(existing, values)) {
            await context.rowServices.update(xEventSongListSong, publicId, values);
        }
    }
}

async function synchronizeDividers(
    songListId: number,
    songListPublicId: EventSongListPublicId,
    desired: readonly EventSongListDividerCommand[],
    context: DB3CommandExecutionContext,
): Promise<void> {
    requireUniquePersistedIds("setlist dividers", desired);

    const current = await context.transaction.eventSongListDivider.findMany({
        where: { eventSongListId: songListId },
    });
    // The transaction delegate is dynamic; this query returns complete Prisma rows.
    const rows = current as PersistedDivider[];
    const currentById = new Map(rows.map(item => [item.publicId, item]));
    requireOwnedIds("Setlist divider", new Set(currentById.keys()), desired);

    const desiredIds = new Set<string>(desired.flatMap(item => item.publicId === undefined ? [] : [item.publicId]));
    for (const existing of rows) {
        if (!desiredIds.has(existing.publicId)) {
            await context.rowServices.delete(xEventSongListDivider, xEventSongListDivider.parseIdentity(existing.publicId), "hard");
        }
    }

    for (const item of desired) {
        const { publicId, ...values } = item;
        if (publicId === undefined) {
            await context.rowServices.insert(xEventSongListDivider, {
                ...values,
                eventSongListId: songListPublicId,
            });
            continue;
        }

        const existing = currentById.get(publicId)!;
        if (fieldsDiffer(existing, values)) {
            await context.rowServices.update(xEventSongListDivider, publicId, values);
        }
    }
}

async function saveEventSongList(
    dto: EventSongListMutationCommand,
    context: DB3CommandExecutionContext,
): Promise<{ publicId: EventSongListPublicId }> {
    const { publicId, eventId, songs, dividers, ...parentValues } = dto;
    const event = await context.rowServices.requireVisible(xEvent, eventId);
    for (const songId of new Set(songs.map(item => item.songId))) {
        await context.rowServices.requireVisible(xSong, songId);
    }

    let songList: TAnyModel;
    if (publicId === undefined) {
        songList = await context.rowServices.insert(xEventSongList, { ...parentValues, eventId });
    } else {
        songList = await context.rowServices.requireVisible(xEventSongList, publicId);
        if (songList.eventId !== event.id) {
            throw new DB3CommandError("EventSongList was not found in this event.");
        }
        await context.rowServices.update(xEventSongList, publicId, parentValues);
    }
    const songListId = xEventSongList.parseDatabaseIdentity(songList.id);
    const songListPublicId = xEventSongList.parseIdentity(songList.publicId);
    await synchronizeSongs(songListId, songListPublicId, songs, context);
    await synchronizeDividers(songListId, songListPublicId, dividers, context);
    await context.rowServices.afterMutation(xEventSongList, { id: songListId });
    return { publicId: songListPublicId };
}

export const eventSongListSaveCommandHandler = defineCommandHandler(saveEventSongListCommand, saveEventSongList);
