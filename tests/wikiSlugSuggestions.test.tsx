// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { MakeEmptySearchResultsRet, type GetSearchResultsInput, type SearchResultsRet } from "src/core/db3/shared/apiTypes";
import type { WikiPageSearchDto } from "src/core/db3/db3";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

const fetchMatches = vi.hoisted(() => vi.fn());
vi.mock("src/core/components/search/SearchBase", () => ({ fetchSearchResultsApi: fetchMatches }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => dashboard }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue,
}) }));
import { WikiSlugInputWithSearch } from "src/core/components/wiki/WikiSlugInputWithSearch";

const band = parsePublicId<"Band">("WikiSearchBand01");
const otherBand = parsePublicId<"Band">("WikiSearchBand02");
const dashboard = { authorizationContext: { bandPublicId: band }, localePreferences: { routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] } };
const result = (slug: string | null): SearchResultsRet<WikiPageSearchDto> => ({
    ...MakeEmptySearchResultsRet(), rowCount: slug === null ? 0 : 1,
    results: slug === null ? [] : [{ publicId: parsePublicId<"WikiPage">("WikiSearchPage01"), slug }],
});
let root: Root;
let container: HTMLDivElement;
let pending: Array<{ input: GetSearchResultsInput; signal: AbortSignal; resolve: (value: SearchResultsRet<WikiPageSearchDto>) => void; reject: (error: Error) => void }>;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    dashboard.authorizationContext.bandPublicId = band;
    dashboard.localePreferences = { routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] };
    pending = [];
    fetchMatches.mockReset().mockImplementation((input: GetSearchResultsInput, signal: AbortSignal) => new Promise((resolve, reject) => pending.push({ input, signal, resolve, reject })));
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(value: string, allowSearch = true, onChange = vi.fn()) {
    await act(async () => root.render(<WikiSlugInputWithSearch value={value} allowSearch={allowSearch} onChange={onChange} aria-label="Wiki page slug" />));
}

describe("original menu Wiki slug preview", () => {
    it("shows an exact-match confirmation or the original best match, using scoped named search and public DTOs", async () => {
        await render("handbook");
        expect(pending[0]!.input).toMatchObject({ tableID: "WikiPage", viewID: "WikiPage_Search", bandPublicId: band,
            routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], offset: 0, take: 1, quickFilter: "handbook", sort: [{ db3Column: "slug", direction: "asc" }] });
        await act(async () => pending[0]!.resolve(result("handbook")));
        expect(container.querySelector(".searchableValueResult")!.textContent).toBe("✅");
        await render("hand");
        expect(container.textContent).not.toContain("✅");
        await act(async () => pending[1]!.resolve(result("handbook")));
        expect(container.querySelector(".existingMatchValue")!.textContent).toBe("handbook");
        expect(container.textContent).toContain("No matching existing page found; best match:");
    });
    it("leaves arbitrary authored slugs editable, including no-match and validation-disabled requests", async () => {
        const change = vi.fn();
        await render("new-page", true, change);
        await act(async () => pending[0]!.resolve(result(null)));
        expect(container.querySelector(".existingMatchValue")!.textContent).toBe("");
        const input = container.querySelector("input")!;
        input.value = "typed-page";
        await act(async () => Simulate.change(input));
        expect(change).toHaveBeenCalledWith(expect.anything(), "typed-page");
        await render("invalid slug", false);
        expect(pending).toHaveLength(1);
        expect(container.querySelector(".searchableValueResult")!.textContent).toBe("");
        await render("x");
        expect(pending).toHaveLength(1);
    });
    it("aborts stale keyword/band/preference results and clears confirmations immediately", async () => {
        await render("old-page");
        await render("new-page");
        expect(pending[0]!.signal.aborted).toBe(true);
        await act(async () => pending[1]!.resolve(result("new-page")));
        dashboard.authorizationContext.bandPublicId = otherBand;
        await render("new-page");
        expect(container.textContent).not.toContain("✅");
        expect(pending[2]!.input.bandPublicId).toBe(otherBand);
        dashboard.localePreferences.browserLanguages = ["en-US", "nl-BE"];
        await render("new-page");
        expect(pending[2]!.signal.aborted).toBe(true);
        expect(pending[3]!.input.browserLanguages).toEqual(["en-US", "nl-BE"]);
        await act(async () => pending[3]!.resolve(result("fresh-best")));
        await act(async () => { pending[0]!.resolve(result("old-page")); pending[2]!.resolve(result("new-page")); });
        expect(container.querySelector(".existingMatchValue")!.textContent).toBe("fresh-best");
    });
    it("clears revoked/failed lookup results while retaining the current text, and aborts on unmount", async () => {
        await render("handbook");
        await act(async () => pending[0]!.resolve(result("handbook")));
        await render("handbook2");
        await act(async () => pending[1]!.reject(new Error("Revoked")));
        expect(container.querySelector("input")!.value).toBe("handbook2");
        expect(container.querySelector(".searchableValueResult")!.textContent).toBe("");
        await render("another-page");
        await act(async () => root.render(null));
        expect(pending[2]!.signal.aborted).toBe(true);
    });
});
