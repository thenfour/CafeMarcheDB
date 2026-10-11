// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarkdownIt from "markdown-it";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { CMDBUploadFilesArgs } from "src/core/components/file/CMDBUploadFile";
import type { TClientUploadFileArgs, UploadResponsePayload, UploadedFile } from "src/core/db3/shared/fileTypes";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

const messages = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
const bands = [parsePublicId<"Band">("AttachBand000001"), parsePublicId<"Band">("AttachBand000002")];
const songId = parsePublicId<"Song">("AttachSong000001");
let band: typeof bands[number] | null;
let uploadAllowed: boolean;
let authority: string;
let routeLocale: string;
let browserLanguages: string[];
let snapshot: object;
let rawPaste: boolean;
let signedIn: boolean;
let telemetry: () => Promise<void>;
let showAdminControls = false;
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ authorizationContext: { bandPublicId: band, authority, userPublicId: signedIn ? "AttachPerson0001" : null },
        localePreferences: { routeLocale, browserLanguages }, isShowingAdminControls: showAdminControls,
        isAuthorized: (permission: Permission) => permission === Permission.upload_files && uploadAllowed }),
    useFeatureRecorder: () => () => telemetry(),
}));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: snapshot }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/core/hooks/useKeyboardState", () => ({ useKeyboardState: () => ({ consumeRawPasteIntent: () => rawPaste }) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess: messages.success, showError: messages.error, showMessage: messages.message }) }));
// Rendering and help do not participate in the attachment or textarea workflow.
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: () => null }));
vi.mock("src/core/components/markdown/MarkdownEditorFormattingTips", () => ({ MarkdownEditorFormattingTips: () => null }));
vi.mock("src/core/components/file/CMDBUploadFile", () => ({
    CMDBUploadFile: (args: CMDBUploadFilesArgs) => new Promise<UploadResponsePayload>((resolve, reject) => requests.push({ args, resolve, reject })),
}));

import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { markdownAttachmentLinks } from "src/core/components/markdown/markdownAttachments";

const requests: Array<{ args: CMDBUploadFilesArgs; resolve: (response: UploadResponsePayload) => void; reject: (error: Error) => void }> = [];
const uploaded: UploadedFile = { publicId: parsePublicId<"File">("Attachment000001"), storedLeafName: "stored.pdf", fileLeafName: "score.pdf",
    mimeType: "application/pdf", externalURI: null, description: "", sizeBytes: 4, customData: null, uploadedByUserId: null };
const files: FileList = Object.assign([new File(["score"], "score.pdf", { type: "application/pdf" })], { item: (index: number) => index === 0 ? files[0]! : null });
let root: Root;
let container: HTMLDivElement;
const textarea = () => container.querySelector("textarea")!;
const input = () => container.querySelector<HTMLInputElement>('input[type="file"]')!;
const attachButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="Attach files"]');

function Harness({ allowUploads = true, readonly = false, parent = songId, visibility = {} }: {
    allowUploads?: boolean; readonly?: boolean; parent?: typeof songId;
    visibility?: Pick<TClientUploadFileArgs, "visiblePermissionId" | "visiblePermission">;
}) {
    const [draft, setDraft] = React.useState("Before caption after");
    return <Markdown3Editor allowUploads={allowUploads} readonly={readonly} value={draft} onChange={setDraft} nominalHeight={200}
        startWithPreviewOpen={false} markdownPreviewLayout="stacked" uploadFileContext={{ taggedSongId: parent, ...visibility }} />;
}
async function render(props: React.ComponentProps<typeof Harness> = {}) {
    await act(async () => root.render(<Harness {...props} />));
}
async function choose() {
    Object.defineProperty(input(), "files", { configurable: true, value: files });
    await act(async () => Simulate.change(input()));
}
async function respond(index = requests.length - 1, responseFiles: UploadedFile[] = [uploaded]) {
    await act(async () => requests[index]!.resolve({ isSuccess: true, files: responseFiles }));
}
async function type(value: string) {
    await act(async () => { textarea().value = value; textarea().setSelectionRange(value.length, value.length); Simulate.change(textarea()); });
}
async function paste(fileList: FileList | readonly File[] = [], html = "") {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: fileList, getData: (type: string) => type === "text/html" ? html : "Plain text" } });
    await act(async () => textarea().dispatchEvent(event));
    return event;
}
async function drop(fileList: FileList | readonly File[], url = "") {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    // jsdom has no DataTransfer constructor; the wrapper reads only files and getData.
    Object.defineProperty(event, "dataTransfer", { value: { files: fileList, getData: () => url } });
    await act(async () => container.querySelector(".fileDropWrapper")!.dispatchEvent(event));
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    band = bands[0]!; authority = "member"; uploadAllowed = true; routeLocale = "fr-BE"; browserLanguages = ["nl-BE", "en"];
    snapshot = {}; rawPaste = false; signedIn = true; telemetry = async () => {}; requests.length = 0; vi.clearAllMocks(); window.localStorage.clear();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

describe("Markdown attachments in the original editor", () => {
    it("opens the chooser, carries the editor policy, shows progress and inserts one undoable batch at the captured selection", async () => {
        await render();
        const click = vi.spyOn(input(), "click");
        await act(async () => Simulate.click(attachButton()!));
        expect(click).toHaveBeenCalledOnce();
        textarea().setSelectionRange(7, 14);
        await choose();
        expect(requests[0]!.args).toMatchObject({ bandPublicId: bands[0], fields: { taggedSongId: songId, visiblePermission: Permission.visibility_public }, maxImageDimension: 750 });
        expect(input().disabled).toBe(true); expect(attachButton()?.disabled).toBe(true);
        expect(document.querySelector('.uploadProgressModal [role="status"]')).not.toBeNull();
        await act(async () => requests[0]!.args.onProgress(0.5, 2, 4));
        await choose(); await paste(files); await drop(files);
        expect(requests).toHaveLength(1);
        textarea().setSelectionRange(0, 0);
        const image = { ...uploaded, storedLeafName: "photo.png", fileLeafName: "photo.png", mimeType: "image/png" };
        await respond(0, [uploaded, image]);
        const links = markdownAttachmentLinks([uploaded, image]);
        expect(textarea().value).toBe(`Before ${links} after`);
        expect(textarea().value.slice(textarea().selectionStart, textarea().selectionEnd)).toBe(links);
        expect(input().disabled).toBe(false); expect(attachButton()?.disabled).toBe(false);
        await act(async () => textarea().dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
        expect(textarea().value).toBe("Before caption after");
        await act(async () => textarea().dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true, cancelable: true })));
        expect(textarea().value).toBe(`Before ${links} after`);
    });

    it("uses the same workflow for file paste, file drop and external URL drop", async () => {
        await render(); textarea().setSelectionRange(0, 0);
        expect((await paste(files)).defaultPrevented).toBe(true); expect(requests[0]!.args.files).toBe(files);
        await respond(); textarea().setSelectionRange(textarea().value.length, textarea().value.length);
        await drop(files); await respond();
        textarea().setSelectionRange(textarea().value.length, textarea().value.length);
        await drop([], "https://example.com/score.pdf");
        expect(requests[2]!.args).toMatchObject({ files: null, fields: { externalURI: "https://example.com/score.pdf" } });
        await respond(2, [{ ...uploaded, externalURI: "https://example.com/score.pdf" }]);
        expect(textarea().value.match(/\/api\/files\/download\/stored.pdf/g)).toHaveLength(2);
        expect(textarea().value).toContain("[score\\.pdf](https://example.com/score.pdf)");
    });

    it("retains ordinary, HTML and explicit raw paste with undo", async () => {
        await render(); textarea().setSelectionRange(7, 14);
        expect((await paste()).defaultPrevented).toBe(false);
        expect((await paste([], "<strong>Bold</strong>")).defaultPrevented).toBe(true);
        expect(textarea().value).toBe("Before **Bold** after"); expect(requests).toHaveLength(0);
        await act(async () => textarea().dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
        expect(textarea().value).toBe("Before caption after");
        rawPaste = true;
        expect((await paste([], "<strong>Raw</strong>")).defaultPrevented).toBe(false);
    });

    it("recovers after failure and preserves an edited draft after a delayed success", async () => {
        await render(); await choose();
        await act(async () => requests[0]!.reject(new Error("Processing failed")));
        expect(textarea().value).toBe("Before caption after"); expect(attachButton()?.disabled).toBe(false);
        expect(messages.error).toHaveBeenCalledOnce();
        await choose(); await type("Changed draft with [[manual|caption]]"); await respond();
        expect(textarea().value).toBe("Changed draft with [[manual|caption]]"); expect(messages.message).toHaveBeenCalledWith(expect.objectContaining({ severity: "warning" }));
        expect(messages.success).not.toHaveBeenCalled();
    });

    it.each(["band", "authority", "locale", "language order", "presentation", "upload grant", "parent"])("discards a delayed completion after a %s change", async change => {
        await render(); await choose();
        if (change === "band") { band = bands[1]!; }
        if (change === "authority") { authority = "different authority"; }
        if (change === "locale") { routeLocale = "nl-BE"; }
        if (change === "language order") { browserLanguages.reverse(); }
        if (change === "presentation") { snapshot = {}; }
        if (change === "upload grant") { uploadAllowed = false; }
        await render(change === "parent" ? { parent: parsePublicId<"Song">("AttachSong000002") } : {});
        expect(requests[0]!.args.signal?.aborted).toBe(true);
        await act(async () => requests[0]!.args.onProgress(0.9, 9, 10)); await respond(0);
        expect(textarea().value).toBe("Before caption after"); expect(messages.success).not.toHaveBeenCalled();
        expect(document.querySelector('.uploadProgressModal [role="status"]')).toBeNull();
        uploadAllowed = true; await render(); await choose(); await respond();
        expect(textarea().value).toContain("/api/files/download/stored.pdf");
    });

    it.each(["no band", "no grant", "local only", "anonymous"])("keeps text editing without upload affordances for %s", async mode => {
        if (mode === "no band") { band = null; }
        if (mode === "no grant") { uploadAllowed = false; }
        if (mode === "anonymous") { signedIn = false; }
        await render({ allowUploads: mode !== "local only" });
        expect(attachButton()).toBeNull(); expect(input()).toBeNull();
        await paste(files); await drop(files); await drop([], "https://example.com/score.pdf");
        expect(requests).toHaveLength(0); await type("Manual edit"); expect(textarea().value).toBe("Manual edit");
    });

    it.each(["identity", "name"])("retains the caller's explicit visibility %s without adding the public default", async kind => {
        const visibility = kind === "identity" ? { visiblePermissionId: parsePublicId<"Permission">("AttachPerm000001") } : { visiblePermission: Permission.visibility_members };
        await render({ visibility }); await choose(); expect(requests[0]!.args.fields).toEqual({ taggedSongId: songId, ...visibility, externalURI: null });
    });

    it("still completes an attachment when telemetry fails", async () => {
        telemetry = async () => {
            throw new Error("Telemetry offline");
        };
        const report = vi.spyOn(console, "error").mockImplementation(() => {});
        await render(); await choose(); await respond();
        expect(textarea().value).toContain("/api/files/download/stored.pdf"); expect(messages.success).toHaveBeenCalledOnce(); expect(report).toHaveBeenCalledOnce();
    });

    it("keeps readonly content without attachment controls", async () => {
        await render({ readonly: true }); expect(container.querySelector("textarea")).toBeNull(); expect(attachButton()).toBeNull(); expect(input()).toBeNull(); expect(requests).toHaveLength(0);
    });

    it("preserves the draft when hooked toolbar controls and read-only mode change", async () => {
        showAdminControls = true;
        try {
            await render();
            expect(textarea().value).toBe("Before caption after");
            await render({ readonly: true });
            expect(container.querySelector("pre")?.textContent).toBe("Before caption after");
            showAdminControls = false;
            await render();
            expect(textarea().value).toBe("Before caption after");
        } finally {
            showAdminControls = false;
        }
    });

    it("cancels pending uploads when the editor unmounts", async () => {
        await render(); await choose(); await act(async () => root.render(null));
        expect(requests[0]!.args.signal?.aborted).toBe(true); await respond();
        expect(messages.success).not.toHaveBeenCalled(); expect(messages.error).not.toHaveBeenCalled();
    });

    it("preserves the draft when fullscreen remounts the textarea during an upload", async () => {
        await render(); const previousTextarea = textarea(); await choose();
        await act(async () => Simulate.click(container.querySelector('button.fullscreenToggleButton')!));
        const fullscreenTextarea = document.querySelector<HTMLTextAreaElement>('.MarkdownFullscreenDialog textarea')!;
        expect(fullscreenTextarea).not.toBe(previousTextarea); await respond();
        expect(fullscreenTextarea.value).toBe("Before caption after");
        expect(messages.message).toHaveBeenCalledWith(expect.objectContaining({ severity: "warning" })); expect(messages.success).not.toHaveBeenCalled();
    });

    it("keeps punctuation literal in file captions and storage identity within one URL path segment", () => {
        const file = { ...uploaded, fileLeafName: "score [A](v1) *draft* \\ notes.pdf", storedLeafName: "stored (v1).pdf" };
        const html = new MarkdownIt().render(markdownAttachmentLinks([file]));
        const preview = document.createElement("div"); preview.innerHTML = html;
        expect(preview.querySelector("a")?.textContent).toBe(file.fileLeafName);
        expect(preview.querySelector("a")?.getAttribute("href")).toBe("/api/files/download/stored%20(v1).pdf");
        expect(preview.querySelector("em")).toBeNull();
    });

    it("links external records directly and escapes unmatched URL parentheses", () => {
        const file = { ...uploaded, externalURI: "https://example.com/score(v1).pdf?caption=)" };
        const preview = document.createElement("div"); preview.innerHTML = new MarkdownIt().render(markdownAttachmentLinks([file]));
        expect(preview.querySelector("a")?.getAttribute("href")).toBe("https://example.com/score%28v1%29.pdf?caption=%29");
    });
});
