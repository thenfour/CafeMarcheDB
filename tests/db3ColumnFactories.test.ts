import { describe, expect, expectTypeOf, it } from "vitest";

import type { ColorPaletteEntry } from "src/core/components/color/palette";
import { ColorColumnClient, GenericStringColumnClient } from "src/core/db3/components/DB3ClientBasicFields";
import {
    defineTableClientSpec,
    makeClientColumnSelection,
    makeClientColumnSet,
    useTableRenderContext,
    xTableClientCaps,
} from "src/core/db3/components/DB3ClientCore";
import * as db3 from "src/core/db3/db3";
import type { InstrumentFunctionalGroupPublicId } from "shared/publicId";
import { GhostField } from "src/core/db3/shared/db3basicFields";
import { makeColumnSet } from "src/core/db3/shared/db3core";

const allowField = () => true;

const instrumentFunctionalGroupPilotSpec = defineTableClientSpec({
    view: db3.instrumentFunctionalGroupEditorView,
    columns: {
        color: columnName => new ColorColumnClient({ columnName, cellWidth: 200 }),
    },
});

function useInstrumentFunctionalGroupPilotClient() {
    return useTableRenderContext({
        requestedCaps: xTableClientCaps.None,
        tableSpec: instrumentFunctionalGroupPilotSpec,
    });
}

describe("DB3 keyed column factories", () => {
    it("uses schema object keys as runtime members while preserving order", () => {
        const fields = makeColumnSet({
            first: memberName => new GhostField({ memberName, _customAuth: allowField }),
            second: memberName => new GhostField({ memberName, _customAuth: allowField }),
        });

        expect(Object.keys(fields)).toEqual(["first", "second"]);
        expect(fields.first.member).toBe("first");
        expect(fields.second.member).toBe("second");
        expectTypeOf(fields).toHaveProperty("first");
        expectTypeOf(fields).toHaveProperty("second");
    });

    it("rejects a schema factory that does not retain its key", () => {
        expect(() => makeColumnSet({
            expected: () => new GhostField({ memberName: "different", _customAuth: allowField }),
        })).toThrow("factory 'expected' produced runtime member 'different'");
    });

    it("types and instantiates reusable client columns from their keys", () => {
        const columns = makeClientColumnSet({
            name: columnName => new GenericStringColumnClient({ columnName, cellWidth: 200 }),
            description: columnName => new GenericStringColumnClient({ columnName, cellWidth: 300 }),
        });

        expect(Object.keys(columns)).toEqual(["name", "description"]);
        expect(columns.name.columnName).toBe("name");
        expectTypeOf(columns.name.columnName).toEqualTypeOf<"name">();

        const selection = makeClientColumnSelection(columns.description, columns.name);
        expect(Object.keys(selection)).toEqual(["description", "name"]);
        expect(selection.description()).toBe(columns.description);
        expectTypeOf(selection).toHaveProperty("description");
        expectTypeOf(selection).toHaveProperty("name");
    });

    it("rejects client factories and selections with inconsistent names", () => {
        expect(() => makeClientColumnSet({
            expected: () => new GenericStringColumnClient({ columnName: "different", cellWidth: 200 }),
        })).toThrow("factory 'expected' produced runtime column 'different'");

        const columns = makeClientColumnSet({
            name: columnName => new GenericStringColumnClient({ columnName, cellWidth: 200 }),
        });
        expect(() => makeClientColumnSelection(columns.name, columns.name))
            .toThrow("Duplicate DB3 client column 'name'");
    });

    it("propagates a view's hydrated row, encoded mutation, and public identity types", () => {
        type TPilotClient = ReturnType<typeof useInstrumentFunctionalGroupPilotClient>;
        type TPilotRow = TPilotClient["items"][number];
        type TPreparedMutation = ReturnType<TPilotClient["prepareMutation"]>;

        expectTypeOf<TPilotRow["color"]>()
            .toEqualTypeOf<ColorPaletteEntry | null | undefined>();
        expectTypeOf<TPreparedMutation["color"]>()
            .toEqualTypeOf<string | null | undefined>();
        expectTypeOf<Parameters<TPilotClient["doDeleteMutation"]>[0]>()
            .toEqualTypeOf<InstrumentFunctionalGroupPublicId>();

        if (false) {
            const prepared = {} as TPreparedMutation;
            // @ts-expect-error Public identity travels separately from prepared values.
            prepared.publicId;
        }
        expect(instrumentFunctionalGroupPilotSpec.args.legacyMutationProjection).toBe(false);
    });
});
