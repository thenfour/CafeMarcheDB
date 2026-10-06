import { describe, expect, expectTypeOf, it } from "vitest";
import { Permission } from "shared/permissions";
import { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { ServerPermissionSet } from "src/auth/server/ServerPermissionSet";
import { xBandSongTag, bandSongTagView } from "src/core/db3/shared/entities/song/bandSongTagViews";
import type { ClientOf } from "src/core/db3/shared/core/db3View";
import type { DB3SchemaMutationModel } from "src/core/db3/shared/db3core";
import { matchesDB3Like, matchesDB3Where, queryDB3Memory } from "src/core/db3/shared/core/db3MemoryQuery";
import { deriveFieldWriteSchema } from "src/core/db3/shared/core/db3FieldValidation";
import { xBandInstrument, xBandInstrumentFunctionalGroup } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { GenericIntegerField } from "src/core/db3/shared/columnTypes/genericInteger";
import { createAuthContextMap_GrantAll } from "src/core/db3/shared/db3core";

const auth = new CMServerAuthorization(null, new ServerPermissionSet([
    { id: 1, name: Permission.always_grant }, { id: 2, name: Permission.login },
]));
const rows = [
    { publicId: "bbbbbbbbbbbbbbbb", name: "Flute", group: "Brass", indicator: null, indicatorCssClass: null, sortOrder: 0 },
    { publicId: "aaaaaaaaaaaaaaaa", name: "Flute", group: "Woodwind", indicator: "Solo", indicatorCssClass: null, sortOrder: 0 },
    { publicId: "cccccccccccccccc", name: "Oboe", group: "Woodwind", indicator: null, indicatorCssClass: null, sortOrder: 0 },
];
describe("shared DB3 resolved query backend", () => {
    it("keeps DB3 AND-per-token and OR-per-field behavior", () => {
        expect(queryDB3Memory(xBandSongTag, rows, { quickFilterValues: ["flut", "wind"] }, auth,
            { name: "asc" }, "en-US", 0, 1)).toEqual({ count: 1, items: [rows[1]] });
        expect(queryDB3Memory(xBandSongTag, rows, { quickFilterValues: ["flut", "solo"] }, auth,
            undefined, "en-US", 0)).toEqual({ count: 1, items: [rows[1]] });
    });
    it("counts before paging and uses a stable public identity for ordering ties", () => {
        expect(queryDB3Memory(xBandSongTag, rows, { quickFilterValues: ["flut"] }, auth,
            { name: "asc" }, "en-US", 0, 1)).toEqual({ count: 2, items: [rows[1]] });
        expect(queryDB3Memory(xBandSongTag, rows, { quickFilterValues: ["flut"] }, auth,
            { name: "asc" }, "en-US", 1, 1)).toEqual({ count: 2, items: [rows[0]] });
    });
    it("combines public identities and normal equality filters without changing token composition", () => {
        expect(queryDB3Memory(xBandSongTag, rows, { publicIds: [rows[0]!.publicId], items: [{ field: "group", operator: "equals", value: "Brass" }] }, auth,
            undefined, "en-US", 0).items).toEqual([rows[0]]);
    });
    it("distinguishes intentional blanks and missing values, including empty searches", () => {
        expect(matchesDB3Where({ name: "" }, { name: { contains: "" } })).toBe(true);
        expect(matchesDB3Where({ name: null }, { name: { contains: "" } })).toBe(false);
        expect(matchesDB3Where({ name: "" }, { name: { equals: null } })).toBe(false);
        expect(matchesDB3Where({ name: null }, { name: { equals: null } })).toBe(true);
        expect(queryDB3Memory(xBandSongTag, rows, { quickFilterValues: [""] }, auth, undefined, "en-US", 0).count).toBe(3);
    });
    it("retains LIKE wildcard and escape behavior instead of a substring-only matcher", () => {
        expect(matchesDB3Like("Flute", "%FL_TE%")).toBe(true);
        expect(matchesDB3Like("100%", "%\\%%")).toBe(true);
        expect(matchesDB3Like("100x", "%\\%%")).toBe(false);
        expect(matchesDB3Like("A_B", "%\\_%")).toBe(true);
    });
});
describe("DB3 field-owned catalog validation", () => {
    it("uses ordinary color, integer, and regex field constraints for inherited writes", () => {
        expect(deriveFieldWriteSchema(xBandInstrumentFunctionalGroup.fields.color).parse("blue")).toBe("blue");
        expect(() => deriveFieldWriteSchema(xBandInstrumentFunctionalGroup.fields.color).parse("not-a-palette-color")).toThrow();
        expect(deriveFieldWriteSchema(xBandInstrument.fields.sortOrder).parse(null)).toBe(null);
        expect(() => deriveFieldWriteSchema(xBandInstrument.fields.sortOrder).parse(2.5)).toThrow();
        expect(() => deriveFieldWriteSchema(xBandInstrument.fields.sortOrder).parse(2_147_483_648)).toThrow();
        expect(() => deriveFieldWriteSchema(xBandInstrument.fields.autoAssignFileLeafRegex).parse("[")).toThrow();
        expect(deriveFieldWriteSchema(xBandInstrument.fields.autoAssignFileLeafRegex).parse("flute.*")).toBe("flute.*");
    });
    it("requires explicit localized edits and keeps validation on the field", () => {
        type Writes = DB3SchemaMutationModel<ClientOf<typeof bandSongTagView>, typeof xBandSongTag.fields>;
        type WritesSource = "globalSongTag" extends keyof Writes ? true : false;
        expectTypeOf<WritesSource>().toEqualTypeOf<false>();
        const edit = { kind: "set", stringPublicId: null, localeTag: "en-US", value: "" };
        expect(deriveFieldWriteSchema(xBandInstrument.fields.name).parse(edit)).toEqual(edit);
        expect(() => deriveFieldWriteSchema(xBandInstrument.fields.name).parse("implicit locale text")).toThrow();
        expect(() => deriveFieldWriteSchema(xBandInstrument.fields.name).parse({ ...edit, value: "x".repeat(769) })).toThrow();
        expect(() => xBandSongTag.createInsertModelFromString!("New tag")).toThrow("writing locale");
        expect(xBandSongTag.createInsertModelFromString!("New tag", { localeTag: "fr-BE" })).toEqual({
            name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "New tag" },
        });
    });
    it("returns the parsed integer instead of the original input string", () => {
        const field = new GenericIntegerField({ columnName: "sortOrder", allowNull: false, authMap: createAuthContextMap_GrantAll() });
        expect(field.ValidateAndParse({ row: { sortOrder: "12" }, mode: "update" })).toMatchObject({ result: "success", values: { sortOrder: 12 } });
        expect(field.ValidateAndParse({ row: { sortOrder: "1.5" }, mode: "update" }).result).toBe("error");
        expect(field.ValidateAndParse({ row: { sortOrder: "" }, mode: "update" }).result).toBe("error");
        const nullable = new GenericIntegerField({ columnName: "sortOrder", allowNull: true, authMap: createAuthContextMap_GrantAll() });
        expect(nullable.ValidateAndParse({ row: { sortOrder: "" }, mode: "update" })).toMatchObject({ result: "success", values: { sortOrder: null } });
    });
});
