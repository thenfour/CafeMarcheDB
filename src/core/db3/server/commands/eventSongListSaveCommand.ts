import type { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import {
    eventEntity,
    eventSongListDividerEntity,
    eventSongListEntity,
    eventSongListSongEntity,
    saveEventSongListCommand,
    songEntity,
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
    values: readonly { id?: number }[],
): void {
    const ids = values.flatMap(value => value.id === undefined ? [] : [value.id]);
    if (new Set(ids).size !== ids.length) {
        throw new DB3CommandError(`Duplicate persisted IDs in ${collectionName}.`);
    }
}

function requireOwnedIds(
    collectionName: string,
    currentIds: ReadonlySet<number>,
    values: readonly { id?: number }[],
): void {
    for (const value of values) {
        if (value.id !== undefined && !currentIds.has(value.id)) {
            throw new DB3CommandError(
                `${collectionName} item '${value.id}' does not belong to this setlist.`,
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
    desired: readonly EventSongListSongCommand[],
    context: DB3CommandExecutionContext,
): Promise<void> {
    requireUniquePersistedIds("setlist songs", desired);

    const current = await context.transaction.eventSongListSong.findMany({
        where: { eventSongListId: songListId },
    }) as PersistedSong[];
    const currentById = new Map(current.map(item => [item.id, item]));
    requireOwnedIds("Setlist song", new Set(currentById.keys()), desired);

    const desiredIds = new Set(desired.flatMap(item => item.id === undefined ? [] : [item.id]));
    for (const existing of current) {
        if (!desiredIds.has(existing.id)) {
            await context.rowServices.delete(eventSongListSongEntity, existing.id, "hard");
        }
    }

    for (const item of desired) {
        const { id, ...values } = item;
        if (id === undefined) {
            await context.rowServices.insert(eventSongListSongEntity, {
                ...values,
                eventSongListId: songListId,
            });
            continue;
        }

        const existing = currentById.get(id)!;
        if (fieldsDiffer(existing, values)) {
            await context.rowServices.update(eventSongListSongEntity, id, values);
        }
    }
}

async function synchronizeDividers(
    songListId: number,
    desired: readonly EventSongListDividerCommand[],
    context: DB3CommandExecutionContext,
): Promise<void> {
    requireUniquePersistedIds("setlist dividers", desired);

    const current = await context.transaction.eventSongListDivider.findMany({
        where: { eventSongListId: songListId },
    }) as PersistedDivider[];
    const currentById = new Map(current.map(item => [item.id, item]));
    requireOwnedIds("Setlist divider", new Set(currentById.keys()), desired);

    const desiredIds = new Set(desired.flatMap(item => item.id === undefined ? [] : [item.id]));
    for (const existing of current) {
        if (!desiredIds.has(existing.id)) {
            await context.rowServices.delete(eventSongListDividerEntity, existing.id, "hard");
        }
    }

    for (const item of desired) {
        const { id, ...values } = item;
        if (id === undefined) {
            await context.rowServices.insert(eventSongListDividerEntity, {
                ...values,
                eventSongListId: songListId,
            });
            continue;
        }

        const existing = currentById.get(id)!;
        if (fieldsDiffer(existing, values)) {
            await context.rowServices.update(eventSongListDividerEntity, id, values);
        }
    }
}

async function saveEventSongList(
    dto: EventSongListMutationCommand,
    context: DB3CommandExecutionContext,
): Promise<{ id: number }> {
    const { id, eventId, songs, dividers, ...parentValues } = dto;

    await context.rowServices.requireVisible(eventEntity, eventId);
    for (const songId of new Set(songs.map(item => item.songId))) {
        await context.rowServices.requireVisible(songEntity, songId);
    }

    let songListId: number;
    if (id === undefined) {
        const inserted = await context.rowServices.insert(eventSongListEntity, {
            ...parentValues,
            eventId,
        });
        songListId = inserted.id as number;
    } else {
        const existing = await context.transaction.eventSongList.findFirst({
            where: { id },
        });
        if (!existing) {
            throw new DB3CommandError(`EventSongList '${id}' was not found.`);
        }
        if (existing.eventId !== eventId) {
            throw new DB3CommandError(
                `EventSongList '${id}' does not belong to event '${eventId}'.`,
            );
        }
        await context.rowServices.update(eventSongListEntity, id, parentValues);
        songListId = id;
    }

    await synchronizeSongs(songListId, songs, context);
    await synchronizeDividers(songListId, dividers, context);
    await context.rowServices.afterMutation(eventSongListEntity, { id: songListId });
    return { id: songListId };
}

// this needs also to be added to the command handler registry; see:
// const commandHandlers = new Map<string, AnyDB3CommandHandler>([
export const eventSongListSaveCommandHandler = defineCommandHandler(
    saveEventSongListCommand,
    saveEventSongList,
);
