// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandInstrumentGroupTableSpec } from "src/core/db3/components/BandInstrumentCatalog";
import { bandInstrumentGroupView, type BandInstrumentGroupDto } from "src/core/db3/shared/entities/instrument/bandInstrumentContracts";
import { useTableRenderContext, xTableClientCaps } from "src/core/db3/components/DB3ClientCore";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import { DB3NewObjectDialog } from "src/core/db3/components/db3NewObjectDialog";
import { useDB3CreateFromString } from "src/core/db3/components/useDB3CreateFromString";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import { queryClient } from "src/blitz-client";
import { invalidatePresentation } from "src/locale/components/PresentationProvider";

vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"),
    useMutation: () => [mutation],
}));

vi.mock("src/core/db3/components/useClientAuth", () => ({ useClientAuth: () => authorization }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: "Band000000000001", data: {
    input: { routeLocale: "en-US", browserLanguages: ["fr-BE"], clientRequestId: "refresh-1" },
    localization: { availability: { band: ["en-US", "fr-BE"] } },
} }), invalidatePresentation: vi.fn() }));
vi.mock("src/auth/hooks/useCurrentUser", () => ({ useCurrentUser: () => [authorization.user] }));
vi.mock("src/core/db3/mutations/executeDB3Command", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/getBandInstrumentCatalog", () => ({ default: vi.fn() }));
vi.mock("src/blitz-client", () => ({ queryClient: { invalidateQueries: vi.fn() } }));

const authorization = new CMClientAuthorization({ id: 1, publicId: parsePublicId<"User">("User000000000001") },
    new PermissionSet([Permission.login, Permission.always_grant, Permission.admin_instruments]));
const resolution = { value: "Woodwinds", localeTag: "en-US", scope: "global", source: "stored", reason: "exact", requestedTag: "en-US" };
const group = bandInstrumentGroupView.parseDto({ publicId: "Group00000000001", name: "Woodwinds", description: "Inherited description",
    sortOrder: 2, sortOrderOverride: null, sortOrderInheritedValue: 2, color: "blue", colorOverride: null, colorInheritedValue: "blue",
    globalPublicId: "GlobalGroup00001", globalFunctionalGroup: "GlobalGroup00001", isHidden: false,
    nameStringPublicId: null, descriptionStringPublicId: null, nameResolution: resolution, descriptionResolution: resolution });
const save = vi.fn(async (_values: unknown) => {});
const mutation = vi.fn(async () => ({ identity: "Group00000000001" }));
const close = vi.fn();
const references = new DB3ReferenceStore();
let root: Root;
let container: HTMLDivElement;
const actDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    save.mockClear(); close.mockClear();
    mutation.mockClear(); vi.mocked(queryClient.invalidateQueries).mockClear(); vi.mocked(invalidatePresentation).mockClear();
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (actDescriptor) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actDescriptor);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
});
function Editor({ entry, create = false }: { entry: BandInstrumentGroupDto; create?: boolean }) {
    const client = useTableRenderContext({ tableSpec: bandInstrumentGroupTableSpec, requestedCaps: xTableClientCaps.None, referenceProvider: references });
    const [row, setRow] = React.useState(() => bandInstrumentGroupView.hydrate(entry, references));
    if (create) {
        return <DB3NewObjectDialog table={bandInstrumentGroupTableSpec} tableRenderClient={client} onCancel={close}
            onOK={next => save(client.prepareInsertMutation(next))} />;
    }
    return <>
        {client.clientColumns.map(column => <React.Fragment key={column.columnName}>{column.renderForNewDialog?.({
            key: column.columnName, row, value: row[column.columnName], autoFocus: false,
            api: { setFieldValues: values => setRow(current => ({ ...current, ...values })) },
        })}</React.Fragment>)}
        <button onClick={() => { void save(client.prepareMutation(row, "update")); }}>Save</button>
    </>;
}
async function render(entry = group, create = false) {
    await act(async () => root.render(<Editor entry={entry} create={create} />));
}
function nameInput(): HTMLInputElement {
    const label = [...document.querySelectorAll("label")].find(element => element.textContent?.trim() === "Name");
    const input = label ? document.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`) : null;
    if (!input) {
        throw new Error("Missing localized name editor.");
    }
    return input;
}
async function submit(text = "Save") {
    const button = [...document.querySelectorAll("button")].find(element => element.textContent?.trim() === text);
    if (!button) {
        throw new Error(`Missing submit button: ${text}`);
    }
    await act(async () => button.click());
}
async function chooseLocale(selector: Element, localeTag: string) {
    await act(async () => Simulate.mouseDown(selector, { button: 0 }));
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(element => element.textContent === localeTag);
    if (!option) {
        throw new Error(`Missing writing language: ${localeTag}`);
    }
    await act(async () => option.click());
}

describe("native DB3 localized catalog editors", () => {
    it("prepares ordinary writes without materializing any inherited or localized display value", async () => {
        await render();
        await submit();
        expect(save).toHaveBeenCalledWith({ color: null, sortOrder: null, isHidden: false });
    });
    it("sends an explicit blank edit through the field's normal mutation preparation", async () => {
        await render();
        await act(async () => { const input = nameInput(); input.value = ""; Simulate.change(input); });
        await submit();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: { kind: "set", stringPublicId: null, localeTag: "en-US", value: "" } }));
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("description");
    });
    it("does not offer a translation from another language as the selected draft", async () => {
        await render({ ...group, description: "Description francaise", descriptionResolution: { ...group.descriptionResolution, localeTag: "fr-BE" } });
        // The description field chooses its own actual language; choosing English clears its draft instead of copying French.
        const selectors = [...document.querySelectorAll('[role="combobox"]')];
        expect(selectors).toHaveLength(2);
        await chooseLocale(selectors[1]!, "en-US");
        expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("");
        await submit();
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("description");
    });
    it("allows unrelated scalar saves when the resolved language is no longer enabled for writing", async () => {
        await render({ ...group, nameResolution: { ...group.nameResolution, localeTag: "nl-BE" } });
        expect(nameInput().value).toBe("");
        await submit();
        expect(save.mock.calls[0]?.[0]).not.toHaveProperty("name");
    });
    it("clears an owned identity explicitly through the shared inheritance control", async () => {
        await render({ ...group, nameStringPublicId: parsePublicId<"DynamicLocalizedString">("String0000000001") });
        const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox) {
            throw new Error("Missing inheritance control.");
        }
        await act(async () => checkbox.click());
        await submit();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: { kind: "inherit", stringPublicId: "String0000000001" } }));
    });
    it("keeps the native create dialog and draft open after a failed write, and permits retry", async () => {
        save.mockRejectedValueOnce(new Error("Band grant revoked"));
        await render(group, true);
        await act(async () => { const input = nameInput(); input.value = "New group"; Simulate.change(input); });
        await submit("OK");
        expect(document.body.textContent).toContain("Band grant revoked");
        expect(nameInput().value).toBe("New group");
        await submit("OK");
        expect(save).toHaveBeenCalledTimes(2);
        expect(save.mock.calls[1]?.[0]).toMatchObject({ name: { kind: "set", localeTag: "en-US", value: "New group" } });
    });
    it("shows and uses the selected writing language for native picker creation", async () => {
        function PickerCreation() {
            const creation = useDB3CreateFromString(bandInstrumentGroupView.entity);
            return <>{creation.controls}<button onClick={() => { void save(creation.createModel("New group")); }}>Create</button></>;
        }
        await act(async () => root.render(<PickerCreation />));
        await chooseLocale(document.querySelector('[role="combobox"]')!, "fr-BE");
        await submit("Create");
        expect(save).toHaveBeenCalledWith({ name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "New group" } });
    });
    it("refreshes dependent catalog reads without remounting the picker's unsaved parent", async () => {
        function ParentDraft() {
            const command = useDB3Command(bandInstrumentGroupView.crud.operations.create!.command);
            const [draft, setDraft] = React.useState("Unsaved instrument");
            return <><input aria-label="Parent draft" value={draft} onChange={event => setDraft(event.target.value)} />
                <button onClick={() => { void command.invoke({ name: { kind: "set", stringPublicId: null, localeTag: "fr-BE", value: "New group" } }); }}>Create</button></>;
        }
        await act(async () => root.render(<ParentDraft />));
        await submit("Create");
        expect(mutation).toHaveBeenCalledWith(expect.objectContaining({ bandPublicId: "Band000000000001" }));
        expect(queryClient.invalidateQueries).toHaveBeenCalledOnce();
        expect(invalidatePresentation).not.toHaveBeenCalled();
        expect(document.querySelector<HTMLInputElement>('[aria-label="Parent draft"]')?.value).toBe("Unsaved instrument");
    });
});
