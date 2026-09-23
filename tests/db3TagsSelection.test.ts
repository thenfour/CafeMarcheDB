// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@blitzjs/rpc", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("src/core/db3/db3", () => ({
    hydrateView: (view: any, dto: any, references: any) => view.hydrate(dto, references),
}));
vi.mock("src/core/db3/components/DB3ClientCore", () => ({
    IColumnClient: class { constructor(args: object) { Object.assign(this, args); } },
}));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    useIsShowingAdminControls: () => false,
    CMButton: ({ children, onClick, disabled, enabled = true, type, ...props }: any) => React.createElement("button", {
        ...props, type, onClick, disabled: disabled ?? !enabled,
    }, children),
}));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ referenceStore: {}, refreshCachedData: vi.fn() }) }));
vi.mock("src/core/db3/components/useCrudViewCreate", () => ({ useCrudViewCreate: vi.fn() }));
vi.mock("src/core/components/SettingMarkdown", () => ({
    GenerateForeignSingleSelectStyleSettingName: () => "selection-style",
    SettingMarkdown: () => null,
}));
vi.mock("src/core/components/SnackbarContext", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return { SnackbarContext: React.createContext({ showMessage: vi.fn() }) };
});
vi.mock("src/auth/mutations/updateSetting", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/getSetting", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));

import { useMutation, useQuery } from "@blitzjs/rpc";
import getSetting from "src/auth/queries/getSetting";
import { TagsFieldClient, TagsFieldInput } from "src/core/db3/components/DB3ClientTagsField";
import { useCrudViewCreate } from "src/core/db3/components/useCrudViewCreate";

const options = [{ id: 1, name: "Trumpet" }, { id: 2, name: "Flugelhorn" }, { id: 3, name: "Tuba" }];
const initialValue = [
    { id: 101, instrumentId: 1, instrument: options[0]!, isPrimary: true },
    { id: 102, instrumentId: 2, instrument: options[1]!, isPrimary: false },
];
type Association = typeof initialValue[number];
let root: Root;
let spec: TagsFieldClient<Association>;
let queryState: { isLoading: boolean; isFetching: boolean; isError: boolean; isPreviousData: boolean };
let insertAuthorized: boolean;
const onChange = vi.fn();
const refetch = vi.fn();
const createOption = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    insertAuthorized = true;
    queryState = { isLoading: false, isFetching: false, isError: false, isPreviousData: false };
    // These hook mocks implement only the token/tuple surface exercised here.
    vi.mocked(useCrudViewCreate).mockReturnValue({ create: createOption } as any);
    vi.mocked(useMutation).mockReturnValue([vi.fn()] as any);
    vi.mocked(useQuery).mockImplementation((query, args: any) => {
        if (query === getSetting) return [null, { refetch }] as any;
        const filter = args.filter.quickFilterValues.join(" ").toLowerCase();
        return [queryState.isLoading ? undefined : { items: options.filter(o => o.name.toLowerCase().includes(filter)) }, { ...queryState, refetch }] as any;
    });
    const foreignSchema = {
        tableID: "Instrument",
        tableName: "Instrument",
        getIdentity: (item: typeof options[number]) => item.id,
        createInsertModelFromString: (name: string) => ({ name }),
        authorizeRowBeforeInsert: () => insertAuthorized,
    };
    const selectionView = {
        viewID: "Instrument_Editor",
        entity: foreignSchema,
        parseDto: (item: typeof options[number]) => item,
        hydrate: (item: typeof options[number]) => item,
        crud: { operations: { create: { kind: "create", command: {} } } },
    };
    spec = new TagsFieldClient<Association>({
        columnName: "taggedInstruments", fieldCaption: "Instruments", cellWidth: 150, allowDeleteFromCell: false,
        // This intentionally minimal descriptor supplies only the view members
        // exercised by the selector test.
        selectionView: selectionView as any,
        renderAsChip: args => React.createElement("span", { className: "custom-chip", onClick: args.onClick }, args.value?.instrument.name),
    });
    spec.schemaTable = { tableName: "File", authorizeRowBeforeInsert: () => insertAuthorized } as any;
    spec.schemaColumn = {
        member: "taggedInstruments", allowInsertFromString: true,
        associationForeignIDMember: "instrumentId", associationLocalIDMember: "fileId", associationLocalObjectMember: "file",
        localTableSpec: { pkMember: "id" },
        getForeignTableShema: () => foreignSchema,
        getAssociationTableShema: () => ({
            getRowInfo: (a: Association) => ({ name: a.instrument.name }),
            doesItemExactlyMatchText: (a: Association, text: string) => a.instrument.name.toLowerCase() === text.toLowerCase(),
        }),
        createMockAssociation: (row: { id: number }, instrument: typeof options[number]) => ({ id: -instrument.id, instrumentId: instrument.id, instrument, isPrimary: false, fileId: row.id }),
    } as any;
    spec.onSchemaConnected({} as any);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => (b.getAttribute("aria-label") || b.textContent)?.trim() === name)!;
const checkbox = (name: string) => document.querySelector<HTMLInputElement>(`input[type=checkbox][aria-label="${name}"]`)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const render = async (value = initialValue, selectStyle: "inline" | "dialog" = "dialog") => {
    await act(async () => root.render(React.createElement(TagsFieldInput<Association>, {
        spec, row: { id: 7 }, value, onChange, selectStyle,
    })));
};
const search = async (value: string) => {
    await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type="search"]')!, { target: { value } } as any));
};
const open = async () => { await render(); await click(button("Edit Instruments")); };

describe("shared DB3 tags selection", () => {
    it("queries tag options with the nested DB3 table descriptor", async () => {
        await open();

        const queryInput = vi.mocked(useQuery).mock.calls
            .map(call => call[1] as any)
            .find(input => input?.cmdbQueryContext === "TagsFieldRenderContext for table.field: File.taggedInstruments");

        expect(queryInput).toMatchObject({
            table: {
                tableID: "Instrument",
                tableName: "Instrument",
                viewID: "Instrument_Editor",
            },
        });
        expect(queryInput).not.toHaveProperty("tableID");
        expect(queryInput).not.toHaveProperty("tableName");
    });

    it("keeps a draft until Apply and preserves existing association metadata after reselection", async () => {
        await open();
        expect(checkbox("Trumpet").checked).toBe(true);
        expect(checkbox("Tuba").checked).toBe(false);
        expect(document.querySelectorAll("ul .custom-chip")).toHaveLength(3);
        expect(document.querySelectorAll("li li")).toHaveLength(0);
        expect(button("Apply").disabled).toBe(true);
        await click(checkbox("Trumpet"));
        await click(checkbox("Trumpet"));
        expect(button("Apply").disabled).toBe(true);
        await click(checkbox("Tuba"));
        expect(onChange).not.toHaveBeenCalled();
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0]).toEqual(expect.arrayContaining([
            expect.objectContaining({ ...initialValue[0], fileId: 7, file: { id: 7 } }),
            expect.objectContaining({ ...initialValue[1], fileId: 7, file: { id: 7 } }),
            expect.objectContaining({ instrumentId: 3 }),
        ]));
        expect(createOption).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("discards changes on Cancel and reopens from the parent value", async () => {
        await open();
        await click(checkbox("Trumpet"));
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
        await click(button("Edit Instruments"));
        expect(checkbox("Trumpet").checked).toBe(true);
        expect(button("Apply").disabled).toBe(true);
    });

    it("retains selections across searches and can remove a selected option hidden by the filter", async () => {
        await open();
        await search("Tuba");
        expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
        await click(checkbox("Tuba"));
        await click(button("Show selected"));
        await click(button("Remove Trumpet"));
        await search("does not exist");
        expect(document.body.textContent).toContain("No matching options");
        expect(document.body.textContent).toContain("2 selected");
        await click(button("Apply"));
        expect(onChange.mock.calls[0]![0].map((a: Association) => a.instrumentId)).toEqual([2, 3]);
    });

    it("keeps the draft and controls available during loading and recoverable query failures", async () => {
        await open();
        await click(checkbox("Tuba"));
        queryState = { ...queryState, isLoading: true, isFetching: true };
        await render();
        expect(document.body.textContent).toContain("Loading options");
        expect(document.body.textContent).not.toContain("No options available");
        expect(document.body.textContent).toContain("3 selected");
        queryState = { ...queryState, isLoading: false, isFetching: false, isError: true };
        await render();
        expect(document.querySelector('[role="alert"]')?.textContent).toContain("Your selection is still here");
        await click(button("Retry"));
        expect(refetch).toHaveBeenCalled();
        queryState = { ...queryState, isError: false };
        await render();
        expect(checkbox("Tuba").checked).toBe(true);
        expect(button("Apply").disabled).toBe(false);
    });

    it("does not allow stale search results to be toggled or used to offer creation", async () => {
        await open();
        queryState = { ...queryState, isFetching: true, isPreviousData: true };
        await search("Tuba");
        expect(checkbox("Tuba").disabled).toBe(true);
        expect(document.body.textContent).toContain("Updating options");
        expect([...document.querySelectorAll("button")].some(b => b.textContent?.startsWith("Create '"))).toBe(false);
    });

    it("respects creation permission and retains the draft when creation fails", async () => {
        insertAuthorized = false;
        await open();
        await search("Flute");
        expect(button("Create 'Flute'")).toBeUndefined();
        insertAuthorized = true;
        await render();
        let rejectCreate!: (error: Error) => void;
        createOption.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCreate = reject; }));
        await click(button("Create 'Flute'"));
        expect(button("Creating...").disabled).toBe(true);
        expect(button("Cancel").disabled).toBe(true);
        expect(button("Apply").disabled).toBe(true);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await act(async () => rejectCreate(new Error("Failed")));
        expect(document.body.textContent).toContain("Could not create the option");
        expect(document.body.textContent).toContain("2 selected");
        expect(button("Cancel").disabled).toBe(false);
        createOption.mockResolvedValueOnce({ id: 4, name: "Flute" });
        await click(button("Create 'Flute'"));
        expect(document.body.textContent).toContain("3 selected");
        expect(onChange).not.toHaveBeenCalled();
        await click(button("Apply"));
        expect(onChange.mock.calls[0]![0]).toEqual(expect.arrayContaining([expect.objectContaining({ instrumentId: 4 })]));
    });

    it("preserves custom option content, inline mode, and the field's direct-removal setting", async () => {
        spec.args.renderAsListItem = (_props, value) => React.createElement("strong", null, `Event-style ${value.instrument.name}`);
        await open();
        expect(document.querySelector("ul strong")?.textContent).toBe("Event-style Trumpet");
        await click(button("Cancel"));
        expect(button("Remove Trumpet")).toBeUndefined();
        spec.args.allowDeleteFromCell = true;
        await render();
        await click(button("Remove Trumpet"));
        expect(onChange.mock.calls[0]![0].map((a: Association) => a.instrumentId)).toEqual([2]);
        onChange.mockClear();
        await render(initialValue, "inline");
        await click([...document.querySelectorAll<HTMLElement>(".custom-chip")].find(e => e.textContent === "Tuba")!);
        expect(onChange.mock.calls[0]![0].map((a: Association) => a.instrumentId)).toEqual([1, 2, 3]);
    });

    it("shows an empty value and opens the selector", async () => {
        await render([]);
        expect(document.body.textContent).toContain("None selected");
        expect(button("Edit Instruments")).toBeDefined();
        await click(button("Edit Instruments"));
        expect([...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every(c => !c.checked)).toBe(true);
    });

    it("allows clearing the selection and does not offer to create an existing trimmed name", async () => {
        await open();
        await search("Trumpet ");
        expect(button("Create 'Trumpet'")).toBeUndefined();
        await search("");
        await click(checkbox("Trumpet"));
        await click(checkbox("Flugelhorn"));
        expect(document.body.textContent).toContain("None selected");
        expect(button("Apply").disabled).toBe(false);
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledWith([]);
    });
});
