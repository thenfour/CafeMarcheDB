import { describe, expect, expectTypeOf, it } from "vitest";
import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
import { parsePublicId, type InstrumentPublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";

describe("DB3 table identity authority", () => {
    const instrumentPublicId = parsePublicId<"Instrument">("InstrumentPub001");

    it("extracts and validates public and natural identities through xTable", () => {
        const fileTagPublicId = parsePublicId<"FileTag">("FileTagPublic001");
        const fileTagAssignmentPublicId = parsePublicId<"FileTagAssignment">("FileTagAssign001");
        expect(db3.xInstrument.getIdentity({ publicId: instrumentPublicId }))
            .toBe(instrumentPublicId);
        expect(db3.xInstrument.isIdentity(instrumentPublicId)).toBe(true);
        expect(db3.xInstrument.isIdentity(42)).toBe(false);
        expect(db3.xInstrument.identitySchema.safeParse("not-a-public-id").success).toBe(false);

        expect(db3.xSong.getIdentity({ id: 42 })).toBe(42);
        expect(db3.xSong.parseIdentity(42)).toBe(42);
        expect(db3.xInstrument.parseDatabaseIdentity(42)).toBe(42);
        expect(db3.xFileTag.getIdentity({ publicId: fileTagPublicId })).toBe(fileTagPublicId);
        expect(db3.xFileTagAssignment.getIdentity({ publicId: fileTagAssignmentPublicId }))
            .toBe(fileTagAssignmentPublicId);
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
    });

    it("keeps polymorphic search identity correlated with the item discriminator", () => {
        expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.instrument>["id"]>()
            .toEqualTypeOf<InstrumentPublicId>();
        expectTypeOf<QuickSearchItemMatch<QuickSearchItemType.song>["id"]>()
            .toEqualTypeOf<number>();
    });
});
