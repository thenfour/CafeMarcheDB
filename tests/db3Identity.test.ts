import { describe, expect, expectTypeOf, it } from "vitest";
import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
import { parsePublicId, type EventPublicId, type InstrumentPublicId, type SongPublicId } from "shared/publicId";
import { songPublicId } from "./support/songFixtures";
import { userPublicId } from "./support/userFixtures";
import { filePublicId } from "./support/fileFixtures";
import { galleryPublicId } from "./support/galleryFixtures";
import * as db3 from "src/core/db3/db3";

describe("DB3 table identity authority", () => {
    const instrumentPublicId = parsePublicId<"Instrument">("InstrumentPub001");

    it("extracts and validates public and natural identities through xTable", () => {
        const fileTagPublicId = parsePublicId<"FileTag">("FileTagPublic001");
        const fileTagAssignmentPublicId = parsePublicId<"FileTagAssignment">("FileTagAssign001");
        const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
        const wikiPageTagAssignmentPublicId = parsePublicId<"WikiPageTagAssignment">("WikiTagAssign001");
        const userInstrumentPublicId = parsePublicId<"UserInstrument">("UserInstrumnt001");
        const fileUserTagPublicId = parsePublicId<"FileUserTag">("FileUserTagPub01");
        const fileSongTagPublicId = parsePublicId<"FileSongTag">("FileSongTagPub01");
        const fileEventTagPublicId = parsePublicId<"FileEventTag">("FileEventTagPub1");
        const fileInstrumentTagPublicId = parsePublicId<"FileInstrumentTag">("FileInstrTagPP01");
        const fileWikiPageTagPublicId = parsePublicId<"FileWikiPageTag">("FileWikiTagPub01");
        expect(db3.xInstrument.getIdentity({ publicId: instrumentPublicId }))
            .toBe(instrumentPublicId);
        expect(db3.xInstrument.isIdentity(instrumentPublicId)).toBe(true);
        expect(db3.xInstrument.isIdentity(42)).toBe(false);
        expect(db3.xInstrument.identitySchema.safeParse("not-a-public-id").success).toBe(false);

        expect(db3.xSong.getIdentity({ publicId: songPublicId(42) })).toBe(songPublicId(42));
        expect(db3.xSong.parseIdentity(songPublicId(42))).toBe(songPublicId(42));
        expect(db3.xFile.getIdentity({ publicId: filePublicId(42) })).toBe(filePublicId(42));
        expect(db3.xFile.parseIdentity(filePublicId(42))).toBe(filePublicId(42));
        expect(db3.xFile.isIdentity(42)).toBe(false);
        expect(db3.xFrontpageGalleryItem.getIdentity({ publicId: galleryPublicId(42) }))
            .toBe(galleryPublicId(42));
        expect(db3.xFrontpageGalleryItem.isIdentity(42)).toBe(false);
        expect(db3.xInstrument.parseDatabaseIdentity(42)).toBe(42);
        expect(db3.xFileTag.getIdentity({ publicId: fileTagPublicId })).toBe(fileTagPublicId);
        expect(db3.xFileTagAssignment.getIdentity({ publicId: fileTagAssignmentPublicId }))
            .toBe(fileTagAssignmentPublicId);
        expect(db3.xWikiPageTag.getIdentity({ publicId: wikiPageTagPublicId }))
            .toBe(wikiPageTagPublicId);
        expect(db3.xWikiPageTagAssignment.getIdentity({ publicId: wikiPageTagAssignmentPublicId }))
            .toBe(wikiPageTagAssignmentPublicId);
        expect(db3.xUserInstrument.getIdentity({ publicId: userInstrumentPublicId }))
            .toBe(userInstrumentPublicId);
        expect(db3.xFileUserTag.getIdentity({ publicId: fileUserTagPublicId }))
            .toBe(fileUserTagPublicId);
        expect(db3.xFileSongTag.getIdentity({ publicId: fileSongTagPublicId }))
            .toBe(fileSongTagPublicId);
        expect(db3.xFileEventTag.getIdentity({ publicId: fileEventTagPublicId }))
            .toBe(fileEventTagPublicId);
        expect(db3.xFileInstrumentTag.getIdentity({ publicId: fileInstrumentTagPublicId }))
            .toBe(fileInstrumentTagPublicId);
        expect(db3.xFileWikiPageTag.getIdentity({ publicId: fileWikiPageTagPublicId }))
            .toBe(fileWikiPageTagPublicId);
        expect(db3.xSong.isIdentity(-1)).toBe(false);
        expect(db3.xSong.isIdentity(1.5)).toBe(false);
    });

    it("lets relation fields own association-object and foreign-identity extraction", () => {
        const association = {
            instrumentId: instrumentPublicId,
            instrument: { publicId: instrumentPublicId, name: "Trumpet" },
        };

        expect(db3.xFile.fields.taggedInstruments.getAssociations({
            taggedInstruments: [association],
        })).toEqual([association]);
        expect(db3.xFile.fields.taggedInstruments.getForeignObject<typeof association.instrument>(
            association,
        )).toBe(association.instrument);
        expect(db3.xFile.fields.taggedInstruments.getForeignIdentity(association))
            .toBe(instrumentPublicId);
        expect(db3.xFile.fields.taggedInstruments.getForeignDatabaseIdentity({
            instrumentId: 123,
        })).toBe(123);
        expect(() => db3.xFile.fields.taggedInstruments.getForeignIdentity({
            instrumentId: 123,
        })).toThrow();

        expect(db3.xUserWithInstrument.fields.instruments.getForeignTableShema().tableID)
            .toBe("Instrument");
        expect(db3.xUserWithInstrument.fields.instruments.getForeignIdentity(instrumentPublicId))
            .toBe(instrumentPublicId);
        const user = { id: 12, publicId: userPublicId(12), instruments: [] };
        const instrument = { publicId: instrumentPublicId, name: "Trumpet" };
        const editedUser = db3.xUser.fields.instruments.withForeignObjects(user, [instrument]);
        expect(editedUser.instruments).toEqual([{
            user,
            userId: user.publicId,
            instrument,
            instrumentId: instrumentPublicId,
        }]);
        expect(db3.xUser.fields.instruments.getForeignIdentity(editedUser.instruments[0]))
            .toBe(instrumentPublicId);

        const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
        const wikiPage: { id: number; tags: unknown[] } = { id: 12, tags: [] };
        const wikiTag = { publicId: wikiPageTagPublicId, text: "Policy" };
        const editedWikiPage = db3.xWikiPage.fields.tags.withForeignObjects(wikiPage, [wikiTag]);
        expect(editedWikiPage.tags).toEqual([{
            wikiPage,
            wikiPageId: wikiPage.id,
            tag: wikiTag,
            tagId: wikiPageTagPublicId,
        }]);
    });

    it("keeps polymorphic search identity correlated with the item discriminator", () => {
        expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.event>["id"]>()
            .toEqualTypeOf<EventPublicId>();
        expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.instrument>["id"]>()
            .toEqualTypeOf<InstrumentPublicId>();
        expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.song>["id"]>()
            .toEqualTypeOf<SongPublicId>();
    });
});
