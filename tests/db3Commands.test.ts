import { describe, expect, it, vi } from "vitest";
import * as db3 from "@db3/db3";
import { eventSongListSaveCommandHandler } from "@db3/server/commands/eventSongListSaveCommand";
import type { DB3CommandExecutionContext } from "@db3/server/db3CommandCore";

function createContext(seed?: {
    songList?: Record<string, unknown> | null;
    songs?: Record<string, unknown>[];
    dividers?: Record<string, unknown>[];
}) {
    const insert = vi.fn(async (entity: db3.AnyDB3Entity, values: Record<string, unknown>) => ({
        id: entity.entityID === db3.eventSongListEntity.entityID ? 50 : 900,
        ...values,
    }));
    const update = vi.fn(async (_entity: db3.AnyDB3Entity, id: db3.DB3EntityId, values: Record<string, unknown>) => ({
        id,
        ...values,
    }));
    const deleteRow = vi.fn(async () => undefined);
    const requireVisible = vi.fn(async (entity: db3.AnyDB3Entity, identity: db3.DB3EntityId) => ({
        id: identity,
        entityID: entity.entityID,
    }));
    const afterMutation = vi.fn(async () => undefined);
    const context: DB3CommandExecutionContext = {
        authorization: {} as any,
        transaction: {
            eventSongList: {
                findFirst: vi.fn(async () => seed?.songList ?? null),
            },
            eventSongListSong: {
                findMany: vi.fn(async () => seed?.songs ?? []),
            },
            eventSongListDivider: {
                findMany: vi.fn(async () => seed?.dividers ?? []),
            },
        } as any,
        rows: {
            insert,
            update,
            delete: deleteRow,
            requireVisible,
            afterMutation,
        },
    };
    return { context, insert, update, deleteRow, requireVisible, afterMutation };
}

const parentFields = {
    eventId: 5,
    name: "Concert set",
    description: "Main set",
    isActuallyPlayed: false,
    isOrdered: true,
    sortOrder: 3,
};

describe("DB3 commands", () => {
    it("validates strict command DTOs and results at the shared boundary", () => {
        expect(db3.saveEventSongListCommand.commandID).toBe("EventSongList_Save");
        expect(() => db3.saveEventSongListCommand.parseDto({
            ...parentFields,
            songs: [],
            dividers: [],
            unexpected: true,
        })).toThrow();
        expect(db3.saveEventSongListCommand.parseResult({ id: 50 })).toEqual({ id: 50 });
        expect(() => db3.saveEventSongListCommand.parseResult({ id: -1 })).toThrow();
    });

    it("creates a setlist aggregate through authorized row operations", async () => {
        const { context, insert, requireVisible, afterMutation } = createContext();

        const result = await eventSongListSaveCommandHandler.execute({
            ...parentFields,
            songs: [{ songId: 7, sortOrder: 0, subtitle: "Open quietly" }],
            dividers: [{
                sortOrder: 1,
                color: null,
                isInterruption: true,
                subtitleIfSong: null,
                isSong: false,
                lengthSeconds: null,
                textStyle: null,
                subtitle: "Break",
            }],
        }, context);

        expect(result).toEqual({ id: 50 });
        expect(requireVisible).toHaveBeenNthCalledWith(1, db3.eventEntity, 5);
        expect(requireVisible).toHaveBeenNthCalledWith(2, db3.songEntity, 7);
        expect(insert).toHaveBeenNthCalledWith(1, db3.eventSongListEntity, parentFields);
        expect(insert).toHaveBeenNthCalledWith(2, db3.eventSongListSongEntity, {
            eventSongListId: 50,
            songId: 7,
            sortOrder: 0,
            subtitle: "Open quietly",
        });
        expect(insert).toHaveBeenNthCalledWith(3, db3.eventSongListDividerEntity, {
            eventSongListId: 50,
            sortOrder: 1,
            color: null,
            isInterruption: true,
            subtitleIfSong: null,
            isSong: false,
            lengthSeconds: null,
            textStyle: null,
            subtitle: "Break",
        });
        expect(afterMutation).toHaveBeenCalledWith(db3.eventSongListEntity, { id: 50 });
    });

    it("synchronizes persisted children and rejects IDs owned by another setlist", async () => {
        const existingSong = {
            id: 501,
            eventSongListId: 50,
            songId: 7,
            sortOrder: 0,
            subtitle: "Old",
        };
        const removedSong = {
            id: 502,
            eventSongListId: 50,
            songId: 8,
            sortOrder: 1,
            subtitle: "Remove",
        };
        const { context, update, deleteRow } = createContext({
            songList: { id: 50, eventId: 5 },
            songs: [existingSong, removedSong],
        });

        await eventSongListSaveCommandHandler.execute({
            id: 50,
            ...parentFields,
            songs: [{ id: 501, songId: 7, sortOrder: 0, subtitle: "Changed" }],
            dividers: [],
        }, context);

        expect(update).toHaveBeenCalledWith(db3.eventSongListEntity, 50, {
            name: parentFields.name,
            description: parentFields.description,
            isActuallyPlayed: parentFields.isActuallyPlayed,
            isOrdered: parentFields.isOrdered,
            sortOrder: parentFields.sortOrder,
        });
        expect(update).toHaveBeenCalledWith(db3.eventSongListSongEntity, 501, {
            songId: 7,
            sortOrder: 0,
            subtitle: "Changed",
        });
        expect(deleteRow).toHaveBeenCalledWith(db3.eventSongListSongEntity, 502, "hard");

        await expect(eventSongListSaveCommandHandler.execute({
            id: 50,
            ...parentFields,
            songs: [{ id: 999, songId: 7, sortOrder: 0, subtitle: "Forged" }],
            dividers: [],
        }, context)).rejects.toThrow("does not belong to this setlist");
    });
});
