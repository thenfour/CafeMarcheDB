import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { queryResolvedCatalog } from "src/core/db3/shared/core/resolvedCatalogQuery";
import { bandInstrumentCommand } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { encodeDynamicStringValue } from "src/locale/server/dynamicStringWriter";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";

describe("resolved catalog queries", () => {
    const rows = [
        { publicId: "bbbbbbbbbbbbbbbb", name: "Clarinette", sortOrder: 2 },
        { publicId: "aaaaaaaaaaaaaaaa", name: "clarinette", sortOrder: 2 },
        { publicId: "cccccccccccccccc", name: "Flûte", sortOrder: 1 },
        { publicId: "dddddddddddddddd", name: "", sortOrder: 3 },
        { publicId: "eeeeeeeeeeeeeeee", name: null, sortOrder: 4 },
    ];
    it("searches resolved text before paginating and counts the complete match", () => {
        const result = queryResolvedCatalog(rows, { search: "CLAR", sort: "name", take: 1, skip: 1 }, "fr-BE");
        expect(result.count).toBe(2);
        expect(result.items.map(row => row.publicId)).toEqual(["bbbbbbbbbbbbbbbb"]);
    });
    it("uses stable public identities to break locale-equivalent ties in either direction", () => {
        for (const direction of ["asc", "desc"] as const) {
            expect(queryResolvedCatalog(rows, { search: "clar", sort: "name", direction }, "fr-BE").items.map(row => row.publicId))
                .toEqual(["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"]);
        }
        expect(queryResolvedCatalog([...rows].reverse(), { sort: "sortOrder" }, "nl-BE").items)
            .toEqual(queryResolvedCatalog(rows, { sort: "sortOrder" }, "nl-BE").items);
    });
    it("retains blank and missing values without manufacturing text", () => {
        const result = queryResolvedCatalog(rows, { sort: "name" }, "en-US");
        expect(result.items[0]?.name).toBe("");
        expect(result.items.at(-1)?.name).toBeNull();
    });
});

describe("explicit catalog writes and page selection", () => {
    it("rejects forged ownership, numeric IDs, and undeclared write fields", () => {
        const command = { kind: "updateInstrument", publicId: "aaaaaaaaaaaaaaaa", patch: { sortOrder: 1 } };
        expect(() => bandInstrumentCommand.parseDto({ ...command, bandId: 2 })).toThrow();
        expect(() => bandInstrumentCommand.parseDto({ ...command, publicId: 1 })).toThrow();
        expect(() => bandInstrumentCommand.parseDto({ ...command, patch: { nameId: 1 } })).toThrow();
        expect(() => bandInstrumentCommand.parseDto({ ...command, patch: { name: "Legacy scalar text" } })).toThrow();
    });
    it("stores only the format's value column, including an intentional blank", () => {
        expect(encodeDynamicStringValue("PlainText", "")).toEqual({ indexedValue: "", blobValue: null });
        expect(encodeDynamicStringValue("Markdown", "")).toEqual({ indexedValue: null, blobValue: "" });
        expect(() => encodeDynamicStringValue("PlainText", "x".repeat(769))).toThrow();
    });
    it("keeps explicit page band and route preferences without inferring a band", () => {
        expect(pagePresentationInput({}, "nl-BE, fr-BE;q=0.8")).toEqual({ browserLanguages: ["nl-BE", "fr-BE"] });
        expect(pagePresentationInput({ bandPublicId: "aaaaaaaaaaaaaaaa", routeLocale: "fr-FR" })).toMatchObject({
            bandPublicId: parsePublicId<"Band">("aaaaaaaaaaaaaaaa"), routeLocale: "fr-FR",
        });
        expect(() => pagePresentationInput({ bandPublicId: ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"] })).toThrow();
        expect(() => pagePresentationInput({ bandPublicId: "unknown" })).toThrow();
    });
});
