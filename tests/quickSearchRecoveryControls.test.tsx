// @vitest-environment jsdom
import React from "react";
import type * as Rpc from "@blitzjs/rpc";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType, type QuickSearchItemMatch } from "shared/quickFilter";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => `${language}: ${kStaticLocalizedStringRegistry[key].defaultValue}`,
}) }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: (props: { title: string; children: React.ReactNode }) =>
    <main><h1>{props.title}</h1>{props.children}</main>,
}));
vi.mock("src/auth/server/serverPageAuthorization", () => ({ makeServerSidePermissionGuard: () => () => ({ props: {} }) }));
vi.mock("@blitzjs/rpc", async () => ({
    ...await vi.importActual<typeof Rpc>("@blitzjs/rpc"),
    useQuery: () => {
        throw new Error("Deferred control mounted a query.");
    },
    useMutation: () => {
        throw new Error("Deferred control mounted a mutation.");
    },
}));
vi.mock("src/core/components/featureReports/useFeatureRecorder", () => ({ useFeatureRecorder: () => {
    throw new Error("Deferred control mounted telemetry.");
} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => { throw new Error("Deferred control mounted a dashboard query."); },
    useFeatureRecorder: () => { throw new Error("Deferred control mounted telemetry."); },
}));
vi.mock("src/core/components/markdown/MarkdownReactPlugins", () => ({ fetchInlineClasses: () => ["highlight"] }));
vi.mock("src/core/hooks/useKeyboardState", () => ({ useKeyboardState: () => ({ consumeRawPasteIntent: () => false }) }));
interface TextAreaProps {
    innerRef: (element: HTMLTextAreaElement | null) => void;
    onPaste: React.ClipboardEventHandler<HTMLTextAreaElement>;
    onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
    value: string;
    trigger: { "{{": { dataProvider: (token: string) => Promise<string[]>; output: (item: string) => string } };
}
vi.mock("@webscopeio/react-textarea-autocomplete", () => ({ default: (props: TextAreaProps) => {
    textAreaProps = props;
    return <textarea ref={props.innerRef} onPaste={props.onPaste} onChange={props.onChange} value={props.value} />;
} }));

import { AssociationAutocomplete, AssociationSelect, fetchObjectQuery } from "src/core/components/ItemAssociation";
import { MarkdownEditor } from "src/core/components/markdown/RichTextEditor";

let language: string;
let root: Root;
let container: HTMLDivElement;
let textAreaProps: TextAreaProps | undefined;
const fetchSpy = vi.fn(() => {
    throw new Error("Deferred control made a network request.");
});
const song: QuickSearchItemMatch<QuickSearchItemType.song> = {
    itemType: QuickSearchItemType.song, id: parsePublicId<"Song">("Song000000000001"), name: "Authored song",
    absoluteUri: "/backstage/song/Song000000000001?bandPublicId=Band000000000001", matchStrength: 1, matchingField: "name",
};

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockClear();
    language = "en";
    textAreaProps = undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("deferred quick search controls", () => {
    it("keeps the selected association link without query, clear or selection controls", async () => {
        const onChange = vi.fn();
        await act(async () => root.render(<AssociationSelect searchEnabled={false} permissionPolicy="requireAll" title="Reference" value={song} onChange={onChange} allowedItemTypes={[QuickSearchItemType.song]} allowNull />));
        expect(container.textContent).toContain("Reference");
        expect(container.querySelector("a")?.getAttribute("href")).toBe(song.absoluteUri);
        expect(container.querySelector("a")?.textContent).toContain(song.name);
        expect(container.querySelectorAll("input, button")).toHaveLength(0);
        language = "fr-BE";
        await act(async () => root.render(<AssociationSelect searchEnabled={false} permissionPolicy="requireAll" value={null} onChange={onChange} allowedItemTypes={[QuickSearchItemType.song]} allowNull />));
        expect(container.textContent).toContain("fr-BE: Association");
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("fr-BE: Quick search");
        expect(container.querySelector("a")).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });

    it.each(["controlled", "initial"])("does not start searching or change %s query state", async mode => {
        const onSelect = vi.fn();
        const onValueChange = vi.fn();
        await act(async () => root.render(<AssociationAutocomplete searchEnabled={false} permissionPolicy="requireAll" value={mode === "controlled" ? "Authored query" : undefined}
            defaultValue="Initial query" onSelect={onSelect} onValueChange={onValueChange} allowedItemTypes={[QuickSearchItemType.user]} autofocus />));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("reference suggestions are temporarily unavailable");
        expect(container.querySelectorAll("input, button")).toHaveLength(0);
        expect(onSelect).not.toHaveBeenCalled();
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it("keeps a deferred caller unavailable even when its domain plugin is restored", async () => {
        await act(async () => root.render(<AssociationAutocomplete searchEnabled={false} permissionPolicy="requireAll"
            allowedItemTypes={[QuickSearchItemType.wikiPage]} defaultValue="Wiki draft" onSelect={vi.fn()} />));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("Quick search");
        expect(container.querySelector("input")).toBeNull();
    });

    it("keeps Markdown text/HTML editing and inline classes while removing remote reference suggestions", async () => {
        const onValueChanged = vi.fn();
        const onCustomPaste = vi.fn();
        const authored = "[[wiki-slug]] @person {{highlight:text}}";
        await act(async () => root.render(<MarkdownEditor referenceSearchEnabled={false} value={authored} nominalHeight={200}
            onValueChanged={onValueChanged} onBeforeInput={() => false} onFileSelect={vi.fn()} uploadProgress={null}
            onCustomPaste={onCustomPaste} textAreaRef={vi.fn()} nativeFileInputRef={vi.fn()} />));
        expect(container.querySelector("textarea")?.value).toBe(authored);
        expect(Object.keys(textAreaProps!.trigger)).toEqual(["{{"]);
        expect(await textAreaProps!.trigger["{{"].dataProvider("{high")).toEqual(["highlight"]);
        expect(textAreaProps!.trigger["{{"].output("highlight")).toBe("{{highlight:}}");
        const textarea = container.querySelector("textarea")!;
        await act(async () => {
            textarea.value = authored + " edited";
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            Simulate.change(textarea);
        });
        expect(onValueChanged).toHaveBeenCalledWith(expect.objectContaining({ text: authored + " edited" }));
        const paste = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(paste, "clipboardData", { value: { files: [], getData: () => "<strong>Text</strong>" } });
        textarea.dispatchEvent(paste);
        expect(onCustomPaste).toHaveBeenCalledWith("**Text**");
        expect(paste.defaultPrevented).toBe(true);
    });

    it("rejects direct client search before constructing a request", async () => {
        await expect(fetchObjectQuery("private", [QuickSearchItemType.user], {}, "requireAll")).rejects.toThrow();
    });
});
