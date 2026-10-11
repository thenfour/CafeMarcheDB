// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}`,
}) }));
vi.mock("src/core/components/ItemAssociation", () => ({ fetchObjectQuery: () => {
    throw new Error("Recovery upload queried associations.");
} }));
vi.mock("src/core/components/markdown/MarkdownReactPlugins", () => ({ fetchInlineClasses: () => [] }));
vi.mock("src/core/hooks/useKeyboardState", () => ({ useKeyboardState: () => ({ consumeRawPasteIntent: () => false }) }));
interface TextAreaProps {
    innerRef: (element: HTMLTextAreaElement | null) => void;
    onPaste: React.ClipboardEventHandler<HTMLTextAreaElement>;
    value: string;
}
vi.mock("@webscopeio/react-textarea-autocomplete", () => ({
    default: (props: TextAreaProps) => <textarea ref={props.innerRef} onPaste={props.onPaste} value={props.value} readOnly />,
}));

import { CollapsableUploadFileComponent, FileDropWrapper, UploadFileComponent } from "src/core/components/file/FileDrop";
import { MarkdownEditor } from "src/core/components/markdown/RichTextEditor";

let language: string;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    language = "en";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("File upload controls", () => {
    it("retains the production upload card, localized instructions and file picker interaction", async () => {
        await act(async () => root.render(<UploadFileComponent enabled onFileSelect={vi.fn()} progress={null} />));
        const card = container.querySelector('.UploadFileComponent.interactable.interactableWithBorder');
        expect(card).not.toBeNull();
        expect(card?.classList.contains("notBusy")).toBe(true);
        expect(card?.querySelector('.UploadFileComponentInterior > svg')).not.toBeNull();
        expect(card?.querySelector('.instructions')?.textContent).toContain("en: To upload files,");
        expect(Array.from(container.querySelectorAll('.instructions li'), item => item.textContent)).toEqual([
            "en: Drag & drop files or URLs here",
            "en: or, Click to select files",
            "en: or, Paste files/images/URLs",
        ]);
        const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
        const selectFiles = vi.spyOn(input, "click");
        card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        card?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        card?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
        expect(selectFiles).toHaveBeenCalledTimes(3);
        language = "fr-BE";
        await act(async () => root.render(<UploadFileComponent enabled onFileSelect={vi.fn()} progress={0} />));
        expect(container.querySelector('.UploadFileComponent.busy')?.getAttribute("aria-disabled")).toBe("true");
        expect(container.querySelector('.instructions')).toBeNull();
        expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
        container.querySelector('.UploadFileComponent')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(selectFiles).toHaveBeenCalledTimes(3);
        await act(async () => root.render(<UploadFileComponent enabled onFileSelect={vi.fn()} progress={null} />));
        expect(container.querySelector('.instructions')?.textContent).toContain("fr-BE: To upload files,");
    });

    it("keeps the drag overlay visible across child transitions and clears it on exit and drop", async () => {
        const onFileSelect = vi.fn();
        await act(async () => root.render(<FileDropWrapper enabled onFileSelect={onFileSelect} onURLUpload={vi.fn()} progress={null}>
            <div className="card"><span className="icon">Icon</span><span className="instructions">Instructions</span></div>
        </FileDropWrapper>));
        const wrapper = container.querySelector('.fileDropWrapper')!;
        const card = container.querySelector('.card')!;
        const icon = container.querySelector('.icon')!;
        const instructions = container.querySelector('.instructions')!;
        const drag = async (target: Element, type: string) => act(async () => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "dataTransfer", { value: { files: [new File(["score"], "score.pdf")] } });
            target.dispatchEvent(event);
        });
        await drag(wrapper, "dragenter");
        expect(container.querySelector('.dragOverlay')?.textContent).toBe("en: Upload files...");
        await drag(card, "dragenter");
        await drag(wrapper, "dragleave");
        expect(container.querySelector('.dragOverlay')).not.toBeNull();
        await drag(icon, "dragenter");
        await drag(card, "dragleave");
        await drag(instructions, "dragenter");
        await drag(icon, "dragleave");
        expect(container.querySelector('.dragOverlay')).not.toBeNull();
        await drag(instructions, "dragleave");
        expect(container.querySelector('.dragOverlay')).toBeNull();
        await drag(card, "dragover");
        expect(container.querySelector('.dragOverlay')).not.toBeNull();
        await drag(card, "drop");
        expect(container.querySelector('.dragOverlay')).toBeNull();
        expect(onFileSelect).toHaveBeenCalledOnce();
    });

    it("clears drag feedback when unavailable and restores the production progress modal at zero", async () => {
        const render = async (enabled: boolean, progress: number | null) => act(async () => root.render(
            <FileDropWrapper enabled={enabled} onFileSelect={vi.fn()} onURLUpload={vi.fn()} progress={progress}><span>Files</span></FileDropWrapper>));
        const enter = async () => act(async () => container.querySelector('.fileDropWrapper')!.dispatchEvent(
            new Event("dragenter", { bubbles: true, cancelable: true })));
        await render(true, null);
        await enter();
        expect(container.querySelector('.dragOverlay')).not.toBeNull();
        await render(true, 0);
        expect(container.querySelector('.dragOverlay')).toBeNull();
        expect(document.querySelector('.uploadProgressModal .progressContainer [role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
        await render(true, null);
        expect(container.querySelector('.dragOverlay')).toBeNull();
        await enter();
        await render(false, null);
        expect(container.querySelector('.dragOverlay')).toBeNull();
        await render(true, null);
        expect(container.querySelector('.dragOverlay')).toBeNull();
    });

    it("uploads dropped files and HTTP URLs, while blocking busy and disabled drops", async () => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        const render = async (enabled: boolean, progress: number | null) => act(async () => root.render(
            <FileDropWrapper enabled={enabled} onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={progress}><span>Files</span></FileDropWrapper>));
        const drop = (url: string, files: File[] = []) => {
            const event = new Event("drop", { bubbles: true, cancelable: true });
            Object.defineProperty(event, "dataTransfer", { value: { files, getData: () => url } });
            container.querySelector("span")!.dispatchEvent(event);
            return event;
        };
        await render(true, null);
        drop("https://example.com/song.wav");
        expect(onURLUpload).toHaveBeenCalledWith("https://example.com/song.wav");
        drop("file:///private");
        expect(onURLUpload).toHaveBeenCalledOnce();
        drop("", [new File(["score"], "score.pdf")]);
        expect(onFileSelect).toHaveBeenCalledOnce();
        await render(true, 0);
        expect(document.querySelector('.uploadProgressModal [role="status"]')).not.toBeNull();
        expect(drop("https://example.com").defaultPrevented).toBe(true);
        await render(false, null);
        drop("", [new File(["score"], "score.pdf")]);
        expect(onFileSelect).toHaveBeenCalledOnce();
        expect(onURLUpload).toHaveBeenCalledOnce();
    });

    it("supports paste and selection while preserving text editing and zero-progress busy state", async () => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        const render = async (progress: number | null) => act(async () => root.render(<>
            <UploadFileComponent enabled onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={progress} />
            <textarea defaultValue="Draft" />
        </>));
        const paste = (target: EventTarget, text: string, files: File[] = []) => {
            const event = new Event("paste", { bubbles: true, cancelable: true });
            Object.defineProperty(event, "clipboardData", { value: { files, getData: () => text } });
            target.dispatchEvent(event);
            return event;
        };
        await render(null);
        expect(paste(document, "ordinary text").defaultPrevented).toBe(false);
        expect(paste(container.querySelector("textarea")!, "https://example.com").defaultPrevented).toBe(false);
        expect(paste(document, "https://example.com").defaultPrevented).toBe(true);
        expect(onURLUpload).toHaveBeenCalledWith("https://example.com/");
        paste(document, "", [new File(["audio"], "recording.wav")]);
        expect(onFileSelect).toHaveBeenCalledOnce();
        const input = container.querySelector('input[type="file"]')!;
        Object.defineProperty(input, "files", { value: [new File(["score"], "score.pdf")] });
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(onFileSelect).toHaveBeenCalledTimes(2);
        await render(0);
        expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
        expect(paste(document, "https://example.com").defaultPrevented).toBe(false);
        expect(onURLUpload).toHaveBeenCalledOnce();
    });
    it.each([UploadFileComponent, CollapsableUploadFileComponent])("renders a localized notice without file inputs, buttons or paste interception", async Component => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        await act(async () => root.render(<Component enabled={false} onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={0.5} enablePaste />));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("en: File uploads are unavailable here.");
        expect(container.querySelectorAll("input, button, progress")).toHaveLength(0);
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        document.dispatchEvent(paste);
        expect(paste.defaultPrevented).toBe(false);
        expect(onFileSelect).not.toHaveBeenCalled();
        expect(onURLUpload).not.toHaveBeenCalled();
        language = "fr-BE";
        await act(async () => root.render(<Component enabled={false} onFileSelect={onFileSelect} progress={null} />));
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });

    it("preserves child content and prevents file/URL drops from navigating or invoking uploads", async () => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        await act(async () => root.render(<FileDropWrapper enabled={false} onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={null}>
            <textarea defaultValue="Unsaved content" />
        </FileDropWrapper>));
        for (const type of ["dragover", "drop"]) {
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperty(event, "dataTransfer", { value: {
                files: [new File(["image"], "photo.png")], types: ["Files"],
            } });
            container.querySelector("textarea")!.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        const urlDrop = new Event("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(urlDrop, "dataTransfer", { value: {
            files: [], types: ["text/uri-list"], getData: () => "https://example.com/recording.mp3",
        } });
        container.querySelector("textarea")!.dispatchEvent(urlDrop);
        expect(urlDrop.defaultPrevented).toBe(true);
        expect(container.querySelector("textarea")?.value).toBe("Unsaved content");
        expect(onFileSelect).not.toHaveBeenCalled();
        expect(onURLUpload).not.toHaveBeenCalled();
    });

    it("blocks Markdown file paste while retaining text/HTML paste and existing content", async () => {
        const onFileSelect = vi.fn();
        const onCustomPaste = vi.fn();
        await act(async () => root.render(<MarkdownEditor referenceSearchEnabled={false} uploadsEnabled={false} onURLUpload={() => {}} value="Existing markdown" nominalHeight={200}
            onValueChanged={vi.fn()} onBeforeInput={() => false} onFileSelect={onFileSelect}
            uploadProgress={null} onCustomPaste={onCustomPaste} textAreaRef={vi.fn()} nativeFileInputRef={vi.fn()} />));
        expect(container.querySelector('input[type="file"]')).toBeNull();
        const textarea = container.querySelector("textarea")!;
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(paste, "clipboardData", { value: { files: [new File(["image"], "photo.png")] } });
        textarea.dispatchEvent(paste);
        expect(paste.defaultPrevented).toBe(true);
        expect(onFileSelect).not.toHaveBeenCalled();
        const html = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(html, "clipboardData", { value: { files: [], getData: () => "<strong>Text</strong>" } });
        textarea.dispatchEvent(html);
        expect(onCustomPaste).toHaveBeenCalledWith("**Text**");
        const text = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(text, "clipboardData", { value: { files: [], getData: () => "" } });
        textarea.dispatchEvent(text);
        expect(text.defaultPrevented).toBe(false);
        expect(textarea.value).toBe("Existing markdown");
    });
});
