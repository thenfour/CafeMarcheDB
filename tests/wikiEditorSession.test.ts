// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("db", async () => await vi.importActual<any>("@prisma/client"));
vi.mock("@blitzjs/rpc", () => ({ useQuery: vi.fn(), useMutation: (mutation: any) => [mutation, { isLoading: false }] }));
vi.mock("src/core/wiki/mutations/acquireLockOnWikiPage", () => ({ default: vi.fn() }));
vi.mock("src/core/wiki/mutations/updateWikiPage", () => ({ default: vi.fn() }));
vi.mock("src/core/wiki/mutations/wikiReleaseYourLock", () => ({ default: vi.fn() }));
vi.mock("src/core/wiki/mutations/wikiRenewYourLock", () => ({ default: vi.fn() }));
vi.mock("src/core/wiki/mutations/wikiAdminClearLock", () => ({ default: vi.fn() }));
vi.mock("src/core/wiki/queries/getWikiPage", () => ({ default: vi.fn() }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ currentUser: { id: 1 }, getDefaultVisibilityPermission: () => ({ id: 1 }) }),
    useFeatureRecorder: () => vi.fn(),
}));
vi.mock("src/core/components/MessageBoxContext", () => ({ useMessageBox: () => ({ showMessage: vi.fn().mockResolvedValue("cancel") }) }));
import { useQuery } from "@blitzjs/rpc";
import acquire from "src/core/wiki/mutations/acquireLockOnWikiPage";
import save from "src/core/wiki/mutations/updateWikiPage";
import release from "src/core/wiki/mutations/wikiReleaseYourLock";
import { useWikiPageApi, WikiPageApi } from "src/core/components/markdown/useWikiPageApi";
let api: WikiPageApi;
let root: Root;
const page = (version: number) => ({ id: 1, slug: "test", contentVersion: version, visiblePermissionId: 1,
    currentRevision: { id: 9, content: "Saved " + version, name: "Title" } });
const refetch = vi.fn();
function Harness() { api = useWikiPageApi({ canonicalWikiPath: "test" }); return null; }
const render = async () => { await act(async () => root.render(React.createElement(Harness))); };
const poll = (version: number) => vi.mocked(useQuery).mockImplementation((_query, args: any) => [
    { wikiPage: page(version), lockStatus: { isRevisionConflict: version !== args.baseContentVersion } },
    { refetch, isFetching: false },
] as any);
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.innerHTML = "<div id='root'></div>";
    root = createRoot(document.getElementById("root")!);
    poll(5);
    vi.mocked(acquire).mockResolvedValue({ outcome: "success", currentPage: page(5) } as any);
    vi.mocked(save).mockResolvedValue({ outcome: "success", currentPage: page(6) } as any);
    vi.mocked(release).mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => root.unmount()); Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT"); });
describe("wiki editor draft base", () => {
    it("saves against the draft version even after polling newer content with the same revision ID", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        poll(6); await render();
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "My draft" } }); });
        expect(vi.mocked(save).mock.calls[0]![0]).toMatchObject({ baseContentVersion: 5, baseRevisionId: 9, content: "My draft" });
        expect(api.basePage?.contentVersion).toBe(6);
    });
    it("keeps the original base after a rejected save and uses it for reacquisition", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        poll(6); await render();
        vi.mocked(save).mockResolvedValue({ outcome: "revisionConflict", currentPage: page(6) } as any);
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "My draft" } }); });
        expect(api.basePage?.contentVersion).toBe(5);
        await act(async () => { await api.reacquireLock(); });
        expect((vi.mocked(acquire).mock.calls[1]![0] as any).baseContentVersion).toBe(5);
    });
    it("acknowledges only the reviewed snapshot even if polling has advanced", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        const reviewed = page(6);
        poll(7); await render();
        await act(async () => { api.acceptLatestAsBase(reviewed as any); });
        expect(api.basePage?.contentVersion).toBe(6);
    });
    it("releases the current editor token on unmount", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        const lockId = api.yourLockId;
        await act(async () => root.render(null));
        expect(release).toHaveBeenCalledWith({ canonicalWikiPath: "test", lockId });
        expect(lockId).toBeTruthy();
    });
    it("retains the base after a network failure and permits retry", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        vi.mocked(save).mockRejectedValueOnce(new Error("offline"));
        await act(async () => { await expect(api.saveProgress({ revisionData: { name: "Title", content: "Draft" } })).rejects.toThrow("offline"); });
        expect(api.basePage?.contentVersion).toBe(5);
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "Draft" } }); });
        expect(save).toHaveBeenCalledTimes(2);
    });
});


describe("save and polling reconciliation", () => {
    it("does not flash a conflict when polling sees our save before its response", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        let completeSave!: (result: any) => void;
        vi.mocked(save).mockImplementationOnce(() => new Promise<Awaited<ReturnType<WikiPageApi["saveProgress"]>>>(resolve => { completeSave = resolve; }));
        let saving!: ReturnType<WikiPageApi["saveProgress"]>;
        await act(async () => { saving = api.saveProgress({ revisionData: { name: "Title", content: "Draft" } }); });
        poll(6); await render();
        expect(api.lockStatus.isRevisionConflict).toBe(false);
        await act(async () => { completeSave({ outcome: "success", currentPage: page(6) }); await saving; });
        expect(api.lockStatus.isRevisionConflict).toBe(false);
    });
    it("uses the successful save while polling still has older content", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "Draft" } }); });
        expect(api.currentPageData?.wikiPage?.contentVersion).toBe(6);
        expect(api.coalescedCurrentPageData.content).toBe("Saved 6");
        expect(api.lockStatus.isRevisionConflict).toBe(false);
        poll(5); await render();
        expect(api.currentPageData?.wikiPage?.contentVersion).toBe(6);
    });
    it("discards a conflict computed against the old base but detects subsequent remote edits", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "Draft" } }); });
        vi.mocked(useQuery).mockReturnValue([
            { wikiPage: page(6), lockStatus: { isRevisionConflict: true, outcome: "revisionConflict" } },
            { refetch, isFetching: false },
        ] as any);
        await render();
        expect(api.lockStatus.isRevisionConflict).toBe(false);
        expect(api.lockStatus.outcome).toBe("success");
        poll(7); await render();
        expect(api.lockStatus.isRevisionConflict).toBe(true);
        expect(api.basePage?.contentVersion).toBe(6);
    });
    it("shows the real conflict when the pending save fails", async () => {
        await render();
        await act(async () => { await api.beginEditing(); });
        vi.mocked(save).mockResolvedValueOnce({ outcome: "revisionConflict", currentPage: page(6) } as any);
        poll(6); await render();
        await act(async () => { await api.saveProgress({ revisionData: { name: "Title", content: "Draft" } }); });
        expect(api.lockStatus.isRevisionConflict).toBe(true);
        expect(api.basePage?.contentVersion).toBe(5);
    });
});
