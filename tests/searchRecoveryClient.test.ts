import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({}) }));
vi.mock("src/core/components/search/SearchBase", () => ({ fetchSearchResultsApi: vi.fn() }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ useURLState: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/components/SnackbarContext", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return { useSnackbar: () => ({ showMessage: vi.fn() }), SnackbarContext: React.createContext({ showMessage: vi.fn() }) };
});

import { useURLState } from "src/core/components/CMCoreComponents2";
import { fetchSearchResultsApi } from "src/core/components/search/SearchBase";
import { useSearchableList, SearchableListConfig } from "src/core/hooks/useSearchableList";
import { useSearchPage } from "src/core/hooks/useSearchFilters";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";

let root: Root;
let dom: JSDOM;
const originalGlobals = ["window", "document", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
beforeEach(() => {
    dom = new JSDOM("<div id='root'></div>");
    Object.defineProperties(globalThis, {
        document: { value: dom.window.document, configurable: true, writable: true },
        window: { value: dom.window, configurable: true, writable: true },
        IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true, writable: true },
    });
    root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
    await act(async () => root?.unmount());
    dom?.window.close();
    for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
    }
});

describe("search recovery filter state", () => {
    it("defaults off, marks enabled recovery as an extra filter, and resets it", async () => {
        vi.mocked(useURLState).mockImplementation(((key: string, initial: any) => React.useState(initial)) as any);
        const preset = { label: "All", order: "name", direction: "asc" };
        let state: ReturnType<typeof useSearchPage>;
        const Capture = () => {
            state = useSearchPage({
                table: { getSearchCapabilities: () => ({ includeDeleted: true }) } as any,
                staticFilters: [preset], defaultStaticFilter: preset,
                sortColumnKey: "order", sortDirectionKey: "direction", filterMappings: [],
                buildFilterSpec: ({ includeDeleted }) => ({ includeDeleted }),
                buildStaticFilterSpec: () => preset,
            });
            return null;
        };
        await act(async () => root.render(React.createElement(Capture)));
        expect(state!.includeDeleted).toBe(false);
        expect(state!.hasExtraFilters).toBe(false);
        await act(async () => state!.setIncludeDeleted(true));
        expect(state!.filterSpec).toEqual({ includeDeleted: true });
        expect(state!.hasExtraFilters).toBe(true);
        expect(state!.matchingStaticFilter).toBeUndefined();
        await act(async () => state!.resetToDefaults());
        expect(state!.filterSpec).toEqual({ includeDeleted: false });
        expect(state!.hasExtraFilters).toBe(false);
    });

    it("ignores a recovery URL value when the capability is unavailable", async () => {
        vi.mocked(useURLState).mockImplementation(((key: string, initial: any) => React.useState(key === "includeDeleted" ? true : initial)) as any);
        let result: unknown;
        const Capture = () => {
            const preset = { order: "name", direction: "asc" };
            result = useSearchPage({
                staticFilters: [preset], defaultStaticFilter: preset,
                sortColumnKey: "order", sortDirectionKey: "direction", filterMappings: [],
                buildFilterSpec: ({ includeDeleted }) => ({ includeDeleted }), buildStaticFilterSpec: () => preset,
            }).filterSpec;
            return null;
        };
        await act(async () => root.render(React.createElement(Capture)));
        expect(result).toEqual({ includeDeleted: false });
    });
});

describe("search responses during recovery filter changes", () => {
    const config: SearchableListConfig<{ includeDeleted: boolean }, { id: number }, { id: number }> = {
        getQueryArgs: (filter, offset, take) => ({
            tableID: "User", ...filter, offset, take, quickFilter: "", discreteCriteria: [], sort: [],
        }),
        enrichItem: item => item,
    };

    it("resets pagination and ignores an older response after recovery is switched off", async () => {
        const pending: Array<{ resolve: (value: SearchResultsRet) => void; signal?: AbortSignal }> = [];
        vi.mocked(fetchSearchResultsApi).mockImplementation((_args, signal) => new Promise(resolve => pending.push({ resolve, signal })));
        let result: ReturnType<typeof useSearchableList<{ includeDeleted: boolean }, { id: number }, { id: number }>>;
        const Capture = ({ includeDeleted }: { includeDeleted: boolean }) => {
            result = useSearchableList({ includeDeleted }, config);
            return null;
        };
        await act(async () => root.render(React.createElement(Capture, { includeDeleted: true })));
        await act(async () => root.render(React.createElement(Capture, { includeDeleted: false })));
        expect(pending).toHaveLength(2);
        expect(pending[0]!.signal!.aborted).toBe(true);
        expect(fetchSearchResultsApi).toHaveBeenLastCalledWith(expect.objectContaining({ includeDeleted: false, offset: 0 }), expect.anything());
        await act(async () => pending[1]!.resolve({ ...MakeEmptySearchResultsRet(), results: [{ id: 1 }], rowCount: 1 }));
        await act(async () => pending[0]!.resolve({ ...MakeEmptySearchResultsRet(), results: [{ id: 2 }], rowCount: 2 }));
        expect(result!.enrichedItems).toEqual([{ id: 1 }]);
        expect(result!.results.rowCount).toBe(1);
        expect(result!.loading).toBe(false);
    });

    it("clears loading after a failed request", async () => {
        vi.mocked(fetchSearchResultsApi).mockRejectedValue(new Error("Failed"));
        let loading = true;
        const Capture = () => {
            loading = useSearchableList({ includeDeleted: false }, config).loading;
            return null;
        };
        await act(async () => root.render(React.createElement(Capture)));
        expect(loading).toBe(false);
    });
});
