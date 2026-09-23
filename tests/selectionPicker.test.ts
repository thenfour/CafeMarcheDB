// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {} }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));
vi.mock("src/core/db3/db3", () => ({}));
vi.mock("src/core/db3/components/DB3ClientCore", () => ({ fetchUnsuspended: vi.fn() }));
vi.mock("src/core/db3/components/useCrudViewCreate", () => ({ useCrudViewCreate: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ referenceStore: {}, refreshCachedData: vi.fn() }) }));

import { CMSelectDisplayStyle, CMMultiSelect, CMSingleSelect, StringArrayOptionsProvider } from "src/core/components/select/CMSelect";
import { CMSingleSelectDialog, CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
import { CMMultiSelectDialog } from "src/core/components/select/CMMultiSelectDialog";
import { DB3SingleSelect } from "src/core/db3/components/db3Select";
import { DB3MultiSelectDialog } from "src/core/db3/components/db3SelectDialog";
import { fetchUnsuspended } from "src/core/db3/components/DB3ClientCore";
import { useCrudViewCreate } from "src/core/db3/components/useCrudViewCreate";

const numberOptions = StringArrayOptionsProvider([0, 1, 2]);
let root: Root;
const onChange = vi.fn();
const onCancel = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const button = (name: string) => [...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent)?.trim() === name)!;
const checkbox = (name: string) => document.querySelector<HTMLInputElement>(`input[type=checkbox][aria-label="${name}"]`)!;
const render = async (element: React.ReactElement) => { await act(async () => root.render(element)); };
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const search = async (value: string) => { await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type=search]')!, { target: { value } } as any)); };
const singleDialog = (props: object = {}) => React.createElement(CMSingleSelectDialog<number>, {
    ...numberOptions, title: "Number", description: "", value: 0, onOK: onChange, onCancel, ...props,
});

describe("public picker APIs", () => {
    it("keeps zero selected and accepts it without requiring Apply", async () => {
        await render(singleDialog());
        expect(button("0").getAttribute("aria-current")).toBe("true");
        expect(button("None")).toBeUndefined();
        expect(button("Apply")).toBeUndefined();
        await click(button("0"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(0);
    });

    it("distinguishes null, undefined and an unset required selection", async () => {
        await render(singleDialog({ value: null, nullBehavior: CMSelectNullBehavior.AllowNull }));
        await click(button("None"));
        expect(onChange).toHaveBeenLastCalledWith(null);
        await act(async () => root.render(null));
        await render(singleDialog({ value: undefined, nullBehavior: CMSelectNullBehavior.AllowUndefined }));
        await click(button("None"));
        expect(onChange).toHaveBeenLastCalledWith(undefined);
        await act(async () => root.render(null));
        await render(singleDialog({ value: undefined, closeOnSelect: false }));
        expect(document.body.textContent).toContain("None selected");
        expect(button("Apply").disabled).toBe(true);
        await click(document.querySelector<HTMLInputElement>('input[type=radio][aria-label="0"]')!);
        await click(button("Apply"));
        expect(onChange).toHaveBeenLastCalledWith(0);
    });

    it("loads once per search, ignores late results, and retries errors without losing the draft", async () => {
        type Item = { id: number; name: string };
        const pending: { resolve: (items: Item[]) => void; reject: (error: Error) => void }[] = [];
        const getOptions = vi.fn(() => new Promise<Item[]>((resolve, reject) => pending.push({ resolve, reject })));
        await render(React.createElement(CMMultiSelectDialog<Item>, {
            title: "People", description: "", initialValues: [{ id: 9, name: "Existing" }], getOptions,
            getOptionInfo: item => ({ id: item.id, name: item.name }), renderOption: item => item.name, onOK: onChange, onCancel,
        }));
        expect(getOptions).toHaveBeenCalledTimes(1);
        await search("Sam");
        expect(getOptions).toHaveBeenCalledTimes(2);
        expect(getOptions).toHaveBeenLastCalledWith({ quickFilter: "Sam" });
        await act(async () => pending[1]!.resolve([{ id: 2, name: "Sam" }]));
        await click(checkbox("Sam"));
        await act(async () => pending[0]!.resolve([{ id: 1, name: "Alex" }]));
        expect(checkbox("Sam")).not.toBeNull();
        expect(checkbox("Alex")).toBeNull();
        expect(getOptions).toHaveBeenCalledTimes(2);
        await search("Alex");
        await act(async () => pending[2]!.reject(new Error("Offline")));
        expect(document.body.textContent).toContain("Your selection is still here");
        await click(button("Retry"));
        expect(getOptions).toHaveBeenCalledTimes(4);
        await act(async () => pending[3]!.resolve([{ id: 1, name: "Alex" }]));
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledWith([{ id: 9, name: "Existing" }, { id: 2, name: "Sam" }]);
    });

    it("keeps draft changes local and discards them on Cancel", async () => {
        await render(React.createElement(CMMultiSelectDialog<number>, { ...numberOptions, initialValues: [0], title: "Numbers", description: "", onOK: onChange, onCancel }));
        await click(checkbox("2"));
        expect(onChange).not.toHaveBeenCalled();
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("uses one compact Edit button inside the chip container and loads choices only when needed", async () => {
        const getOptions = vi.fn(numberOptions.getOptions);
        await render(React.createElement(CMSingleSelect<number>, {
            ...numberOptions, getOptions, value: 0, onChange, displayStyle: CMSelectDisplayStyle.SelectedWithDialog,
            dialogTitle: "Number", chipSize: "big", chipShape: "rounded",
        }));
        expect(getOptions).not.toHaveBeenCalled();
        const edit = button("Edit Number");
        expect(edit.parentElement?.classList.contains("CMChipContainer")).toBe(true);
        await click(edit);
        expect(getOptions).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll(".CMSelectionDialog li .CMChip.big.rounded")).toHaveLength(3);
    });

    it("filters local arrays even when the provider returns all options", async () => {
        await render(singleDialog());
        await search("2");
        expect(button("0")).toBeUndefined();
        expect(button("2")).toBeDefined();
        await search("missing");
        expect(document.body.textContent).toContain("No matching options");
    });

    it("preserves explicit inline editing and prevents read-only custom triggers from opening", async () => {
        await render(React.createElement(CMSingleSelect<number>, { ...numberOptions, value: 0, onChange, displayStyle: CMSelectDisplayStyle.AllWithInlineEditing }));
        const zero = document.querySelector<HTMLInputElement>('input[type=radio][aria-label="0"]')!;
        expect(zero.checked).toBe(true);
        await click(zero);
        expect(onChange).not.toHaveBeenCalled();
        await click(document.querySelector<HTMLInputElement>('input[type=radio][aria-label="1"]')!);
        expect(onChange).toHaveBeenCalledWith(1);
        await render(React.createElement(CMMultiSelect<number>, {
            ...numberOptions, value: [0], onChange, readonly: true, displayStyle: CMSelectDisplayStyle.CustomButtonWithDialog,
            customRender: open => React.createElement("button", { onClick: open }, "Custom open"),
        }));
        await click(button("Custom open"));
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("creates an async option once, using trimmed input, and keeps it in the multi-select draft", async () => {
        let resolveCreate!: (value: string) => void;
        const create = vi.fn(() => new Promise<string>(resolve => { resolveCreate = resolve; }));
        const strings = StringArrayOptionsProvider(["Existing"]);
        await render(React.createElement(CMMultiSelectDialog<string>, {
            ...strings, initialValues: [], title: "Tags", description: "", doInsertFromString: create, onOK: onChange, onCancel,
        }));
        await search("Existing");
        expect(button("Create 'Existing'")).toBeUndefined();
        await search(" New ");
        await click(button("Create 'New'"));
        expect(create).toHaveBeenCalledWith("New");
        expect(button("Cancel").disabled).toBe(true);
        await click(button("Creating..."));
        expect(create).toHaveBeenCalledTimes(1);
        await act(async () => resolveCreate("New"));
        expect(onChange).not.toHaveBeenCalled();
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledWith(["New"]);
    });
});

describe("DB3 picker adapters", () => {
    it("uses schema labels and permissions with the same field, search and creation UI", async () => {
        const instrument = { id: 1, name: "Trumpet" };
        const created = { id: 2, name: "Flute" };
        const create = vi.fn().mockResolvedValue(created);
        const onInsert = vi.fn();
        let allowed = false;
        const schema = {
            tableID: "Instrument",
            getIdentity: (item: typeof instrument) => item.id,
            getRowInfo: (item: typeof instrument) => ({ pk: item.id, name: item.name, color: "gold" }),
            createInsertModelFromString: (name: string) => ({ name }),
            authorizeRowBeforeInsert: () => allowed,
            doesItemExactlyMatchText: (item: typeof instrument, text: string) => item.name === text,
        } as any;
        // The picker test needs only identity and schema ownership from a view.
        const view = {
            viewID: "Instrument_Editor",
            entity: schema,
        } as any;
        // The hook mock implements the token surface used by the picker.
        vi.mocked(useCrudViewCreate).mockReturnValue({ create } as any);
        vi.mocked(fetchUnsuspended).mockImplementation((args: any) => ({
            items: args.filterModel.quickFilterValues.length ? [] : [instrument], isLoading: false, refetch: vi.fn(),
            queryResult: { isError: false, isFetching: false, isPreviousData: false },
        }) as any);
        await render(React.createElement(DB3SingleSelect<typeof instrument>, {
            schema, view, value: instrument, onChange, displayStyle: CMSelectDisplayStyle.SelectedWithDialog, dialogTitle: "Instrument", onInsert,
        }));
        expect(vi.mocked(fetchUnsuspended).mock.calls[0]![0].queryOptions.enabled).toBe(false);
        await click(button("Edit Instrument"));
        expect(button("Trumpet")).toBeDefined();
        await search("Flute");
        expect(button("Create 'Flute'")).toBeUndefined();
        allowed = true;
        await search(" Flute ");
        await click(button("Create 'Flute'"));
        expect(create).toHaveBeenCalledWith({ name: "Flute" });
        expect(onInsert).toHaveBeenCalledWith(created);
        expect(onChange).toHaveBeenCalledWith(created);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        await render(React.createElement(DB3MultiSelectDialog<typeof instrument>, { schema, view, initialValues: [instrument], title: "Instruments", description: "", onOK: onChange, onCancel }));
        expect(checkbox("Trumpet").checked).toBe(true);
        expect(button("Apply").disabled).toBe(true);
    });

    it("creates through a CRUD view and selects the hydrated public-ID row", async () => {
        const existing = { publicId: "AbCdEfGhIjKlMn01", name: "Brass" };
        const created = { publicId: "AbCdEfGhIjKlMn02", name: "Flute", hydrated: true };
        const create = vi.fn().mockResolvedValue(created);
        const schema = {
            tableID: "InstrumentFunctionalGroup",
            getIdentity: (item: typeof existing) => item.publicId,
            getRowInfo: (item: typeof existing) => ({ pk: item.publicId, name: item.name, color: null }),
            createInsertModelFromString: (name: string) => ({ name, description: "", sortOrder: 0 }),
            authorizeRowBeforeInsert: () => true,
            doesItemExactlyMatchText: (item: typeof existing, text: string) => item.name === text,
        } as any;
        const view = {
            viewID: "InstrumentFunctionalGroup_Editor",
            entity: schema,
            crud: { operations: { create: { kind: "create", command: {} } } },
        } as any;
        vi.mocked(useCrudViewCreate).mockReturnValue({ create } as any);
        vi.mocked(fetchUnsuspended).mockReturnValue({
            items: [], isLoading: false, refetch: vi.fn(),
            queryResult: { isError: false, isFetching: false, isPreviousData: false },
        } as any);

        await render(React.createElement(DB3SingleSelect<typeof existing>, {
            schema,
            view,
            value: existing,
            onChange,
            displayStyle: CMSelectDisplayStyle.SelectedWithDialog,
            dialogTitle: "Instrument group",
            allowInsertFromString: true,
        }));
        await click(button("Edit Instrument group"));
        await search(" Flute ");
        await click([...document.querySelectorAll("button")].find(candidate => (
            candidate.textContent?.includes("Create") && candidate.textContent.includes("Flute")
        ))!);

        expect(create).toHaveBeenCalledWith({ name: "Flute", description: "", sortOrder: 0 });
        expect(onChange).toHaveBeenCalledWith(created);
        expect(vi.mocked(fetchUnsuspended).mock.calls.at(-1)![0]).toMatchObject({
            schema,
            view,
            referenceProvider: {},
        });
        expect(vi.mocked(useCrudViewCreate)).toHaveBeenCalledWith(view);
    });
});
