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

    it("preserves selected band, complete language preferences and refresh identity during catalog read-back", async () => {
        const context = { bandPublicId: parsePublicId<"Band">("Band000000000001"), routeLocale: "en-US",
            browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "refresh-2" };
        const resolution = { value: "Brass", localeTag: "fr-BE", scope: "band", source: "stored", reason: "exact", requestedTag: "fr-BE" };
        vi.mocked(invoke).mockResolvedValue({ items: [db3.bandInstrumentGroupView.parseDto({
            publicId, name: "Brass", description: "", nameResolution: resolution, descriptionResolution: resolution,
            nameStringPublicId: "String0000000001", descriptionStringPublicId: null,
            color: "blue", colorOverride: null, colorInheritedValue: "blue", sortOrder: 2, sortOrderOverride: null, sortOrderInheritedValue: 2,
            isHidden: false, globalFunctionalGroup: "GlobalGroup00001", globalPublicId: "GlobalGroup00001",
        })] });
        const created = await fetchCreatedCrudViewRow(db3.bandInstrumentGroupView, publicId, new db3.DB3ReferenceStore(), context);
        expect(created.name.value).toBe("Brass");
        expect(created.color.override).toBeNull();
        expect(vi.mocked(invoke)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(context));
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
        vi.mocked(invoke).mockResolvedValueOnce({
            items: [{
                name: "Missing identity",
                description: "",
                sortOrder: 0,
                color: null,
            }],
        } as any);
        await expect(fetchCreatedCrudViewRow(
            db3.instrumentFunctionalGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toThrow("invalid public ID");

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
