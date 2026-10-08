// @vitest-environment jsdom

import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const presentation = vi.hoisted(() => ({ bandPublicId: "FixtureBand00001", routeLocale: "en-US", browserLanguages: ["en-US"] }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({
    authorizationContext: { bandPublicId: presentation.bandPublicId }, localePreferences: presentation,
}) }));
vi.mock("src/core/components/search/SearchBase", () => ({ fetchSearchResultsApi: vi.fn() }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ useURLState: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Authorization", () => ({ useDB3Authorization: () => ({}) }));
vi.mock("src/core/components/SnackbarContext", async () => {
    const React = await vi.importActual<typeof import("react")>("react");
    return { useSnackbar: () => ({ showMessage: vi.fn() }), SnackbarContext: React.createContext({ showMessage: vi.fn() }) };
});

import { useURLState } from "src/core/components/CMCoreComponents2";
import { fetchSearchResultsApi } from "src/core/components/search/SearchBase";
import { defineLegacySearchConfig, useSearchableList } from "src/core/hooks/useSearchableList";
import { useSearchPage } from "src/core/hooks/useSearchFilters";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";

let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
beforeEach(() => {
    document.body.innerHTML = "<div id='root'></div>";
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
    await act(async () => root?.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
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
        await act(async () => state!.setQuickFilter("concert"));
        expect(state!.hasAnyFilters).toBe(true);
        await act(async () => state!.resetToDefaults());
        expect(state!.quickFilter).toBe("");
        expect(state!.hasAnyFilters).toBe(false);
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
    const config = defineLegacySearchConfig<
        { includeDeleted: boolean },
        { id: number },
        { id: number }
    >({
        getQueryArgs: (filter, offset, take) => ({
            tableID: "User", ...filter, offset, take, quickFilter: "", discreteCriteria: [], sort: [],
        }),
        enrichItem: item => item,
        getItemKey: item => item.id,
    });

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

    it("clears results and aborts requests when band or ordered locale preferences change", async () => {
        const pending: Array<{ resolve: (value: SearchResultsRet) => void; signal?: AbortSignal }> = [];
        vi.mocked(fetchSearchResultsApi).mockImplementation((_args, signal) => new Promise(resolve => pending.push({ resolve, signal })));
        let result: ReturnType<typeof useSearchableList<{ includeDeleted: boolean }, { id: number }, { id: number }>>;
        const Capture = () => {
            result = useSearchableList({ includeDeleted: false }, config);
            return null;
        };
        try {
            await act(async () => root.render(React.createElement(Capture)));
            await act(async () => pending[0]!.resolve({ ...MakeEmptySearchResultsRet(), results: [{ id: 1 }], rowCount: 2 }));
            expect(result!.enrichedItems).toEqual([{ id: 1 }]);
            await act(async () => result!.loadMoreData());
            presentation.bandPublicId = "FixtureBand00002";
            await act(async () => root.render(React.createElement(Capture)));
            expect(pending[1]!.signal!.aborted).toBe(true);
            expect(result!.enrichedItems).toEqual([]);
            expect(fetchSearchResultsApi).toHaveBeenLastCalledWith(expect.objectContaining({ bandPublicId: presentation.bandPublicId, offset: 0 }), expect.anything());
            presentation.browserLanguages = ["en-US", "fr-BE"];
            await act(async () => root.render(React.createElement(Capture)));
            expect(pending[2]!.signal!.aborted).toBe(true);
            await act(async () => pending[3]!.resolve({ ...MakeEmptySearchResultsRet(), results: [{ id: 3 }], rowCount: 1 }));
            await act(async () => pending[2]!.resolve({ ...MakeEmptySearchResultsRet(), results: [{ id: 2 }], rowCount: 1 }));
            expect(result!.enrichedItems).toEqual([{ id: 3 }]);
        } finally {
            presentation.bandPublicId = "FixtureBand00001";
            presentation.browserLanguages = ["en-US"];
        }
    });
});
