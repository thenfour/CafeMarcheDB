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
vi.mock("src/core/db3/components/useCrudViewCreate", () => ({ useCrudViewCreate: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    useIsShowingAdminControls: () => false,
    CMButton: ({ children, onClick, disabled, enabled = true, type, ...props }: any) => React.createElement("button", {
        ...props, type, onClick, disabled: disabled ?? !enabled,
    }, children),
}));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ referenceStore: {}, refreshCachedData: vi.fn() }) }));
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
vi.mock("src/core/db3/mutations/db3mutations", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));

import { useMutation, useQuery } from "@blitzjs/rpc";
import getSetting from "src/auth/queries/getSetting";
import db3mutations from "src/core/db3/mutations/db3mutations";
import { ForeignSingleFieldClient, ForeignSingleFieldInput, ForeignSingleFieldInputProps, SelectSingleForeignDialog } from "src/core/db3/components/db3ForeignSingleFieldClient";
import { useCrudViewCreate } from "src/core/db3/components/useCrudViewCreate";

const options = [{ id: 1, name: "Trumpet" }, { id: 2, name: "Flugelhorn" }, { id: 3, name: "Tuba" }];
type Instrument = typeof options[number];
let root: Root;
let spec: ForeignSingleFieldClient<Instrument>;
let queryState: { isLoading: boolean; isFetching: boolean; isError: boolean; isPreviousData: boolean };
let insertAuthorized: boolean;
let selectStyleSetting: "inline" | null;
const onChange = vi.fn();
const onCancel = vi.fn();
const refetch = vi.fn();
const createOption = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    insertAuthorized = true;
    selectStyleSetting = null;
    queryState = { isLoading: false, isFetching: false, isError: false, isPreviousData: false };
    vi.mocked(useCrudViewCreate).mockReturnValue(undefined);
    vi.mocked(useMutation).mockImplementation(resolver => [resolver === db3mutations ? createOption : vi.fn()] as any);
    vi.mocked(useQuery).mockImplementation((query, args: any) => {
        if (query === getSetting) return [selectStyleSetting, { refetch }] as any;
        const filter = args.filter.quickFilterValues.join(" ").toLowerCase();
        return [queryState.isLoading ? undefined : { items: options.filter(o => o.name.toLowerCase().includes(filter)) }, { ...queryState, refetch }] as any;
    });
    spec = new ForeignSingleFieldClient<Instrument>({
        columnName: "instrument", fieldCaption: "Instrument", cellWidth: 150,
        renderAsChip: args => React.createElement("span", { className: "custom-chip", onClick: args.onClick }, args.value?.name || spec.args.nullItemInfo?.label || "None"),
    });
    // Creation permission belongs to the referenced table, not this parent row.
    spec.schemaTable = { tableName: "User", authorizeRowBeforeInsert: () => false } as any;
    spec.schemaColumn = {
        member: "instrument", allowNull: true, allowInsertFromString: true,
        getForeignTableSchema: () => ({
            pkMember: "id", clientIdMember: "id", tableID: "Instrument", tableName: "Instrument",
            getRowInfo: (item: Instrument) => ({ name: item.name }),
            createInsertModelFromString: (name: string) => ({ name }),
            authorizeRowBeforeInsert: () => insertAuthorized,
            activeAsSelectable: (item: Instrument) => item.id !== 3,
            doesItemExactlyMatchText: (item: Instrument, text: string) => item.name.toLowerCase() === text.toLowerCase(),
        }),
    } as any;
    spec.onSchemaConnected({ args: {} } as any);
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const button = (name: string) => [...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent)?.trim() === name)!;
const radio = (name: string) => document.querySelector<HTMLInputElement>(`input[type=radio][aria-label="${name}"]`)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const search = async (value: string) => {
    await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type="search"]')!, { target: { value } } as any));
};
const renderField = async (overrides: Partial<ForeignSingleFieldInputProps<Instrument>> = {}) => {
    await act(async () => root.render(React.createElement(ForeignSingleFieldInput<Instrument>, {
        foreignSpec: spec, tableName: "User", columnName: "instrument", value: options[0]!,
        allowNull: true, readOnly: false, selectStyle: "dialog", onChange, ...overrides,
    })));
};
const renderDialog = async (closeOnSelect = false, value: Instrument | null = options[0]!) => {
    await act(async () => root.render(React.createElement(SelectSingleForeignDialog<Instrument>, {
        spec, value, closeOnSelect, onOK: onChange, onCancel,
    })));
};

describe("shared DB3 foreign-single selection", () => {
    it("accepts a quick choice once and closes, including reselecting the current value", async () => {
        await renderField();
        await click(button("Edit Instrument"));
        expect(button("Apply")).toBeUndefined();
        expect(button("OK")).toBeUndefined();
        expect(document.querySelectorAll('button[aria-current="true"]')).toHaveLength(1);
        expect(button("Trumpet").getAttribute("aria-current")).toBe("true");
        expect(document.querySelectorAll("ul .custom-chip")).toHaveLength(4);
        await click(button("Trumpet"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[0]);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        onChange.mockClear();
        await click(button("Edit Instrument"));
        await click(button("Tuba"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[2]);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("keeps radio choices in a draft until Apply and never toggles the current value off", async () => {
        await renderDialog();
        expect(radio("Trumpet").checked).toBe(true);
        expect(button("Apply").disabled).toBe(true);
        await click(radio("Trumpet"));
        expect(radio("Trumpet").checked).toBe(true);
        await click(radio("Tuba"));
        expect(document.querySelectorAll('input[type=radio]:checked')).toHaveLength(1);
        expect(onChange).not.toHaveBeenCalled();
        await search("Flugel");
        expect(document.body.textContent).toContain("Tuba");
        expect(radio("Tuba")).toBeNull();
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[2]);
    });

    it("cancels a draft without publishing it and starts a fresh draft on reopening", async () => {
        await renderDialog();
        await click(radio("Tuba"));
        await click(button("Cancel"));
        expect(onChange).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledOnce();
        await act(async () => root.render(null));
        await renderDialog(false, { ...options[0]! });
        expect(radio("Trumpet").checked).toBe(true);
        expect(button("Apply").disabled).toBe(true);
    });

    it("uses the domain null label and honors schema and caller nullability", async () => {
        spec.args.nullItemInfo = { label: "Private", color: null, tooltip: null };
        await renderField();
        await click(button("Edit Instrument"));
        await search("no match");
        expect(document.body.textContent).toContain("No matching options");
        await click(button("Private"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(null);
        await renderField({ allowNull: false });
        await click(button("Edit Instrument"));
        expect(button("Private")).toBeUndefined();
        await click(button("Cancel"));
        spec.typedSchemaColumn.allowNull = false;
        await renderField();
        await click(button("Edit Instrument"));
        expect(button("Private")).toBeUndefined();
    });

    it("requires a valid choice for an initially empty non-nullable field", async () => {
        spec.typedSchemaColumn.allowNull = false;
        await renderDialog(false, null);
        expect(radio("None")).toBeNull();
        expect(document.body.textContent).toContain("None selected");
        expect(button("Apply").disabled).toBe(true);
        await click(radio("Trumpet"));
        expect(button("Apply").disabled).toBe(false);
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[0]);
    });

    it("preserves the draft through loading, stale results and a recoverable query failure", async () => {
        await renderDialog();
        await click(radio("Tuba"));
        queryState = { ...queryState, isFetching: true, isPreviousData: true };
        await search("Flugel");
        expect(radio("Flugelhorn").disabled).toBe(true);
        expect(document.body.textContent).toContain("Updating options");
        await click(radio("Flugelhorn"));
        expect(document.body.textContent).toContain("Tuba");
        queryState = { ...queryState, isLoading: true };
        await renderDialog();
        expect(document.body.textContent).toContain("Loading options");
        expect(document.body.textContent).not.toContain("No matching options");
        queryState = { isLoading: false, isFetching: false, isError: true, isPreviousData: false };
        await renderDialog();
        expect(document.body.textContent).toContain("Your selection is still here");
        expect(radio("Flugelhorn")).toBeNull();
        await click(button("Retry"));
        expect(refetch).toHaveBeenCalledOnce();
        queryState.isError = false;
        await search("");
        expect(radio("Tuba").checked).toBe(true);
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[2]);
    });

    it("offers creation only with permission and a fresh, nonempty unmatched search", async () => {
        await renderDialog();
        await search(" ");
        expect(button("Create ' '")).toBeUndefined();
        await search(" Trumpet ");
        expect(button("Create 'Trumpet'")).toBeUndefined();
        insertAuthorized = false;
        await search("Flute");
        expect(button("Create 'Flute'")).toBeUndefined();
        insertAuthorized = true;
        queryState = { ...queryState, isFetching: true, isPreviousData: true };
        await renderDialog();
        expect(button("Create 'Flute'")).toBeUndefined();
        queryState = { ...queryState, isFetching: false, isPreviousData: false };
        await renderDialog();
        expect(button("Create 'Flute'")).toBeDefined();
    });

    it("locks pending creation, retains the draft after failure, and applies a created option explicitly", async () => {
        await renderDialog();
        await search(" Flute ");
        let rejectCreate!: (error: Error) => void;
        createOption.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectCreate = reject; }));
        await click(button("Create 'Flute'"));
        expect(createOption).toHaveBeenCalledOnce();
        expect(createOption.mock.calls[0]![0].insertModel).toEqual({ name: "Flute" });
        expect(button("Creating...").disabled).toBe(true);
        expect(button("Cancel").disabled).toBe(true);
        expect(button("Apply").disabled).toBe(true);
        expect(radio("None").disabled).toBe(true);
        expect(document.querySelector<HTMLInputElement>('input[type=search]')!.disabled).toBe(true);
        await click(button("Creating..."));
        expect(createOption).toHaveBeenCalledOnce();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await act(async () => rejectCreate(new Error("Failed")));
        expect(document.body.textContent).toContain("Could not create the option");
        expect(document.body.textContent).toContain("Trumpet");
        expect(button("Cancel").disabled).toBe(false);
        const flute = { id: 4, name: "Flute" };
        createOption.mockResolvedValueOnce(flute);
        await click(button("Create 'Flute'"));
        expect(onChange).not.toHaveBeenCalled();
        expect(button("Apply").disabled).toBe(false);
        await click(button("Apply"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(flute);
    });

    it("accepts a newly created option immediately in quick-choice mode", async () => {
        const flute = { id: 4, name: "Flute" };
        createOption.mockResolvedValueOnce(flute);
        await renderField();
        await click(button("Edit Instrument"));
        await search("Flute");
        await click(button("Create 'Flute'"));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(flute);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("uses a named CRUD view for public-ID option reads and creation", async () => {
        const foreignSchema = {
            ...spec.typedSchemaColumn.getForeignTableSchema(),
            clientIdMember: "publicId",
        } as any;
        (spec.schemaColumn as any).getForeignTableSchema = () => foreignSchema;
        const view = {
            viewID: "InstrumentFunctionalGroup_Editor",
            entity: { schema: foreignSchema },
            parseDto: (value: unknown) => value,
            hydrate: (dto: Instrument) => ({ ...dto, publicId: `public-id-${dto.id}` }),
            getIdentity: (item: { publicId: string }) => item.publicId,
            crud: { createCommand: {} },
        } as any;
        spec.args.selectionView = view;
        const created = { id: 4, publicId: "AbCdEfGhIjKlMn02", name: "Flute" };
        const commandCreate = vi.fn().mockResolvedValue(created);
        vi.mocked(useCrudViewCreate).mockReturnValue({ create: commandCreate } as any);

        await renderDialog(false, { ...options[0]!, publicId: "AbCdEfGhIjKlMn01" } as any);
        await search("Flute");
        await click([...document.querySelectorAll("button")].find(candidate => (
            candidate.textContent?.includes("Create") && candidate.textContent.includes("Flute")
        ))!);
        await click(button("Apply"));

        expect(commandCreate).toHaveBeenCalledWith({ name: "Flute" });
        expect(createOption).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledWith(created);
        const queryInput = vi.mocked(useQuery).mock.calls
            .map(call => call[1] as any)
            .find(input => input?.cmdbQueryContext === "ForeignSingleFieldRenderContext");
        expect(queryInput.table).toMatchObject({
            tableID: "Instrument",
            tableName: "Instrument",
            viewID: view.viewID,
        });
    });

    it("retains custom option content and captions, inline filtering and read-only behavior", async () => {
        spec.args.renderAsListItem = (_props, item) => React.createElement("strong", null, `Custom ${item.name}`);
        await renderField({ openDialogButtonCaption: "Change instrument" });
        await click(button("Change instrument"));
        expect(document.querySelector("ul strong")?.textContent).toBe("Custom Trumpet");
        await click(button("Cancel"));
        selectStyleSetting = "inline";
        await renderField();
        expect(document.body.textContent).not.toContain("Tuba");
        await click([...document.querySelectorAll<HTMLElement>(".custom-chip")].find(el => el.textContent === "Flugelhorn")!);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(options[1]);
        onChange.mockClear();
        await renderField({ readOnly: true });
        await click([...document.querySelectorAll<HTMLElement>(".custom-chip")].find(el => el.textContent === "Flugelhorn")!);
        expect(onChange).not.toHaveBeenCalled();
        expect(button("Edit Instrument")).toBeUndefined();
        selectStyleSetting = null;
        await renderField({ readOnly: true });
        expect(document.querySelectorAll("button")).toHaveLength(0);
        await renderField({ value: null });
        expect(button("Select Instrument")).toBeDefined();
    });
});
