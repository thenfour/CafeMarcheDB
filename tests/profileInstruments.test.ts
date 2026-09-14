// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/core/db3/DB3Client", async () => ({
    DB3SelectTagsDialog: (await vi.importActual<typeof import("src/core/db3/components/DB3ClientTagsField")>("src/core/db3/components/DB3ClientTagsField")).DB3SelectTagsDialog,
    TagsFieldClient: class {}, PKColumnClient: class {}, xTableClientSpec: class {},
    xTableClientCaps: { Query: 1, Mutation: 2 }, useTableRenderContext: vi.fn(),
}));
vi.mock("src/core/db3/components/DB3ClientCore", () => ({ IColumnClient: class { constructor(args: object) { Object.assign(this, args); } } }));
vi.mock("src/core/db3/db3", () => ({ xUser: {} }));
vi.mock("src/core/db3/clientAPI", () => ({ API: { users: {
    getPrimaryInstrument: (user: any) => (user.instruments.find((i: any) => i.isPrimary) || user.instruments[0])?.instrument ?? null,
    updateUserPrimaryInstrument: { useToken: vi.fn() },
} } }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn(), useFeatureRecorder: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {} }));
vi.mock("src/core/components/CMLink", () => ({}));
vi.mock("src/core/components/CMCoreComponents2", () => ({ useIsShowingAdminControls: () => false }));
vi.mock("src/core/components/SettingMarkdown", () => ({ SettingMarkdown: () => null }));
vi.mock("src/auth/mutations/updateSetting", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/getSetting", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/mutations/db3mutations", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: vi.fn(), useMutation: () => [vi.fn()] }));

import { useQuery } from "@blitzjs/rpc";
import { useTableRenderContext } from "src/core/db3/DB3Client";
import { TagsFieldClient } from "src/core/db3/components/DB3ClientTagsField";
import { API } from "src/core/db3/clientAPI";
import { OwnInstrumentsControl } from "src/core/components/user/UserInstruments";
import { useDashboardContext, useFeatureRecorder } from "src/core/components/dashboardContext/DashboardContext";
import { CMChip } from "src/core/components/CMChip";

const instruments = [{ id: 1, name: "Trumpet" }, { id: 2, name: "Flugelhorn" }, { id: 3, name: "Tuba" }];
const associations = instruments.map((instrument, index) => ({ id: 100 + index, userId: 7, instrumentId: instrument.id, instrument, isPrimary: index === 0 }));
type Association = typeof associations[number];
let row: { id: number; instruments: Association[] };
const setPrimary = vi.fn();
const update = vi.fn();
const refetch = vi.fn();
const dashboardRefetch = vi.fn();
const recordFeature = vi.fn();
let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    row = { id: 7, instruments: associations.slice(0, 2) };
    setPrimary.mockResolvedValue({});
    update.mockResolvedValue({});
    vi.mocked(API.users.updateUserPrimaryInstrument.useToken).mockReturnValue({ invoke: setPrimary } as any);
    vi.mocked(useDashboardContext).mockReturnValue({ currentUser: { id: 7 }, refetchDashboardData: dashboardRefetch } as any);
    vi.mocked(useFeatureRecorder).mockReturnValue(recordFeature);
    const spec = new TagsFieldClient<Association>({ columnName: "instruments", fieldCaption: "Instruments", cellWidth: 150, allowDeleteFromCell: false,
        renderAsChip: args => React.createElement(CMChip, { size: "small", color: "gold", variation: args.colorVariant, onDelete: args.onDelete }, args.value?.instrument.name),
    });
    spec.schemaTable = { tableName: "User" } as any;
    spec.schemaColumn = {
        member: "instruments", allowInsertFromString: false, associationForeignIDMember: "instrumentId",
        getForeignTableShema: () => ({ tableID: "Instrument", tableName: "Instrument" }),
        getAssociationTableShema: () => ({ getRowInfo: (a: Association) => ({ name: a.instrument.name }) }),
        createMockAssociation: (_row: unknown, instrument: typeof instruments[number]) => associations.find(a => a.instrumentId === instrument.id),
    } as any;
    spec.onSchemaConnected({} as any);
    vi.mocked(useTableRenderContext).mockImplementation(() => ({ items: [row], getColumn: () => spec, doUpdateMutation: update, refetch }) as any);
    vi.mocked(useQuery).mockImplementation((_query, args: any) => [{ items: instruments.filter(i => i.name.toLowerCase().includes(args.filter.quickFilterValues.join(" "))) }, { refetch, isLoading: false, isFetching: false }] as any);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const render = async () => { await act(async () => root.render(React.createElement(OwnInstrumentsControl))); };
const button = (name: string) => [...document.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent)?.trim() === name)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };

describe("profile instrument presentation", () => {
    it("shows domain chips with one default marker and compact actions inside the chip container", async () => {
        await render();
        expect(document.querySelectorAll(".CMChip")).toHaveLength(2);
        expect(document.querySelectorAll(".CMChip.selected, .deleteButton")).toHaveLength(0);
        expect(document.body.textContent?.match(/Default/g)).toHaveLength(1);
        expect(button("Edit your instruments").parentElement?.classList.contains("CMChipContainer")).toBe(true);
        expect(button("Change default instrument").parentElement).toBe(button("Edit your instruments").parentElement);
    });

    it("changes the default through assigned instruments only, with Cancel and reselection doing nothing", async () => {
        await render();
        await click(button("Change default instrument"));
        expect(button("Tuba")).toBeUndefined();
        await click(button("Cancel"));
        expect(setPrimary).not.toHaveBeenCalled();
        await click(button("Change default instrument"));
        await click(button("Trumpet"));
        expect(setPrimary).not.toHaveBeenCalled();
        await click(button("Change default instrument"));
        await click(button("Flugelhorn"));
        expect(setPrimary).toHaveBeenCalledWith({ userId: 7, instrumentId: 2 });
        expect(refetch).toHaveBeenCalledTimes(1);
        expect(dashboardRefetch).toHaveBeenCalledTimes(1);
        expect(update).not.toHaveBeenCalled();
    });

    it("keeps list edits in the existing multi-picker and preserves association metadata on Apply", async () => {
        await render();
        await click(button("Edit your instruments"));
        const toggle = () => document.querySelector<HTMLInputElement>('input[type=checkbox][aria-label="Tuba"]')!;
        await click(toggle());
        await click(button("Cancel"));
        expect(update).not.toHaveBeenCalled();
        await click(button("Edit your instruments"));
        await click(toggle());
        await click(button("Apply"));
        expect(update).toHaveBeenCalledWith({ id: 7, instruments: associations });
        expect(setPrimary).not.toHaveBeenCalled();
    });

    it("keeps empty and single-instrument values simple and uses the existing fallback default", async () => {
        row.instruments = [];
        await render();
        expect(document.body.textContent).toContain("None selected");
        expect(button("Edit your instruments").textContent).toBe("Select instruments");
        expect(button("Change default instrument")).toBeUndefined();
        row.instruments = [associations[1]!];
        await render();
        expect(document.querySelectorAll(".CMChip")).toHaveLength(1);
        expect(button("Change default instrument")).toBeUndefined();
        row.instruments = [associations[1]!, associations[2]!];
        await render();
        await click(button("Change default instrument"));
        expect(button("Flugelhorn").getAttribute("aria-current")).toBe("true");
        await act(async () => Simulate.change(document.querySelector<HTMLInputElement>('input[type=search]')!, { target: { value: "tuba" } } as any));
        expect(button("Flugelhorn")).toBeUndefined();
        expect(button("Tuba")).toBeDefined();
    });
});
