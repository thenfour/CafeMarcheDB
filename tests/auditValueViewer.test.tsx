// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import type { AuditDetail, AuditReference } from "src/core/db3/shared/audit/auditContracts";
import type { AuditValue } from "src/core/db3/shared/audit/auditSnapshot";

const clipboard = vi.fn();
const showMessage = vi.fn();
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"), useQuery: () => [detail, {}] }));
vi.mock("src/core/db3/queries/getAdminLogItemInfo", () => ({ default: vi.fn() }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({}) }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: { markdown: string }) => <article>{markdown}</article> }));

import { AuditJSONCell, AuditRecordCell } from "src/core/db3/components/DB3JSONStringColumnClient";
import { AuditReferenceChip, AuditSnapshotViewer } from "src/core/db3/components/audit/AuditValueViewer";

const reference: AuditReference = { publicId: "AuditSong0000001", label: "Current song", bandPublicId: "AuditBand0000001", href: "/backstage/song/AuditSong0000001?bandPublicId=AuditBand0000001&routeLocale=fr-BE", deleted: false };
let detail: AuditDetail;
let root: Root;
let container: HTMLDivElement;
let clipboardDescriptor: PropertyDescriptor | undefined;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    clipboard.mockReset();
    showMessage.mockReset();
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboard.mockResolvedValue(undefined) } });
    detail = { user: null, record: reference, related: [], oldValues: null, newValues: { id: 987, songId: 42, publicId: reference.publicId, description: "**Historical Markdown**", hashedPassword: "historical-password-hash" } };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
        Reflect.deleteProperty(navigator, "clipboard");
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLElement>("button")].find(node => node.getAttribute("aria-label") === label || node.textContent === label)!;
    await act(async () => button.click());
}
describe("historical audit viewer", () => {
    it("displays, copies and logs unredacted JSON, expands it, and previews Markdown", async () => {
        const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
        await act(async () => root.render(<AuditJSONCell changeId={1} tableName="Event" member="newValues" />));
        expect(container.textContent).toContain("987");
        expect(container.textContent).toContain("42");
        expect(container.textContent).toContain(reference.publicId);
        expect(container.textContent).toContain("historical-password-hash");
        await click("Copy JSON");
        expect(JSON.parse(clipboard.mock.calls[0]![0])).toEqual(detail.newValues);
        await click("Dump to console");
        expect(consoleLog).toHaveBeenCalledWith(detail.newValues);
        await click("Expand JSON");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("historical-password-hash");
        await click("Close");
        await click("Preview Markdown");
        expect(document.querySelector('[role="dialog"] article')?.textContent).toBe("**Historical Markdown**");
    });
    it.each(["v1", "v2"])("retains %s setlist song order, comments and stored song IDs", async version => {
        const song = { id: 987, songId: 42, sortOrder: 2, subtitle: "Encore" };
        const value: AuditValue = version === "v1" ? [song] : { songs: [song], dividers: [{ sortOrder: 1, subtitle: "Break", isInterruption: true, color: "red" }], name: "Historical list" };
        await act(async () => root.render(<AuditSnapshotViewer tableName="EventSongList" value={value} />));
        const rows = [...container.querySelectorAll("tbody tr")].filter(row => row.closest("[data-audit-setlist]"));
        expect(rows.at(-1)?.textContent).toContain("Encore");
        if (version === "v2") {
            expect(rows[0]?.textContent).toContain("Break");
        }
        expect(rows.at(-1)?.textContent).toContain("42");
    });
    it("shows a stored record ID even when its current target is unavailable", async () => {
        detail.record = null;
        await act(async () => root.render(<AuditRecordCell changeId={1} recordId={987} />));
        expect(container.textContent).toBe("987");
    });
    it("keeps deleted labels without a navigation link", async () => {
        await act(async () => root.render(<AuditReferenceChip reference={{ ...reference, href: null, deleted: true }} />));
        expect(container.textContent).toContain("Current song");
        expect(container.textContent).toContain("Deleted reference");
        expect(container.querySelector("a")).toBeNull();
    });
});
