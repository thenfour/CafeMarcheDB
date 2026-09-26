import { describe, expect, it, vi } from "vitest";

vi.mock("db", async () => ({
    ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
    default: {},
}));

import { QuickSearchItemType } from "shared/quickFilter";
import { migrateSetlistPlanSongPayload } from "src/instrumentation.node";
import { songPublicId } from "./support/songFixtures";

describe("stored setlist Song references", () => {
    it("converts rows and associated links once while preserving unrelated references", () => {
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
            rowLeds: [{ associatedItem: { itemType: QuickSearchItemType.event, id: 7 } }],
        };
        const ids = new Map([[1, songPublicId(1)]]);

        expect(migrateSetlistPlanSongPayload(payload, ids)).toBe(true);
        expect(payload.rows.map(row => row.songId)).toEqual([songPublicId(1), existingPublicId, 99]);
        expect(payload.columns[0]?.associatedItem).toMatchObject({
            id: songPublicId(1),
            absoluteUri: `https://example.test/backstage/song/${songPublicId(1)}/old-slug`,
        });
        expect(payload.columnLeds[0]?.associatedItem.id).toBe(songPublicId(1));
        expect(payload.rowLeds[0]?.associatedItem.id).toBe(7);
        expect(migrateSetlistPlanSongPayload(payload, ids)).toBe(false);
    });
});
