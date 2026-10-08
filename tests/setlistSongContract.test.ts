import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { GetFilteredSongsArgsSchema } from "src/core/db3/shared/apiTypes";
import { xSong, xSongTagAssociation, hydrateEventSongListDetailDto, eventSongListDetailView } from "src/core/db3/db3";

const songId = parsePublicId<"Song">("Song000000000001");
const bandSongTagId = parsePublicId<"SongTag">("SongTag000000001");
const associationId = parsePublicId<"SongTagAssociation">("SongAssoc0000001");

describe("migrated setlist song contract", () => {
    it.each([{}, { id: songId }, { bandPublicId: 1, id: songId }, { bandPublicId: "Band000000000001", id: 1 }])("rejects missing scope and natural IDs in %j", input => {
        expect(GetFilteredSongsArgsSchema.safeParse(input).success).toBe(false);
    });

    it("accepts an explicitly scoped song or empty selection", () => {
        for (const id of [songId, null]) {
            expect(GetFilteredSongsArgsSchema.parse({ bandPublicId: "Band000000000001", id }).id).toBe(id);
        }
    });

    it("uses the target model and explicit foreign-key member for associations", () => {
        expect(xSongTagAssociation.tableName).toBe("BandSongTagAssociation");
        expect(xSongTagAssociation.tableID).toBe("BandSongTagAssociation");
        expect(xSong.fields.tags.getForeignIdentity({ bandSongTagId })).toBe(bandSongTagId);
        expect(xSong.fields.tags.getForeignDatabaseIdentity({ bandSongTagId: 42 })).toBe(42);
        expect(() => xSong.fields.tags.getForeignIdentity({ bandSongTagId: 42 })).toThrow();
    });

    it("hydrates tagged setlist rows with public band-tag references and complete content", () => {
        const listId = parsePublicId<"EventSongList">("Setlist000000001");
        const dto = eventSongListDetailView.parseDto({
            publicId: listId, eventId: "Event00000000001", name: "Set", description: "", sortOrder: 0, isOrdered: true, isActuallyPlayed: false,
            songs: [{ publicId: "ListSong00000001", eventSongListId: listId, songId, subtitle: "", sortOrder: 0,
                song: { publicId: songId, name: "Tune", lengthSeconds: 180, startBPM: 100, endBPM: 120, pinnedRecordingId: null,
                    tags: [{ publicId: associationId, songId, bandSongTagId }] },
            }], dividers: [],
        });
        const content = hydrateEventSongListDetailDto(dto).content;
        expect(content?.stats.songCount).toBe(1);
        expect(content?.songItems[0]?.song.tags).toEqual([{ publicId: associationId, songId, bandSongTagId }]);
    });
});
