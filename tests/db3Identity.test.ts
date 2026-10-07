import { describe, expect, expectTypeOf, it } from "vitest";
import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
import { parsePublicId, type EventPublicId, type InstrumentPublicId, type SongPublicId } from "shared/publicId";
import { songPublicId } from "./support/songFixtures";
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
        const bandUserInstrumentPublicId = parsePublicId<"BandUserInstrument">("UserInstrumnt001");
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
        expect(db3.xBandFileTag.getIdentity({ publicId: fileTagPublicId })).toBe(fileTagPublicId);
        expect(db3.xBandFileTagAssignment.getIdentity({ publicId: fileTagAssignmentPublicId }))
            .toBe(fileTagAssignmentPublicId);
        expect(db3.xWikiPageTag.getIdentity({ publicId: wikiPageTagPublicId }))
            .toBe(wikiPageTagPublicId);
        expect(db3.xWikiPageTagAssignment.getIdentity({ publicId: wikiPageTagAssignmentPublicId }))
            .toBe(wikiPageTagAssignmentPublicId);
        expect(db3.xBandUserInstrument.getIdentity({ publicId: bandUserInstrumentPublicId }))
            .toBe(bandUserInstrumentPublicId);
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

        const membershipId = parsePublicId<"BandUser">("Membership000001");
        const membership = { publicId: membershipId, bandUserInstruments: [] };
        const instrument = { publicId: instrumentPublicId, name: "Trumpet" };
        const field = db3.xBandUser.fields.bandUserInstruments;
        expect(field.getForeignTableShema()).toBe(db3.xBandInstrument);
        const editedMember = field.withForeignObjects(membership, [instrument]);
        expect(editedMember.bandUserInstruments).toEqual([{
            bandUser: membership,
            bandUserId: membershipId,
            bandInstrument: instrument,
            bandInstrumentId: instrumentPublicId,
        }]);
        expect(field.getForeignIdentity(editedMember.bandUserInstruments[0]))
            .toBe(instrumentPublicId);

        const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
        const wikiPage = { publicId: parsePublicId<"WikiPage">("WikiPagePublic01"), tags: [] as unknown[] };
        const wikiTag = { publicId: wikiPageTagPublicId, text: "Policy" };
        const editedWikiPage = db3.xWikiPage.fields.tags.withForeignObjects(wikiPage, [wikiTag]);
        expect(editedWikiPage.tags).toEqual([{
            wikiPage,
            wikiPageId: wikiPage.publicId,
            tag: wikiTag,
            tagId: wikiPageTagPublicId,
        }]);
    });

    it("prepares public event and wiki tag identities for commands", () => {
        const eventTagPublicId = parsePublicId<"EventTag">("EventTagPublic01");
        const eventMutation = {};
        db3.xEvent.fields.tags.ApplyClientToDb({
            tags: [{ bandEventTagId: eventTagPublicId }],
        }, eventMutation, "new");
        expect(eventMutation).toEqual({ tags: [eventTagPublicId] });

        const wikiTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
        const wikiMutation = {};
        db3.xWikiPage.fields.tags.ApplyClientToDb({
            tags: [{ tag: { publicId: wikiTagPublicId } }],
        }, wikiMutation, "update");
        expect(wikiMutation).toEqual({ tags: [wikiTagPublicId] });
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


// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:tests/db3Identity.test.ts:1-153
// Reason: These specifications used person-level instrument/tag assignments; membership commands now own those edits.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 84604d69f9085bcbb865049e38d71329e7d8441aa204b5b0f9a917042bd7139a
// MIGRATION_REFERENCE_BEGIN
// import { describe, expect, expectTypeOf, it } from "vitest";
// import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
// import { parsePublicId, type EventPublicId, type InstrumentPublicId, type SongPublicId } from "shared/publicId";
// import { songPublicId } from "./support/songFixtures";
// import { userPublicId } from "./support/userFixtures";
// import { filePublicId } from "./support/fileFixtures";
// import { galleryPublicId } from "./support/galleryFixtures";
// import * as db3 from "src/core/db3/db3";
//
// describe("DB3 table identity authority", () => {
//     const instrumentPublicId = parsePublicId<"Instrument">("InstrumentPub001");
//
//     it("extracts and validates public and natural identities through xTable", () => {
//         const fileTagPublicId = parsePublicId<"FileTag">("FileTagPublic001");
//         const fileTagAssignmentPublicId = parsePublicId<"FileTagAssignment">("FileTagAssign001");
//         const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
//         const wikiPageTagAssignmentPublicId = parsePublicId<"WikiPageTagAssignment">("WikiTagAssign001");
//         const userInstrumentPublicId = parsePublicId<"UserInstrument">("UserInstrumnt001");
//         const fileUserTagPublicId = parsePublicId<"FileUserTag">("FileUserTagPub01");
//         const fileSongTagPublicId = parsePublicId<"FileSongTag">("FileSongTagPub01");
//         const fileEventTagPublicId = parsePublicId<"FileEventTag">("FileEventTagPub1");
//         const fileInstrumentTagPublicId = parsePublicId<"FileInstrumentTag">("FileInstrTagPP01");
//         const fileWikiPageTagPublicId = parsePublicId<"FileWikiPageTag">("FileWikiTagPub01");
//         expect(db3.xInstrument.getIdentity({ publicId: instrumentPublicId }))
//             .toBe(instrumentPublicId);
//         expect(db3.xInstrument.isIdentity(instrumentPublicId)).toBe(true);
//         expect(db3.xInstrument.isIdentity(42)).toBe(false);
//         expect(db3.xInstrument.identitySchema.safeParse("not-a-public-id").success).toBe(false);
//
//         expect(db3.xSong.getIdentity({ publicId: songPublicId(42) })).toBe(songPublicId(42));
//         expect(db3.xSong.parseIdentity(songPublicId(42))).toBe(songPublicId(42));
//         expect(db3.xFile.getIdentity({ publicId: filePublicId(42) })).toBe(filePublicId(42));
//         expect(db3.xFile.parseIdentity(filePublicId(42))).toBe(filePublicId(42));
//         expect(db3.xFile.isIdentity(42)).toBe(false);
//         expect(db3.xFrontpageGalleryItem.getIdentity({ publicId: galleryPublicId(42) }))
//             .toBe(galleryPublicId(42));
//         expect(db3.xFrontpageGalleryItem.isIdentity(42)).toBe(false);
//         expect(db3.xInstrument.parseDatabaseIdentity(42)).toBe(42);
//         expect(db3.xFileTag.getIdentity({ publicId: fileTagPublicId })).toBe(fileTagPublicId);
//         expect(db3.xFileTagAssignment.getIdentity({ publicId: fileTagAssignmentPublicId }))
//             .toBe(fileTagAssignmentPublicId);
//         expect(db3.xWikiPageTag.getIdentity({ publicId: wikiPageTagPublicId }))
//             .toBe(wikiPageTagPublicId);
//         expect(db3.xWikiPageTagAssignment.getIdentity({ publicId: wikiPageTagAssignmentPublicId }))
//             .toBe(wikiPageTagAssignmentPublicId);
//         expect(db3.xUserInstrument.getIdentity({ publicId: userInstrumentPublicId }))
//             .toBe(userInstrumentPublicId);
//         expect(db3.xFileUserTag.getIdentity({ publicId: fileUserTagPublicId }))
//             .toBe(fileUserTagPublicId);
//         expect(db3.xFileSongTag.getIdentity({ publicId: fileSongTagPublicId }))
//             .toBe(fileSongTagPublicId);
//         expect(db3.xFileEventTag.getIdentity({ publicId: fileEventTagPublicId }))
//             .toBe(fileEventTagPublicId);
//         expect(db3.xFileInstrumentTag.getIdentity({ publicId: fileInstrumentTagPublicId }))
//             .toBe(fileInstrumentTagPublicId);
//         expect(db3.xFileWikiPageTag.getIdentity({ publicId: fileWikiPageTagPublicId }))
//             .toBe(fileWikiPageTagPublicId);
//         expect(db3.xSong.isIdentity(-1)).toBe(false);
//         expect(db3.xSong.isIdentity(1.5)).toBe(false);
//     });
//
//     it("lets relation fields own association-object and foreign-identity extraction", () => {
//         const association = {
//             instrumentId: instrumentPublicId,
//             instrument: { publicId: instrumentPublicId, name: "Trumpet" },
//         };
//
//         expect(db3.xFile.fields.taggedInstruments.getAssociations({
//             taggedInstruments: [association],
//         })).toEqual([association]);
//         expect(db3.xFile.fields.taggedInstruments.getForeignObject<typeof association.instrument>(
//             association,
//         )).toBe(association.instrument);
//         expect(db3.xFile.fields.taggedInstruments.getForeignIdentity(association))
//             .toBe(instrumentPublicId);
//         expect(db3.xFile.fields.taggedInstruments.getForeignDatabaseIdentity({
//             instrumentId: 123,
//         })).toBe(123);
//         expect(() => db3.xFile.fields.taggedInstruments.getForeignIdentity({
//             instrumentId: 123,
//         })).toThrow();
//
//         expect(db3.xUserWithInstrument.fields.instruments.getForeignTableShema().tableID)
//             .toBe(db3.xBandInstrument.tableID);
//         expect(db3.xUserWithInstrument.fields.instruments.getForeignIdentity(instrumentPublicId))
//             .toBe(instrumentPublicId);
//         const user = { id: 12, publicId: userPublicId(12), instruments: [] };
//         const instrument = { publicId: instrumentPublicId, name: "Trumpet" };
//         const editedUser = db3.xUser.fields.instruments.withForeignObjects(user, [instrument]);
//         expect(editedUser.instruments).toEqual([{
//             user,
//             userId: user.publicId,
//             instrument,
//             instrumentId: instrumentPublicId,
//         }]);
//         expect(db3.xUser.fields.instruments.getForeignIdentity(editedUser.instruments[0]))
//             .toBe(instrumentPublicId);
//
//         const wikiPageTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
//         const wikiPage = { publicId: parsePublicId<"WikiPage">("WikiPagePublic01"), tags: [] as unknown[] };
//         const wikiTag = { publicId: wikiPageTagPublicId, text: "Policy" };
//         const editedWikiPage = db3.xWikiPage.fields.tags.withForeignObjects(wikiPage, [wikiTag]);
//         expect(editedWikiPage.tags).toEqual([{
//             wikiPage,
//             wikiPageId: wikiPage.publicId,
//             tag: wikiTag,
//             tagId: wikiPageTagPublicId,
//         }]);
//     });
//
//     it("prepares public tag identities for commands and resolved identities for persistence", () => {
//         const user = { publicId: userPublicId(12), instruments: [] };
//         const instrument = { publicId: instrumentPublicId, name: "Trumpet" };
//         const editedUser = db3.xUser.fields.instruments.withForeignObjects(user, [instrument]);
//         const userMutation = {};
//         db3.xUser.fields.instruments.ApplyClientToDb(editedUser, userMutation, "update");
//         expect(userMutation).toEqual({ instruments: [instrumentPublicId] });
//         expect(db3.userEditorView.crud.operations.update.command.parseDto({
//             identity: user.publicId,
//             patch: userMutation,
//         }).patch).toEqual(userMutation);
//
//         const eventTagPublicId = parsePublicId<"EventTag">("EventTagPublic01");
//         const eventMutation = {};
//         db3.xEvent.fields.tags.ApplyClientToDb({
//             tags: [{ eventTagId: eventTagPublicId }],
//         }, eventMutation, "new");
//         expect(eventMutation).toEqual({ tags: [eventTagPublicId] });
//
//         const wikiTagPublicId = parsePublicId<"WikiPageTag">("WikiTagPublic001");
//         const wikiMutation = {};
//         db3.xWikiPage.fields.tags.ApplyClientToDb({
//             tags: [{ tag: { publicId: wikiTagPublicId } }],
//         }, wikiMutation, "update");
//         expect(wikiMutation).toEqual({ tags: [wikiTagPublicId] });
//
//         const resolvedMutation = {};
//         db3.xUser.fields.instruments.ApplyClientToDb({ instruments: [42] }, resolvedMutation, "update");
//         expect(resolvedMutation).toEqual({ instruments: [42] });
//         expect(() => db3.xUser.fields.instruments.ApplyClientToDb({
//             instruments: [{ instrumentId: 42 }],
//         }, {}, "update")).toThrow();
//     });
//
//     it("keeps polymorphic search identity correlated with the item discriminator", () => {
//         expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.event>["id"]>()
//             .toEqualTypeOf<EventPublicId>();
//         expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.instrument>["id"]>()
//             .toEqualTypeOf<InstrumentPublicId>();
//         expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.song>["id"]>()
//             .toEqualTypeOf<SongPublicId>();
//     });
// });
// MIGRATION_REFERENCE_END
