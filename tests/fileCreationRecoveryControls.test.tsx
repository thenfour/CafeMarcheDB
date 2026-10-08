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
import { DeferredImageCreationButton } from "src/core/components/file/FileCreationRecoveryControls";
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

describe("deferred file creation controls", () => {
    it.each([UploadFileComponent, CollapsableUploadFileComponent])("renders a localized notice without file inputs, buttons or paste interception", async Component => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        await act(async () => root.render(<Component onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={0.5} enablePaste />));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("en: File uploads and image creation are temporarily unavailable");
        expect(container.querySelectorAll("input, button, progress")).toHaveLength(0);
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        document.dispatchEvent(paste);
        expect(paste.defaultPrevented).toBe(false);
        expect(onFileSelect).not.toHaveBeenCalled();
        expect(onURLUpload).not.toHaveBeenCalled();
        language = "fr-BE";
        await act(async () => root.render(<Component onFileSelect={onFileSelect} progress={null} />));
        expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/^fr-BE:/);
    });

    it("preserves child content and prevents file/URL drops from navigating or invoking uploads", async () => {
        const onFileSelect = vi.fn();
        const onURLUpload = vi.fn();
        await act(async () => root.render(<FileDropWrapper onFileSelect={onFileSelect} onURLUpload={onURLUpload} progress={null}>
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

    it("keeps bake disabled and explains the restriction in its tooltip", async () => {
        await act(async () => root.render(<DeferredImageCreationButton />));
        expect(container.querySelector("button")?.disabled).toBe(true);
        expect(container.textContent).toContain("en: Bake new image");
        await act(async () => {
            container.querySelector("span")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
            await new Promise(resolve => window.setTimeout(resolve, 150));
        });
        expect(document.querySelector('[role="tooltip"]')?.textContent).toContain("File uploads and image creation are temporarily unavailable");
    });

    it("blocks Markdown file paste while retaining text/HTML paste and existing content", async () => {
        const onFileSelect = vi.fn();
        const onCustomPaste = vi.fn();
        await act(async () => root.render(<MarkdownEditor value="Existing markdown" nominalHeight={200}
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
