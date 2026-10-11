// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@blitzjs/rpc";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { FacetedBreakdown } from "src/core/components/featureReports/FacetedBreakdown";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import type { FacetedBreakdownInput, FacetedBreakdownResult } from "src/core/components/featureReports/activityReportTypes";

vi.mock("@blitzjs/rpc", () => ({ invoke: vi.fn() }));
vi.mock("src/core/components/featureReports/queries/getFacetedBreakdown", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ formattingLocale: "fr-BE", getPlainString: (key: string) => key }) }));
// Unused shared-control providers do not need to load the dashboard's unrelated RPCs.
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: {}, gCharMap: {} }));
// Keep the report and its real shared controls mounted; only chart rendering is replaced.
vi.mock("recharts", () => ({ PieChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>, Pie: () => null, Tooltip: () => null }));

const input: FacetedBreakdownInput = {
    bandPublicId: parsePublicId<"Band">("ActivityBand0001"), routeLocale: "fr-BE",
    startDate: new Date("2026-01-01"), endDateExclusive: new Date("2026-02-01"), selectedBucket: "2026-01-01",
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        contextBeginsWith: null, includeFeatures: [], excludeFeatures: [] }, facetFilters: emptyActivityFacetFilters(),
};
function result(count: number): FacetedBreakdownResult {
    return { total: { count }, timeZone: "Europe/Brussels", metrics: { queryTimeMs: 1 }, facets: {
        features: count ? [{ key: "event_view", label: "event_view", count: count - 1 }, { key: "profile_view", label: "profile_view", count: 1 }] : [],
        contexts: [], operatingSystems: [], pointerTypes: [], browsers: [], deviceClasses: [], languages: [], locales: [], timezones: [],
        screenSizes: [], users: [], songs: [], events: [], wikiPages: [], menuLinks: [], customLinks: [],
    } };
}
function pendingReport() {
    let resolve!: (value: FacetedBreakdownResult) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<FacetedBreakdownResult>((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
}
let root: Root;
let container: HTMLDivElement;
const changed = vi.fn();
async function render(args = input, refetchTrigger = 0) {
    await act(async () => root.render(<FacetedBreakdown input={args} refetchTrigger={refetchTrigger} onChangeFilters={changed} />));
}
async function clickButton(label: string, parent: HTMLElement = container) {
    const button = [...parent.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes(label));
    expect(button).toBeDefined();
    await act(async () => button!.click());
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("mounted activity facet lifecycle", () => {
    it("passes explicit context and restores distributions, count sorting and isolate/hide controls", async () => {
        vi.mocked(invoke).mockResolvedValue(result(5));
        await render();
        expect(vi.mocked(invoke).mock.calls[0]?.[1]).toEqual(input);
        expect(container.querySelector("[data-activity-facet-total]")!.getAttribute("data-activity-facet-total")).toBe("5");
        const section = container.querySelector<HTMLElement>("[data-facet-key=features]")!;
        expect(section.querySelector("tbody tr")!.getAttribute("data-facet-item")).toBe("event_view");
        await clickButton("activityReports.leastFirst", section);
        expect(section.querySelector("tbody tr")!.getAttribute("data-facet-item")).toBe("profile_view");
        await clickButton("activityReports.isolate", section);
        expect(changed).toHaveBeenLastCalledWith({ timeline: { ...input.filterSpec, includeFeatures: ["profile_view"], excludeFeatures: [] }, facets: input.facetFilters });
        await clickButton("activityReports.hide", section);
        expect(changed).toHaveBeenLastCalledWith({ timeline: { ...input.filterSpec, excludeFeatures: ["profile_view"] }, facets: input.facetFilters });
        expect(invoke).toHaveBeenCalledOnce();
    });

    const contexts: Array<[string, Partial<FacetedBreakdownInput>]> = [
        ["band", { bandPublicId: parsePublicId<"Band">("ActivityBand0002") }],
        ["locale", { routeLocale: "nl-BE" }], ["bucket", { selectedBucket: "2026-01-02" }],
        ["filter", { facetFilters: { ...input.facetFilters, includeBrowserNames: ["chrome"] } }],
    ];
    it.each(contexts)("removes stale %s data and ignores late replies", async (_name, overrides) => {
        const old = pendingReport(), current = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        await render();
        await render({ ...input, ...overrides });
        expect(container.querySelector("[data-activity-facet-total]")).toBeNull();
        await act(async () => current.resolve(result(3)));
        await act(async () => old.resolve(result(99)));
        expect(container.querySelector("[data-activity-facet-total]")!.getAttribute("data-activity-facet-total")).toBe("3");
    });

    it("hides a revoked report, keeps filter removal available and retries on Refresh", async () => {
        const refreshed = pendingReport();
        const filtered = { ...input, facetFilters: { ...input.facetFilters, includeBrowserNames: ["chrome"], excludeBrowserNames: ["firefox"] } };
        vi.mocked(invoke).mockResolvedValueOnce(result(4)).mockReturnValueOnce(refreshed.promise).mockResolvedValueOnce(result(5));
        await render(filtered);
        await render(filtered, 1);
        expect(container.querySelector("[data-activity-facet-total]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Not authorized")));
        expect(container.querySelector("[role=alert]")!.textContent).toContain("activityReports.failed");
        await clickButton("activityReports.included: chrome");
        expect(changed.mock.lastCall?.[0].facets.includeBrowserNames).toEqual([]);
        expect(changed.mock.lastCall?.[0].facets.excludeBrowserNames).toEqual(["firefox"]);
        await clickButton("activityReports.clearFilters");
        expect(changed.mock.lastCall?.[0].facets).toEqual(input.facetFilters);
        await render(filtered, 2);
        expect(container.querySelector("[role=alert]")).toBeNull();
        expect(container.querySelector("[data-activity-facet-total]")!.getAttribute("data-activity-facet-total")).toBe("5");
    });

    it("renders an empty selection without percentages or invented facet entries", async () => {
        vi.mocked(invoke).mockResolvedValue(result(0));
        await render();
        expect(container.querySelector("[data-activity-facet-total]")!.getAttribute("data-activity-facet-total")).toBe("0");
        expect(container.querySelector("[data-facet-item]")).toBeNull();
        expect(container.textContent).not.toContain("NaN");
    });

    it("hides loaded references during a presentation refresh with unchanged serialized inputs", async () => {
        const refreshed = pendingReport();
        vi.mocked(invoke).mockResolvedValueOnce(result(4)).mockReturnValueOnce(refreshed.promise);
        await render();
        await render({ ...input });
        expect(container.querySelector("[data-activity-facet-total]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Fresh grants rejected")));
        expect(container.querySelector("[role=alert]")).not.toBeNull();
    });

    it("ignores a failed old request after switching and replies after unmount", async () => {
        const old = pendingReport(), current = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        await render();
        await render({ ...input, selectedBucket: "2026-01-02" });
        await act(async () => current.resolve(result(3)));
        await act(async () => old.reject(new Error("Old selection denied")));
        expect(container.querySelector("[role=alert]")).toBeNull();
        const pending = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(pending.promise);
        await render(input, 1);
        await act(async () => root.render(null));
        await act(async () => pending.resolve(result(100)));
        expect(container.textContent).toBe("");
    });
});
