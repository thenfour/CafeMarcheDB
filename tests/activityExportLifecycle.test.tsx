// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@blitzjs/rpc";
import { parsePublicId } from "shared/publicId";
import type { CMDialogProps } from "src/core/components/CMDialog";
import { ExportButton } from "src/core/components/featureReports/ExportButton";
import type { ActivityCsvResult, FacetedBreakdownInput } from "src/core/components/featureReports/activityReportTypes";
import * as downloadHelpers from "src/core/components/featureReports/activityCsvDownload";
import { activityExportInput } from "./support/activityExportFixture";

vi.mock("@blitzjs/rpc", () => ({ invoke: vi.fn() }));
vi.mock("src/core/components/featureReports/queries/getDetailCsv", () => ({ default: vi.fn() }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: vi.fn() }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: string, parameters?: { shown?: number; total?: number; limit?: number }) =>
    parameters ? `${key}: ${JSON.stringify(parameters)}` : key }) }));
vi.mock("src/core/db3/components/IconMap", () => ({ gIconMap: {}, gCharMap: {} }));
// The built browser covers the responsive portal; keep its title, content and action contract here.
vi.mock("src/core/components/CMDialog", () => ({ CMDialog: (props: CMDialogProps) => props.open
    ? <section role="dialog" aria-label={props["aria-label"]}>{props.children}{props.actions}</section> : null }));
vi.mock("src/core/components/featureReports/activityCsvDownload", () => ({ downloadActivityCsv: vi.fn() }));

const response = (total = 2): ActivityCsvResult => ({ csvContent: '"id","feature"\r\n"public-token","été"\r\n',
    filename: "activity-export-band-all-2026-01-01T00-00-00.csv", rowCount: Math.min(total, 20000), rowLimit: 20000,
    timeZone: "Europe/Brussels", metrics: { totalRowCount: total, queryTimeMs: 1 } });
function pendingExport() {
    let resolve!: (value: ActivityCsvResult) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<ActivityCsvResult>((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
}
let root: Root, container: HTMLDivElement;
const invoked = vi.mocked(invoke), downloaded = vi.mocked(downloadHelpers.downloadActivityCsv);
async function render(input: FacetedBreakdownInput = activityExportInput, refetchTrigger = 0) {
    await act(async () => root.render(<ExportButton input={input} refetchTrigger={refetchTrigger} />));
}
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button!.click());
}

describe("activity export lifecycle", () => {
    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        invoked.mockReset();
        downloaded.mockReset();
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("waits for confirmation, exports the complete current selection and downloads once", async () => {
        invoked.mockResolvedValue(response());
        await render();
        await click("activityReports.export");
        expect(invoked).not.toHaveBeenCalled();
        expect(document.querySelector("[role=dialog]")?.textContent).toContain("activityReports.exportDescription");
        await click("activityReports.exportCsv");
        expect(invoked.mock.calls[0]![1]).toEqual(activityExportInput);
        expect(downloaded).toHaveBeenCalledOnce();
        expect(downloaded).toHaveBeenCalledWith(response());
        expect(document.body.textContent).toContain('activityReports.exported: {"shown":2,"total":2}');
        await click("activityReports.close");
        expect(document.querySelector("[role=dialog]")).toBeNull();
    });

    it("shows progress and prevents closing or duplicate exports during the pending read", async () => {
        const pending = pendingExport();
        invoked.mockReturnValue(pending.promise);
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        expect(document.querySelector("[role=status]")?.textContent).toContain("activityReports.exporting");
        const cancel = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "activityReports.cancel")!;
        expect(cancel.disabled).toBe(true);
        await click("activityReports.cancel");
        expect(document.querySelector("[role=dialog]")).not.toBeNull();
        expect(invoked).toHaveBeenCalledOnce();
        await act(async () => pending.resolve(response()));
    });

    it("reports the export cap and exact matching total", async () => {
        invoked.mockResolvedValue(response(20001));
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        expect(document.body.textContent).toContain('activityReports.exported: {"shown":20000,"total":20001}');
        expect(document.body.textContent).toContain('activityReports.exportTruncated: {"limit":20000}');
    });

    it("withholds failed reads, displays localized feedback and retries through fresh authority", async () => {
        invoked.mockRejectedValueOnce(new Error("private credentials from denied reader"));
        invoked.mockResolvedValueOnce(response());
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        expect(document.body.textContent).toContain("activityReports.exportFailed");
        expect(document.body.textContent).not.toContain("private credentials");
        expect(downloaded).not.toHaveBeenCalled();
        await click("activityReports.retryExport");
        expect(invoked).toHaveBeenCalledTimes(2);
        expect(downloaded).toHaveBeenCalledOnce();
    });

    it.each(["band", "filter", "refresh"])("discards a held export when the %s changes", async change => {
        const pending = pendingExport();
        invoked.mockReturnValue(pending.promise);
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        const next: FacetedBreakdownInput = change === "band" ? { ...activityExportInput, routeLocale: "nl-BE", bandPublicId: parsePublicId<"Band">("ActivityBand0002") }
            : change === "filter" ? { ...activityExportInput, facetFilters: { ...activityExportInput.facetFilters, includeBrowserNames: ["firefox"] } } : activityExportInput;
        await render(next, change === "refresh" ? 1 : 0);
        await act(async () => pending.resolve(response()));
        expect(downloaded).not.toHaveBeenCalled();
        expect(document.querySelector("[role=dialog]")).toBeNull();
    });

    it("discards a held reply when report denial unmounts the export control", async () => {
        const pending = pendingExport();
        invoked.mockReturnValue(pending.promise);
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        await act(async () => root.render(<div>denied</div>));
        await act(async () => pending.resolve(response()));
        expect(downloaded).not.toHaveBeenCalled();
        expect(document.body.textContent).toBe("denied");
    });

    it("discards a held rejection after a selection change", async () => {
        const pending = pendingExport();
        invoked.mockReturnValue(pending.promise);
        await render();
        await click("activityReports.export");
        await click("activityReports.exportCsv");
        await render(activityExportInput, 1);
        await act(async () => pending.reject(new Error("stale denial")));
        await click("activityReports.export");
        expect(document.body.textContent).toContain("activityReports.exportDescription");
        expect(document.body.textContent).not.toContain("activityReports.exportFailed");
    });

    it("downloads UTF-8 CSV through a temporary browser link and releases its object URL", async () => {
        const actual = await vi.importActual<typeof downloadHelpers>("src/core/components/featureReports/activityCsvDownload");
        const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL"), revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
        const created = vi.fn((blob: Blob) => blob.size > 0 ? "blob:activity-csv" : "blob:empty"), revoked = vi.fn();
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: created });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoked });
        const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe(response().filename);
            expect(this.href).toBe("blob:activity-csv");
            expect(document.body.contains(this)).toBe(true);
        });
        try {
            actual.downloadActivityCsv(response());
            expect(clicked).toHaveBeenCalledOnce();
            expect(revoked).toHaveBeenCalledWith("blob:activity-csv");
            expect(document.querySelector("a[download]")).toBeNull();
            const blob = created.mock.calls[0]![0];
            expect(blob.type).toBe("text/csv;charset=utf-8;");
            const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === "string" || reader.result === null ? reject(new Error("Unexpected CSV bytes")) : resolve(reader.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
            expect([...new Uint8Array(bytes).slice(0, 3)]).toEqual([239, 187, 191]);
            expect(new TextDecoder().decode(bytes)).toBe(response().csvContent);
        } finally {
            if (createDescriptor) {
                Object.defineProperty(URL, "createObjectURL", createDescriptor);
            } else {
                Reflect.deleteProperty(URL, "createObjectURL");
            }
            if (revokeDescriptor) {
                Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
            } else {
                Reflect.deleteProperty(URL, "revokeObjectURL");
            }
        }
    });
});
