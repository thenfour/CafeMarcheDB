// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstrumentCatalogEditor } from "src/core/db3/components/BandInstrumentCatalog";
import { bandInstrumentGroupView, bandInstrumentView, type BandInstrumentDto, type BandInstrumentCommand } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { instrumentStrings } from "src/locale/shared/instrumentStrings";

vi.mock("src/core/db3/mutations/executeDB3Command", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/getBandInstrumentCatalog", () => ({ default: vi.fn() }));
vi.mock("src/blitz-client", () => ({ queryClient: { invalidateQueries: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
const actDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const resolution = { value: "Flute", localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US" };
const group = bandInstrumentGroupView.parseDto({ publicId: "Group00000000001", name: "Woodwinds", description: "",
    sortOrder: 2, sortOrderOverride: null, color: "blue", colorOverride: null, globalPublicId: "GlobalGroup00001",
    isHidden: false, nameStringPublicId: null, descriptionStringPublicId: null, nameResolution: resolution, descriptionResolution: resolution });
const instrument = bandInstrumentView.parseDto({ publicId: "Instr00000000001", name: "Flute", description: "Inherited description",
    sortOrder: 5, sortOrderOverride: null, globalPublicId: "GlobalInstr00001", functionalGroupId: group.publicId,
    autoAssignFileLeafRegex: "flute", autoAssignFileLeafRegexOverride: null,
    isHidden: false, nameStringPublicId: null, descriptionStringPublicId: null, nameResolution: resolution, descriptionResolution: resolution });
const label = (key: keyof typeof instrumentStrings) => instrumentStrings[key](key).defaultValue;
const save = vi.fn(async (_command: BandInstrumentCommand) => {});
const close = vi.fn();
beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    save.mockClear(); close.mockClear();
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove();
    if (actDescriptor) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actDescriptor);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function render(entry: BandInstrumentDto = instrument) {
    await act(async () => root.render(<InstrumentCatalogEditor mode="instrument" entry={entry} groups={[group]}
        locales={["en-US", "fr-BE"]} save={save} close={close} label={label} />));
}
function input(labelText: string): HTMLInputElement {
    const label = [...document.querySelectorAll("label")].find(element => visibleText(element) === labelText);
    const value = label ? document.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`) : null;
    if (!value) throw new Error(`Missing input: ${labelText}; labels: ${JSON.stringify([...document.querySelectorAll("label")].map(visibleText))}`);
    return value;
}
async function submit() {
    const button = [...document.querySelectorAll("button")].find(element => visibleText(element) === "Save");
    if (!button) throw new Error(`Missing save button: ${JSON.stringify([...document.querySelectorAll("button")].map(visibleText))}`);
    await act(async () => button.click());
}
function visibleText(element: Element) {
    const clone = element.cloneNode(true);
    if (!(clone instanceof Element)) throw new Error("Expected an element");
    clone.querySelectorAll("style").forEach(style => style.remove());
    return clone.textContent?.trim();
}
describe("instrument catalog forms", () => {
    it("keeps inherited scalar and string values inherited when saving other fields", async () => {
        await render();
        await submit();
        expect(save).toHaveBeenCalledWith({ kind: "updateInstrument", publicId: instrument.publicId,
            patch: { functionalGroupId: group.publicId, sortOrder: null, autoAssignFileLeafRegex: null, isHidden: false } });
        expect(close).toHaveBeenCalledOnce();
    });
    it("sends an explicit blank band name edit without copying the inherited description", async () => {
        await render();
        await act(async () => { const element = input("Name"); element.value = ""; Simulate.change(element); });
        await submit();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({
            name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "" },
        }) }));
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("patch.description");
    });
    it("reports write failures and leaves the form open", async () => {
        await render(); save.mockRejectedValueOnce(new Error("Band grant revoked"));
        await submit();
        expect(document.body.textContent).toContain("Band grant revoked");
        expect(close).not.toHaveBeenCalled();
    });
    it("does not offer a description from another language as the selected translation", async () => {
        await render({ ...instrument, description: "Description française", descriptionResolution: {
            ...instrument.descriptionResolution, value: "Description française", localeTag: "fr-BE",
        } });
        expect(document.querySelector<HTMLTextAreaElement>("textarea:not([aria-hidden])")?.value).toBe("");
        await submit();
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("patch.description");
    });
    it("allows scalar edits when the resolved language is no longer enabled for writing", async () => {
        await render({ ...instrument, nameResolution: { ...instrument.nameResolution, localeTag: "nl-BE" } });
        await act(async () => { const element = input("Sort order"); element.value = "12"; Simulate.change(element); });
        await submit();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ sortOrder: 12 }) }));
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("patch.name");
    });
    it("clears a custom identity explicitly when the inherited-value control is selected", async () => {
        await render({ ...instrument, nameStringPublicId: bandInstrumentView.parseDto({ ...instrument, nameStringPublicId: "String0000000001" }).nameStringPublicId });
        const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox) throw new Error("Missing inheritance control");
        await act(async () => checkbox.click());
        await submit();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({
            name: { kind: "inherit", stringPublicId: "String0000000001" },
        }) }));
    });
});
