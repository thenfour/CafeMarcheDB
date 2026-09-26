import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
    findPlans: vi.fn(),
    updatePlan: vi.fn(),
    findEvents: vi.fn(),
    findSongs: vi.fn(),
    findUsers: vi.fn(),
}));

vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: {
        setlistPlan: { findMany: database.findPlans, update: database.updatePlan },
        event: { findMany: database.findEvents },
        song: { findMany: database.findSongs },
        user: { findMany: database.findUsers },
    },
}));

import { QuickSearchItemType } from "shared/quickFilter";
import { MigrateSetlistPlanPublicIdReferences, migrateSetlistPlanReferences } from "src/instrumentation.node";
import { songPublicId } from "./support/songFixtures";
import { userPublicId } from "./support/userFixtures";

describe("stored setlist public ID references", () => {
    it("converts Song rows and both kinds of associated links in one pass", () => {
        const existingPublicId = songPublicId(2);
        const payload = {
            version: 1,
            rows: [
                { type: "song", rowId: "old", songId: 1 },
                { type: "song", rowId: "converted", songId: existingPublicId },
                { type: "song", rowId: "missing", songId: 99 },
            ],
            columns: [{ associatedItem: {
                itemType: QuickSearchItemType.song,
                id: 1,
                absoluteUri: "https://example.test/backstage/song/1/old-slug",
            } }],
            columnLeds: [{ associatedItem: { itemType: QuickSearchItemType.song, id: 1 } }],
            rowLeds: [
                { associatedItem: {
                    itemType: QuickSearchItemType.event,
                    id: 7,
                    absoluteUri: "https://example.test/backstage/event/7/old-slug",
                } },
                { associatedItem: { itemType: QuickSearchItemType.event, id: 99 } },
                { associatedItem: { itemType: QuickSearchItemType.user, id: 3, absoluteUri: "https://example.test/backstage/user/3" } },
            ],
        };
        const publicIds = {
            event: new Map([[7, "event-public-id"]]),
            song: new Map([[1, songPublicId(1)]]),
            user: new Map([[3, userPublicId(3)]]),
        };

        expect(migrateSetlistPlanReferences(payload, publicIds)).toBe(true);
        expect(payload.rows.map(row => row.songId)).toEqual([songPublicId(1), existingPublicId, 99]);
        expect(payload.columns[0]?.associatedItem).toMatchObject({
            id: songPublicId(1),
            absoluteUri: `https://example.test/backstage/song/${songPublicId(1)}/old-slug`,
        });
        expect(payload.columnLeds[0]?.associatedItem.id).toBe(songPublicId(1));
        expect(payload.rowLeds[0]?.associatedItem).toMatchObject({
            id: "event-public-id",
            absoluteUri: "https://example.test/backstage/event/event-public-id/old-slug",
        });
        expect(payload.rowLeds[1]?.associatedItem.id).toBe(99);
        expect(payload.rowLeds[2]?.associatedItem).toMatchObject({
            id: userPublicId(3), absoluteUri: `https://example.test/backstage/user/${userPublicId(3)}`,
        });
        expect(migrateSetlistPlanReferences(payload, publicIds)).toBe(false);
    });

    it("reads each plan once and writes a mixed-reference plan once", async () => {
        database.findPlans.mockResolvedValue([
            {
                id: 11,
                payloadJson: JSON.stringify({
                    rows: [{ songId: 1 }],
                    columns: [{ associatedItem: { itemType: QuickSearchItemType.event, id: 7 } }],
                }),
            },
            { id: 12, payloadJson: "invalid json" },
        ]);
        database.findEvents.mockResolvedValue([{ id: 7, publicId: "event-public-id" }]);
        database.findSongs.mockResolvedValue([{ id: 1, publicId: songPublicId(1) }]);
        const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        try {
            await MigrateSetlistPlanPublicIdReferences();

            expect(database.findPlans).toHaveBeenCalledTimes(1);
            expect(database.findEvents).toHaveBeenCalledTimes(1);
            expect(database.findSongs).toHaveBeenCalledTimes(1);
            expect(database.updatePlan).toHaveBeenCalledTimes(1);
            expect(database.updatePlan).toHaveBeenCalledWith({
                where: { id: 11 },
                data: { payloadJson: JSON.stringify({
                    rows: [{ songId: songPublicId(1) }],
                    columns: [{ associatedItem: {
                        itemType: QuickSearchItemType.event,
                        id: "event-public-id",
                    } }],
                }) },
            });
            expect(warning).toHaveBeenCalledWith(
                "SetlistPlan #12 has invalid JSON; its references were not migrated.",
            );
        } finally {
            warning.mockRestore();
        }
    });
});
