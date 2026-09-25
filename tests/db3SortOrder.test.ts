import { describe, expect, expectTypeOf, it } from "vitest";
import { createUsableSortOrderSlots } from "@db3/server/db3SortOrder";

describe("reorder slots", () => {
    it("returns ascending slots without changing the source rows", () => {
        const items = [{ position: 8, name: "A" }, { position: 2, name: "B" }, { position: 2, name: "C" }];
        const slots = createUsableSortOrderSlots(items, "position");
        expect(slots).toEqual([2, 3, 8]);
        expect(items.map(item => item.position)).toEqual([8, 2, 2]);
        expectTypeOf(slots).toEqualTypeOf<number[]>();
    });

    it("requires an existing, non-nullable numeric field at compile time", () => {
        const items: readonly { position: number; name: string; optional?: number; nullable: number | null }[] = [];
        expect(createUsableSortOrderSlots(items, "position")).toEqual([]);
        if (false) {
            // @ts-expect-error String fields cannot supply numeric positions.
            createUsableSortOrderSlots(items, "name");
            // @ts-expect-error The selected field must exist on each row.
            createUsableSortOrderSlots(items, "missing");
            // @ts-expect-error Optional numeric fields do not supply a position for every row.
            createUsableSortOrderSlots(items, "optional");
            // @ts-expect-error Nullable fields cannot supply numeric positions.
            createUsableSortOrderSlots(items, "nullable");
        }
    });
});
