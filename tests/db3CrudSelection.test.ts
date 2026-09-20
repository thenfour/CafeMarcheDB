import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@blitzjs/rpc", async () => ({
    ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"),
    invoke: vi.fn(),
}));

import { invoke } from "@blitzjs/rpc";
import * as db3 from "@db3/db3";
import {
    DB3CreatedRowNotReadableError,
    fetchCreatedCrudViewRow,
} from "@db3/components/useCrudViewCreate";
import { parsePublicId } from "shared/publicId";

const publicId = parsePublicId<"InstrumentFunctionalGroup">("AbCdEfGhIjKlMn01");

describe("command-backed DB3 selection creation", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("reads the created identity through the CRUD view and hydrates the result", async () => {
        vi.mocked(invoke).mockResolvedValue({
            items: [{
                publicId,
                name: "Brass",
                description: "",
                sortOrder: 0,
                color: "red",
            }],
        } as any);

        const created = await fetchCreatedCrudViewRow(
            db3.instrumentFunctionalGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        );

        expect((created.color as unknown as { id: string }).id).toBe("red");
        expect(vi.mocked(invoke)).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                table: {
                    tableID: "InstrumentFunctionalGroup",
                    tableName: "InstrumentFunctionalGroup",
                    viewID: "InstrumentFunctionalGroup_Editor",
                },
                take: 2,
                filter: { items: [], publicIds: [publicId] },
            }),
        );
    });

    it("rejects a created row that the authorized CRUD view cannot read", async () => {
        vi.mocked(invoke).mockResolvedValue({ items: [] } as any);

        await expect(fetchCreatedCrudViewRow(
            db3.instrumentFunctionalGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toEqual(expect.objectContaining({
            name: "DB3CreatedRowNotReadableError",
            message: expect.stringContaining("but it is not readable"),
        }));
    });

    it("validates the read-back DTO and rejects a mismatched canonical identity", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ items: [{ name: "Missing identity" }] } as any);
        await expect(fetchCreatedCrudViewRow(
            db3.instrumentFunctionalGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toThrow("Expected an InstrumentFunctionalGroup public ID");

        vi.mocked(invoke).mockResolvedValueOnce({
            items: [{
                publicId: "AbCdEfGhIjKlMn02",
                name: "Wrong row",
                description: "",
                sortOrder: 0,
                color: null,
            }],
        } as any);
        await expect(fetchCreatedCrudViewRow(
            db3.instrumentFunctionalGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toBeInstanceOf(DB3CreatedRowNotReadableError);
    });
});
