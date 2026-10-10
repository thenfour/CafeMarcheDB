// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType as Type, QuickSearchItemTypeSets, type QuickSearchItemMatch } from "shared/quickFilter";
import type { DashboardContextData } from "src/core/components/dashboardContext/DashboardContext";
import type { MarkdownEditorCommand, MarkdownEditorCommandApi } from "src/core/components/markdown/MarkdownEditorCommandBase";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

const bands = [parsePublicId<"Band">("PickerBand000001"), parsePublicId<"Band">("PickerBand000002")];
let band: typeof bands[number] | null;
let snapshot: object;
let routeLocale: string;
let browserLanguages: string[];
let authority: string;
let telemetry: () => Promise<void>;
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ authorizationContext: { bandPublicId: band, authority }, localePreferences: { routeLocale, browserLanguages } }),
    useFeatureRecorder: () => () => telemetry(),
}));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: snapshot }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/core/hooks/useKeyboardState", () => ({ useKeyboardState: () => ({ consumeRawPasteIntent: () => false }) }));
vi.mock("src/core/components/file/FileDrop", () => ({
    FileDropWrapper: ({ children }: React.PropsWithChildren) => <div>{children}</div>, CollapsableUploadFileComponent: () => null,
}));

import { MarkdownEditor } from "src/core/components/markdown/RichTextEditor";
import { MarkdownEditorMentionCommand } from "src/core/components/markdown/MarkdownEditorMentionCommand";
import { WikiReferenceCommand } from "src/core/components/markdown/MarkdownEditorWikiReferenceCommand";
import { useControlledTextArea, type ControlledTextAreaAPI } from "src/core/components/markdown/useControlledTextArea";

const song: QuickSearchItemMatch<Type.song> = { itemType: Type.song, id: parsePublicId<"Song">("PickerSong000001"), name: "Found Song",
    absoluteUri: "/backstage/song/PickerSong000001?bandPublicId=PickerBand000001&routeLocale=fr-BE", matchStrength: 1, matchingField: "name" };
const person: QuickSearchItemMatch<Type.user> = { ...song, itemType: Type.user, id: parsePublicId<"User">("PickerPerson0001"), name: "Found Person",
    absoluteUri: "/backstage/user/PickerPerson0001?bandPublicId=PickerBand000001&routeLocale=fr-BE" };
const wiki: QuickSearchItemMatch<Type.wikiPage> = { ...song, itemType: Type.wikiPage, id: parsePublicId<"WikiPage">("PickerWiki000001"), name: "Found Wiki",
    canonicalWikiSlug: "band-handbook", absoluteUri: "/backstage/wiki/band-handbook?bandPublicId=PickerBand000001&routeLocale=fr-BE" };
const requests: Array<{ url: string; signal: AbortSignal | null | undefined; resolve: (response: Response) => void }> = [];
let root: Root;
let container: HTMLDivElement;
let editor: ControlledTextAreaAPI;
const reply = (items: QuickSearchItemMatch[] = [song]) => new Response(JSON.stringify(items), { status: 200 });
const textarea = () => container.querySelector("textarea")!;
const dialog = () => document.querySelector('[role="dialog"]')!;
const searchInput = () => dialog().querySelector<HTMLInputElement>(".AssociationAutocomplete input")!;
const caption = () => dialog().querySelector<HTMLInputElement>('[aria-label="Custom caption (optional)"]')!;
const button = (text: string) => [...dialog().querySelectorAll("button")].find(element => element.textContent === text)!;

function InlineHarness({ seed = "Draft ", enabled = true }: { seed?: string; enabled?: boolean }) {
    const [value, setValue] = React.useState(seed);
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    editor = useControlledTextArea(ref, value, setValue);
    return <MarkdownEditor referenceSearchEnabled={enabled} uploadsEnabled={false} onURLUpload={() => {}} value={value} onValueChanged={editor.handleNativeTextChange}
        onBeforeInput={editor.handleNativeBeforeInput} nominalHeight={200} onFileSelect={() => {}} uploadProgress={null}
        textAreaRef={element => { ref.current = element; }} nativeFileInputRef={() => {}} />;
}

function DialogHarness({ command, seed = "Authored draft" }: { command: MarkdownEditorCommand; seed?: string }) {
    const [value, setValue] = React.useState(seed);
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    const [element, setElement] = React.useState<HTMLTextAreaElement | null>(null);
    const [trigger, setTrigger] = React.useState(0);
    editor = useControlledTextArea(ref, value, setValue);
    const Component = command.toolbarItem!;
    const api: MarkdownEditorCommandApi = {
        // These commands receive context for the editor contract but read search scope through its owner.
        dashboardContext: {} as DashboardContextData,
        controlledTextArea: editor, textArea: element!, nativeFileInputRef: document.createElement("input"),
        allowUploads: false, uploadInProgress: false,
        referenceSearchEnabled: !!band, saveProgress: async () => {}, invocationTriggerMap: { [command.id]: trigger },
    };
    return <><textarea value={value} readOnly ref={node => { ref.current = node; if (node && node !== element) setElement(node); }} />
        <button onClick={() => setTrigger(trigger + 1)}>Shortcut</button><Component api={api} invocationTrigger={trigger} /></>;
}

async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    await act(async () => {
        element.focus(); element.value = value; element.setSelectionRange(value.length, value.length);
        Simulate.change(element);
    });
}
async function key(element: HTMLElement, name: string, code: number) {
    await act(async () => { element.dispatchEvent(new KeyboardEvent("keydown", { key: name, keyCode: code, bubbles: true, cancelable: true })); });
}
async function respond(items: QuickSearchItemMatch[] = [song], index = requests.length - 1) {
    await act(async () => requests[index]!.resolve(reply(items)));
}
async function open(command: MarkdownEditorCommand, seed?: string, shortcut = false) {
    await act(async () => root.render(<DialogHarness command={command} seed={seed} />));
    await act(async () => Simulate.click(shortcut ? container.querySelector("button")! : container.querySelector(".toolItem")!));
}
async function choose(item: QuickSearchItemMatch, keyboard = false) {
    await type(searchInput(), item.name);
    await respond([item]);
    if (keyboard) {
        await act(async () => Simulate.keyDown(searchInput(), { key: "ArrowDown" }));
        await act(async () => Simulate.keyDown(searchInput(), { key: "Enter" }));
    } else {
        await act(async () => Simulate.click(document.querySelector('[role="option"]')!));
    }
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    band = bands[0]!; snapshot = {}; routeLocale = "fr-BE"; browserLanguages = ["nl-BE", "en-US"]; authority = "member";
    telemetry = async () => {}; requests.length = 0;
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => new Promise<Response>(resolve => requests.push({ url, signal: init.signal, resolve })));
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

describe("inline Markdown references in the original textarea control", () => {
    it("keeps bracket grammar, ordered preferences, canonical Wiki output and undo", async () => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft [band");
        expect(requests).toHaveLength(0);
        await type(textarea(), "Draft [[band");
        const query = new URL(requests[0]!.url, "https://editor.invalid").searchParams;
        expect(query.get("keyword")).toBe("band"); expect(query.get("bandPublicId")).toBe(band);
        expect(query.get("routeLocale")).toBe("fr-BE"); expect(JSON.parse(query.get("browserLanguages")!)).toEqual(browserLanguages);
        expect(JSON.parse(query.get("allowedItemTypes")!)).toEqual(QuickSearchItemTypeSets.WikiPages);
        expect(query.get("permissionPolicy")).toBe("requireAll");
        await respond([wiki]); expect(container.textContent).toContain(wiki.canonicalWikiSlug);
        await key(textarea(), "Enter", 13);
        expect(textarea().value).toBe("Draft [[band-handbook]] ");
        await act(async () => { void editor.undoManagerApi.undo(); });
        expect(textarea().value).toBe("Draft [[band");
    });

    it.each([song, person, wiki])("inserts current $itemType references with keyboard and the supported link format", async item => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @s:Found"); await respond([item]);
        const query = new URL(requests[0]!.url, "https://editor.invalid").searchParams;
        expect(query.get("keyword")).toBe("s:Found"); expect(query.get("permissionPolicy")).toBe("omitUnavailable");
        expect(JSON.parse(query.get("allowedItemTypes")!)).toEqual(QuickSearchItemTypeSets.Everything);
        await key(textarea(), "ArrowDown", 40); await key(textarea(), "Enter", 13);
        const path = item.itemType === Type.wikiPage ? item.canonicalWikiSlug : `${item.itemType}:${item.id}`;
        expect(textarea().value).toBe(`Draft [[${path}|${item.name}]] `);
    });

    it("discards an older token response without closing the newer token's popup", async () => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @First"); const first = requests[0]!;
        await type(textarea(), "Draft @Second"); expect(first.signal?.aborted).toBe(true);
        await respond([person]); await respond([song], 0);
        expect(container.textContent).toContain(person.name); expect(container.textContent).not.toContain(song.name);
        await key(textarea(), "Enter", 13); expect(textarea().value).toContain(`user:${person.id}`);
    });

    it.each(["band", "locale", "languages", "authority", "snapshot"])("retires visible references after a %s change, preserving text/caret", async change => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @Found"); await respond([song]);
        const caret = textarea().selectionEnd;
        if (change === "band") band = bands[1]!;
        if (change === "locale") routeLocale = "nl-BE";
        if (change === "languages") browserLanguages = ["en-US", "nl-BE"];
        if (change === "authority") authority = "revoked";
        if (change === "snapshot") snapshot = {};
        await act(async () => root.render(<InlineHarness />));
        expect(container.textContent).not.toContain(song.name); expect(textarea().value).toBe("Draft @Found");
        expect(textarea().selectionEnd).toBe(caret); expect(requests[0]!.signal?.aborted).toBe(true);
        await key(textarea(), "Enter", 13); expect(textarea().value).not.toContain("[[song:");
        await type(textarea(), "Draft @Next"); await respond([person]);
        expect(new URL(requests[1]!.url, "https://editor.invalid").searchParams.get("bandPublicId")).toBe(band);
        expect(container.textContent).toContain(person.name);
    });

    it.each(["band", "locale", "languages", "authority", "snapshot"])("discards a pending response after a %s change", async change => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @Pending");
        if (change === "band") band = bands[1]!;
        if (change === "locale") routeLocale = "nl-BE";
        if (change === "languages") browserLanguages = ["en-US", "nl-BE"];
        if (change === "authority") authority = "revoked";
        if (change === "snapshot") snapshot = {};
        await act(async () => root.render(<InlineHarness />));
        await respond([song]);
        expect(requests[0]!.signal?.aborted).toBe(true); expect(container.textContent).not.toContain(song.name);
        expect(textarea().value).toBe("Draft @Pending");
        await type(textarea(), "Draft @Current"); await respond([person]); expect(container.textContent).toContain(person.name);
    });

    it("rejects a previously delivered choice after the caret moves to a different insertion point", async () => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @Found"); await respond([song]);
        textarea().setSelectionRange(1, 1);
        await act(async () => Simulate.click(container.querySelector(".rta__entity")!));
        expect(textarea().value).toBe("Draft @Found");
        expect(container.querySelector(".rta__list")).toBeNull();
    });

    it("dismisses with Escape, rejects closed reference text and recovers from denied requests", async () => {
        await act(async () => root.render(<InlineHarness />));
        await type(textarea(), "Draft @Found"); await key(textarea(), "Escape", 27); await respond([song]);
        expect(container.textContent).not.toContain(song.name); expect(textarea().value).toBe("Draft @Found");
        await type(textarea(), "Draft [[closed]]"); expect(requests).toHaveLength(1);
        await type(textarea(), "Draft @Denied");
        await act(async () => requests[1]!.resolve(new Response("Denied", { status: 403 })));
        expect(textarea().value).toBe("Draft @Denied"); expect(container.querySelector(".rta__list")).toBeNull();
        await type(textarea(), "Draft @Allowed"); await respond([song]); expect(container.textContent).toContain(song.name);
    });

    it("keeps manual links and inline classes available without selected-band search", async () => {
        band = null;
        await act(async () => root.render(<InlineHarness enabled={false} seed="[[manual|Caption]] @authored" />));
        expect(textarea().value).toBe("[[manual|Caption]] @authored");
        await type(textarea(), "[[manual|Caption]] {{high");
        expect(container.textContent).toContain("highlight"); expect(requests).toHaveLength(0);
    });
});

describe("Markdown reference dialogs", () => {
    it("selects a person by keyboard, inserts a custom caption and preserves undo", async () => {
        await open(MarkdownEditorMentionCommand, "Authored draft", true);
        await choose(person, true); await type(caption(), "My caption");
        await act(async () => { Simulate.click(button("OK")); });
        expect(textarea().value).toContain(`[[user:${person.id}|My caption]]`);
        await act(async () => { void editor.undoManagerApi.undo(); }); expect(textarea().value).toBe("Authored draft");
    });

    it("clears a picked mention when its query changes and cancels without changing the draft", async () => {
        await open(MarkdownEditorMentionCommand); await choose(song); expect(button("OK").disabled).toBe(false);
        await type(searchInput(), "Different"); expect(button("OK").disabled).toBe(true);
        expect(caption().value).toBe(song.name);
        await act(async () => Simulate.click(button("Cancel"))); expect(textarea().value).toBe("Authored draft");
        await act(async () => Simulate.click(container.querySelector(".toolItem")!)); expect(button("OK").disabled).toBe(true);
    });

    it.each(["authority", "snapshot"])("invalidates a picked mention after %s refresh without discarding its caption or editor draft", async change => {
        await open(MarkdownEditorMentionCommand); await choose(song); await type(caption(), "Unsaved caption");
        if (change === "authority") authority = "revoked"; else snapshot = {};
        await act(async () => root.render(<DialogHarness command={MarkdownEditorMentionCommand} />));
        expect(button("OK").disabled).toBe(true); expect(caption().value).toBe("Unsaved caption"); expect(textarea().value).toBe("Authored draft");
    });

    it("preserves an existing custom mention caption when reselecting its public identity", async () => {
        const seed = `Before [[song:${song.id}|Authored caption]] after`;
        await act(async () => root.render(<DialogHarness command={MarkdownEditorMentionCommand} seed={seed} />));
        textarea().setSelectionRange(12, 12);
        await act(async () => { Simulate.click(container.querySelector(".toolItem")!); await new Promise(resolve => setTimeout(resolve, 10)); });
        expect(searchInput().value).toBe(`song:${song.id}`); expect(caption().value).toBe("Authored caption");
        await respond([song]); await act(async () => Simulate.keyDown(searchInput(), { key: "ArrowDown" }));
        await act(async () => Simulate.click(document.querySelector('[role="option"]')!));
        expect(caption().value).toBe("Authored caption");
        await act(async () => Simulate.click(button("OK"))); expect(textarea().value).toBe(seed);
    });

    it("retains Wiki selection, canonical slug, custom caption and manual nonexistent links", async () => {
        await open(WikiReferenceCommand); await choose(wiki);
        expect(searchInput().value).toBe(wiki.canonicalWikiSlug); await type(caption(), "Authored caption");
        await type(searchInput(), "future-article"); await act(async () => Simulate.click(button("OK")));
        expect(textarea().value).toContain("[[future-article|Authored caption]]");
    });

    it("uses the picked caption when a different entity type happens to share the authored public-ID text", async () => {
        const seed = `Before [[song:${song.id}|Song caption]] after`;
        await act(async () => root.render(<DialogHarness command={MarkdownEditorMentionCommand} seed={seed} />));
        textarea().setSelectionRange(12, 12);
        await act(async () => { Simulate.click(container.querySelector(".toolItem")!); await new Promise(resolve => setTimeout(resolve, 10)); });
        const differentEntity: QuickSearchItemMatch<Type.user> = { ...person, id: parsePublicId<"User">(song.id) };
        await choose(differentEntity);
        expect(caption().value).toBe(person.name);
    });

    it("expands an existing Wiki reference from the toolbar and retains its caption", async () => {
        const seed = "Before [[band-handbook|Authored title]] after";
        await act(async () => root.render(<DialogHarness command={WikiReferenceCommand} seed={seed} />));
        textarea().setSelectionRange(14, 14);
        await act(async () => { Simulate.click(container.querySelector(".toolItem")!); await new Promise(resolve => setTimeout(resolve, 10)); });
        expect(searchInput().value).toBe("band-handbook"); expect(caption().value).toBe("Authored title");
        await type(caption(), "New title"); await act(async () => Simulate.click(button("OK")));
        expect(textarea().value).toBe("Before [[band-handbook|New title]] after");
    });

    it("rejects a suggestion whose telemetry finishes after the presentation snapshot changes", async () => {
        let finish = () => {};
        telemetry = () => new Promise<void>(resolve => { finish = resolve; });
        await open(MarkdownEditorMentionCommand); await type(searchInput(), "Found"); await respond([song]);
        await act(async () => Simulate.click(document.querySelector('[role="option"]')!));
        snapshot = {}; await act(async () => root.render(<DialogHarness command={MarkdownEditorMentionCommand} />));
        await act(async () => finish());
        expect(button("OK").disabled).toBe(true); expect(textarea().value).toBe("Authored draft");
    });
});
