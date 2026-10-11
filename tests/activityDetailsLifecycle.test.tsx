// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@blitzjs/rpc";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { FacetItemDetailTable } from "src/core/components/featureReports/FacetItemDetailTable";
import { FacetedBreakdown } from "src/core/components/featureReports/FacetedBreakdown";
import getDetail from "src/core/components/featureReports/queries/getDetail";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import type { ActivityDetailInput, ActivityDetailResult, ActivityDetailRow, FacetedBreakdownResult } from "src/core/components/featureReports/activityReportTypes";

vi.mock("@blitzjs/rpc", () => ({ invoke: vi.fn() }));
vi.mock("src/core/components/featureReports/queries/getDetail", () => ({ default: vi.fn() }));
vi.mock("src/core/components/featureReports/queries/getFacetedBreakdown", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ formattingLocale: "fr-BE", getPlainString: (key: string) => key }) }));
// Keep the real detail table, chips and buttons. Unrelated dashboard RPCs and chart rendering are outside this lifecycle.
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: { Search: () => <svg />, VisibilityOff: () => <svg /> }, gCharMap: {} }));
vi.mock("src/core/components/song/SongChip", () => ({ SongChip: ({ value }: { value: { name: string } }) => <span>{value.name}</span> }));
vi.mock("src/core/components/event/EventChips", () => ({ EventChip: ({ value, showDate }: { value: { name: string }; showDate: boolean }) => <span data-event-show-date={showDate}>{value.name}</span> }));
vi.mock("src/core/components/wiki/WikiPageChip", () => ({ WikiPageChip: ({ slug }: { slug: string }) => <span>{slug}</span> }));
vi.mock("recharts", () => ({ PieChart: ({ children }: React.PropsWithChildren) => <div>{children}</div>, Pie: () => null, Tooltip: () => null }));
// jsdom has no Canvas context; the built browser verifies identicon rendering.
vi.mock("react-identicons", () => ({ default: () => <span data-identicon /> }));

const input: ActivityDetailInput = { bandPublicId: parsePublicId<"Band">("ActivityBand0001"), routeLocale: "fr-BE",
    startDate: new Date("2026-01-01"), endDateExclusive: new Date("2026-02-01"), selectedBucket: "2026-01-01",
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        contextBeginsWith: "App/profile/", includeFeatures: [], excludeFeatures: [] },
    facetFilters: { ...emptyActivityFacetFilters(), excludeBrowserNames: ["firefox"] }, detail: { facet: "total" } };
const personToken = "a".repeat(64);
function row(feature: string, userHash: string | null = personToken): ActivityDetailRow {
    return { rowKey: feature, createdAt: new Date("2026-01-01T23:15:00Z"), userHash, feature, context: "App/profile/", isClient: true,
        pointerType: "mouse", screenWidth: 1920, screenHeight: 1080, deviceClass: "desktop", browserName: "chrome", operatingSystem: "windows",
        language: "fr", locale: "fr-be", timezone: "Europe/Brussels", song: { publicId: parsePublicId<"Song">("ActivitySong0001"), name: "Visible song" },
        event: null, wikiPage: null, menuLink: { publicId: parsePublicId<"MenuLink">("ActivityMenu0001"), caption: "Navigation française" }, customLink: null };
}
function result(feature = "profile_view", total = 1): ActivityDetailResult {
    return { rows: total ? [row(feature)] : [], timeZone: "Europe/Brussels", rowLimit: 200, metrics: { totalRowCount: total, queryTimeMs: 1 } };
}
function pendingReport() {
    let resolve!: (value: ActivityDetailResult) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<ActivityDetailResult>((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
}
let root: Root, container: HTMLDivElement;
const changed = vi.fn();
async function render(args = input, refetchTrigger = 0) {
    await act(async () => root.render(<FacetItemDetailTable input={args} refetchTrigger={refetchTrigger} onChangeFilters={changed} />));
}
async function clickButton(label: string) {
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
}
async function clickTab(label: string) {
    const tab = [...container.querySelectorAll<HTMLElement>(".CMTabHeaderTitle")].find(tab => tab.textContent?.startsWith(label));
    expect(tab).toBeDefined();
    await act(async () => tab!.click());
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

describe("mounted activity detail lifecycle", () => {
    it("renders authorized references, anonymous tokens and timestamps in the trusted band zone", async () => {
        vi.mocked(invoke).mockResolvedValue({ ...result(), rows: [row("profile_view"), row("event_view", null)] });
        await render();
        expect(vi.mocked(invoke).mock.calls[0]).toEqual([getDetail, input]);
        expect(container.querySelectorAll("[data-activity-row]")).toHaveLength(2);
        expect(container.querySelector("time")!.textContent).toContain("02/01/2026");
        expect(container.querySelector("time")!.textContent).toMatch(/00(?::| h )15(?::| min )00/);
        expect(container.querySelector("time")!.textContent).toContain("+01:00");
        expect(container.querySelector("[data-activity-person]")!.getAttribute("data-activity-person")).toBe(personToken);
        expect(container.textContent).toContain("activityReports.anonymous");
        expect(container.textContent).toContain("Visible song");
        expect(container.textContent).toContain("Navigation française");
        await clickButton("chrome");
        expect(changed.mock.lastCall?.[0]).toEqual({ timeline: input.filterSpec, facets: { ...input.facetFilters, includeBrowserNames: ["chrome"], excludeBrowserNames: [] } });
        await clickButton("App/profile/");
        expect(changed.mock.lastCall?.[0].timeline.contextBeginsWith).toBe("App/profile/");
        const songAction = container.querySelector<HTMLButtonElement>('[data-activity-reference=songs] button')!;
        await act(async () => songAction.click());
        expect(changed.mock.lastCall?.[0].facets.includeSongIds).toEqual([parsePublicId<"Song">("ActivitySong0001")]);
    });

    const contexts: Array<[string, Partial<ActivityDetailInput>]> = [
        ["band", { bandPublicId: parsePublicId<"Band">("ActivityBand0002") }], ["locale", { routeLocale: "nl-BE" }],
        ["bucket", { selectedBucket: "2026-01-02" }], ["filter", { facetFilters: emptyActivityFacetFilters() }],
        ["drill-down", { detail: { facet: "browsers", key: "chrome" } }],
    ];
    it.each(contexts)("hides old %s rows and ignores a late response", async (_name, overrides) => {
        const old = pendingReport(), current = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        await render();
        await render({ ...input, ...overrides });
        expect(container.querySelector("[data-activity-row]")).toBeNull();
        await act(async () => current.resolve(result("current-row")));
        await act(async () => old.resolve(result("old-row")));
        expect(container.querySelector("[data-activity-row]")!.getAttribute("data-activity-row")).toBe("current-row");
        expect(container.textContent).not.toContain("old-row");
    });

    it("clears a revoked ledger during Refresh and permits a subsequent retry", async () => {
        const refreshed = pendingReport();
        vi.mocked(invoke).mockResolvedValueOnce(result()).mockReturnValueOnce(refreshed.promise).mockResolvedValueOnce(result("restored-row"));
        await render();
        await render(input, 1);
        expect(container.querySelector("[data-activity-row]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Fresh report permission denied")));
        expect(container.querySelector("[role=alert]")!.textContent).toContain("activityReports.failed");
        await render(input, 2);
        expect(container.querySelector("[role=alert]")).toBeNull();
        expect(container.querySelector("[data-activity-row]")!.getAttribute("data-activity-row")).toBe("restored-row");
    });

    it("clears rows on a presentation refresh even if serialized inputs are unchanged", async () => {
        const refreshed = pendingReport();
        vi.mocked(invoke).mockResolvedValueOnce(result()).mockReturnValueOnce(refreshed.promise);
        await render();
        await render({ ...input });
        expect(container.querySelector("[data-activity-row]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Reference authorization changed")));
        expect(container.querySelector("[role=alert]")).not.toBeNull();
    });

    it("shows a limit notice and an empty result without retaining old rows", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(result("capped", 205)).mockResolvedValueOnce(result("", 0));
        await render();
        expect(container.querySelector("[role=alert]")!.textContent).toContain("activityReports.rowLimit");
        await render(input, 1);
        expect(container.querySelector("table")).toBeNull();
        expect(container.textContent).toContain("activityReports.noFacetItems");
    });

    it("presents Event reference dates in the report zone and disables the chip's implicit browser date", async () => {
        const event = { publicId: parsePublicId<"Event">("ActivityEvent001"), name: "Visible event", startsAt: new Date("2026-01-01T23:30:00Z"), statusId: null, typeId: null };
        vi.mocked(invoke).mockResolvedValue({ ...result(), rows: [{ ...row("event_view"), event }] });
        await render();
        expect(container.querySelector("[data-event-show-date]")!.getAttribute("data-event-show-date")).toBe("false");
        const date = container.querySelector("[data-activity-reference=events] time")!;
        expect(date.textContent).toBe("02/01/2026");
        expect(date.getAttribute("title")).toBe("Europe/Brussels");
    });

    it("ignores late failures after switching and responses after unmount", async () => {
        const old = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockResolvedValueOnce(result("current"));
        await render();
        await render(input, 1);
        await act(async () => old.reject(new Error("Old request denied")));
        expect(container.querySelector("[role=alert]")).toBeNull();
        const pending = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(pending.promise);
        await render(input, 2);
        await act(async () => root.render(null));
        await act(async () => pending.resolve(result("unmounted")));
        expect(container.textContent).toBe("");
    });

    it("defaults to the real ledger and lazily opens a per-facet detail without changing the parent selection", async () => {
        const facets: FacetedBreakdownResult = { total: { count: 1 }, timeZone: "Europe/Brussels", metrics: { queryTimeMs: 1 },
            references: { songs: [], events: [], wikiPages: [], menuLinks: [], customLinks: [] }, facets: {
                features: [{ key: "profile_view", label: "profile_view", count: 1 }], contexts: [], operatingSystems: [], pointerTypes: [],
                browsers: [], deviceClasses: [], languages: [], locales: [], timezones: [], screenSizes: [], users: [], songs: [], events: [], wikiPages: [], menuLinks: [], customLinks: [] } };
        vi.mocked(invoke).mockImplementation(async endpoint => endpoint === getDetail ? result() : facets);
        const { detail: _detail, ...selection } = input;
        await act(async () => root.render(<FacetedBreakdown input={selection} refetchTrigger={3} onChangeFilters={changed} />));
        expect(container.querySelector("[data-activity-row]")).not.toBeNull();
        expect(invoke).toHaveBeenCalledTimes(2);
        await clickTab("activityReports.facet.features");
        expect(container.querySelector("[data-activity-row]")).toBeNull();
        expect(invoke).toHaveBeenCalledTimes(2);
        await clickButton("activityReports.details");
        expect([...container.querySelectorAll("button")].find(button => button.textContent === "activityReports.details")!.getAttribute("aria-expanded")).toBe("true");
        expect(vi.mocked(invoke).mock.lastCall).toEqual([getDetail, { ...selection, detail: { facet: "features", key: "profile_view" } }]);
        expect(container.querySelector("[data-activity-row]")).not.toBeNull();
        expect(changed).not.toHaveBeenCalled();
        await clickButton("activityReports.details");
        expect(container.querySelector("[data-activity-row]")).toBeNull();
        expect(invoke).toHaveBeenCalledTimes(3);
    });
});
