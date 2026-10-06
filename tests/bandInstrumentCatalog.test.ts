import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { bandInstrumentView } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { encodeDynamicStringValue } from "src/locale/server/dynamicStringWriter";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";

describe("explicit catalog writes and page selection", () => {
    it("rejects forged ownership, numeric IDs, and undeclared write fields", () => {
        const command = { identity: "aaaaaaaaaaaaaaaa", patch: { sortOrder: 1 } };
        expect(() => bandInstrumentView.crud.operations.update.command.parseDto({ ...command, bandId: 2 })).toThrow();
        expect(() => bandInstrumentView.crud.operations.update.command.parseDto({ ...command, identity: 1 })).toThrow();
        expect(() => bandInstrumentView.crud.operations.update.command.parseDto({ ...command, patch: { nameId: 1 } })).toThrow();
        expect(() => bandInstrumentView.crud.operations.update.command.parseDto({ ...command, patch: { name: "Legacy scalar text" } })).toThrow();
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
