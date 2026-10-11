// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@blitzjs/rpc";
import { parsePublicId } from "shared/publicId";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { FeatureReportTopLevelDateSelector } from "src/core/components/featureReports/TopLevelDateSelection";
import type { GeneralFeatureReportBucket, GeneralFeatureReportInput, GeneralFeatureReportResult } from "src/core/components/featureReports/activityReportTypes";

vi.mock("@blitzjs/rpc", () => ({ invoke: vi.fn() }));
vi.mock("src/core/components/featureReports/queries/getGeneralFeatureReport", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    formattingLocale: "fr-BE", getPlainString: (key: string) => key,
}) }));
// Only the chart library is replaced: requests, state and mounted report feedback remain real.
vi.mock("recharts", () => ({
    ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    ComposedChart: ({ children, data }: React.PropsWithChildren<{ data: GeneralFeatureReportBucket[] }>) =>
        <div data-chart={JSON.stringify(data)}>{children}</div>,
    Bar: ({ onClick, name }: { onClick: (bucket: GeneralFeatureReportBucket) => void; name: string }) =>
        <button onClick={() => onClick({ bucket: "2026-01-01", count: 1 })}>{name}</button>,
    CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

function pendingReport() {
    let resolve!: (value: GeneralFeatureReportResult) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<GeneralFeatureReportResult>((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
}
const input: GeneralFeatureReportInput = {
    bandPublicId: parsePublicId<"Band">("ActivityBand0001"), startDate: new Date("2026-01-01"), endDateExclusive: new Date("2026-02-01"),
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.day, excludeYourself: true, excludeSysadmins: true,
        contextBeginsWith: null, includeFeatures: [], excludeFeatures: [] },
};
const result = (count: number): GeneralFeatureReportResult => ({ data: [{ bucket: "2026-01-01", count }],
    timeZone: "Europe/Brussels", metrics: { queryTimeMs: 1 } });
let root: Root;
let container: HTMLDivElement;
const updated = vi.fn();
const clicked = vi.fn();
async function render(args = input, refetchTrigger = 0, selectedBucket: string | null = null) {
    await act(async () => root.render(<FeatureReportTopLevelDateSelector input={args} selectedBucket={selectedBucket}
        onClickBucket={clicked} setDataUpdatedAt={updated} refetchTrigger={refetchTrigger} />));
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

describe("mounted activity timeline lifecycle", () => {
    it("passes explicit context, formats counts and highlights a selected bucket without refetching", async () => {
        vi.mocked(invoke).mockResolvedValue(result(1234));
        await render();
        expect(vi.mocked(invoke).mock.calls[0]?.[1]).toEqual(input);
        expect(container.textContent).toContain((1234).toLocaleString("fr-BE"));
        expect(updated).toHaveBeenCalledOnce();
        await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
        expect(clicked).toHaveBeenCalledWith("2026-01-01");
        await render(input, 0, "2026-01-01");
        expect(container.querySelector("[data-chart]")!.getAttribute("data-chart")).toContain("#cc8");
        expect(invoke).toHaveBeenCalledOnce();
    });
    it("hides old counts immediately on a filter change and discards its late response", async () => {
        const old = pendingReport(), current = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        await render();
        await render({ ...input, filterSpec: { ...input.filterSpec, contextBeginsWith: "new" } });
        await act(async () => old.resolve(result(99)));
        expect(container.querySelector("[data-activity-timeline]")).toBeNull();
        expect(updated).not.toHaveBeenCalled();
        await act(async () => current.resolve(result(2)));
        expect(container.querySelector("[data-activity-total]")!.getAttribute("data-activity-total")).toBe("2");
    });
    it("does not display an old band or apply its late failure to the new band", async () => {
        const old = pendingReport(), current = pendingReport();
        vi.mocked(invoke).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
        await render();
        const other = { ...input, bandPublicId: parsePublicId<"Band">("ActivityBand0002") };
        await render(other);
        await act(async () => current.resolve(result(3)));
        await act(async () => old.reject(new Error("Old band denied")));
        expect(container.querySelector("[role=alert]")).toBeNull();
        expect(container.querySelector("[data-activity-total]")!.getAttribute("data-activity-total")).toBe("3");
        expect(updated).toHaveBeenCalledOnce();
    });
    it("removes the previous chart on refresh, reports revoked access and retries after a new refresh", async () => {
        const refreshed = pendingReport();
        vi.mocked(invoke).mockResolvedValueOnce(result(4)).mockReturnValueOnce(refreshed.promise).mockResolvedValueOnce(result(5));
        await render();
        await render(input, 1);
        expect(container.querySelector("[data-activity-timeline]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Not authorized")));
        expect(container.querySelector("[role=alert]")!.textContent).toContain("activityReports.failed");
        await render(input, 2);
        expect(container.querySelector("[role=alert]")).toBeNull();
        expect(container.querySelector("[data-activity-total]")!.getAttribute("data-activity-total")).toBe("5");
    });
    it("does not update after unmount", async () => {
        const pending = pendingReport();
        vi.mocked(invoke).mockReturnValue(pending.promise);
        await render();
        await act(async () => root.render(null));
        await act(async () => pending.resolve(result(100)));
        expect(updated).not.toHaveBeenCalled();
        expect(container.textContent).toBe("");
    });
    it("renders a successful empty report as zero activity", async () => {
        vi.mocked(invoke).mockResolvedValue({ ...result(0), data: [] });
        await render();
        expect(container.querySelector("[data-activity-total]")!.getAttribute("data-activity-total")).toBe("0");
        expect(container.querySelector("[data-chart]")!.getAttribute("data-chart")).toBe("[]");
    });

    it("hides loaded counts during a presentation refresh with unchanged serialized inputs", async () => {
        const refreshed = pendingReport();
        vi.mocked(invoke).mockResolvedValueOnce(result(4)).mockReturnValueOnce(refreshed.promise);
        await render();
        await render({ ...input });
        expect(container.querySelector("[data-activity-total]")).toBeNull();
        await act(async () => refreshed.reject(new Error("Fresh grants rejected")));
        expect(container.querySelector("[role=alert]")).not.toBeNull();
    });
});
