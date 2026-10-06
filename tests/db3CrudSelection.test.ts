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

const publicId = parsePublicId<"SetlistPlanGroup">("AbCdEfGhIjKlMn01");

describe("command-backed DB3 selection creation", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("reads the created identity through the CRUD view and hydrates the result", async () => {
        vi.mocked(invoke).mockResolvedValue({
            items: [{
                publicId,
                createdByUserId: parsePublicId<"User">("User000000000001"),
                createdAt: new Date("2026-10-06T12:00:00Z"),
                name: "Brass",
                description: "",
                sortOrder: 0,
                color: "red",
            }],
        } as any);

        const created = await fetchCreatedCrudViewRow(
            db3.setlistPlanGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        );

        expect(created.color?.id).toBe("red");
        expect(vi.mocked(invoke)).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                table: {
                    tableID: "SetlistPlanGroup",
                    tableName: "SetlistPlanGroup",
                    viewID: "SetlistPlanGroup_Editor",
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
            publicId: db3.xBandInstrumentFunctionalGroup.parseIdentity(publicId), name: "Brass", description: "", nameResolution: resolution, descriptionResolution: resolution,
            nameStringPublicId: "String0000000001", descriptionStringPublicId: null,
            color: "blue", colorOverride: null, colorInheritedValue: "blue", sortOrder: 2, sortOrderOverride: null, sortOrderInheritedValue: 2,
            isHidden: false, globalFunctionalGroup: "GlobalGroup00001", globalPublicId: "GlobalGroup00001",
        })] });
        const created = await fetchCreatedCrudViewRow(db3.bandInstrumentGroupView, db3.xBandInstrumentFunctionalGroup.parseIdentity(publicId), new db3.DB3ReferenceStore(), context);
        expect(created.name.value).toBe("Brass");
        expect(created.color.override).toBeNull();
        expect(vi.mocked(invoke)).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(context));
    });

    it("rejects a created row that the authorized CRUD view cannot read", async () => {
        vi.mocked(invoke).mockResolvedValue({ items: [] } as any);

        await expect(fetchCreatedCrudViewRow(
            db3.setlistPlanGroupEditorView,
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
                createdByUserId: parsePublicId<"User">("User000000000001"),
                createdAt: new Date("2026-10-06T12:00:00Z"),
                name: "Missing identity",
                description: "",
                sortOrder: 0,
                color: null,
            }],
        } as any);
        await expect(fetchCreatedCrudViewRow(
            db3.setlistPlanGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toThrow("Required");

        vi.mocked(invoke).mockResolvedValueOnce({
            items: [{
                publicId: "AbCdEfGhIjKlMn02",
                createdByUserId: parsePublicId<"User">("User000000000001"),
                createdAt: new Date("2026-10-06T12:00:00Z"),
                name: "Wrong row",
                description: "",
                sortOrder: 0,
                color: null,
            }],
        } as any);
        await expect(fetchCreatedCrudViewRow(
            db3.setlistPlanGroupEditorView,
            publicId,
            new db3.DB3ReferenceStore(),
        )).rejects.toBeInstanceOf(DB3CreatedRowNotReadableError);
    });
});
