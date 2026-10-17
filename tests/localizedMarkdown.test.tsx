// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import type { CMButtonProps } from "src/core/components/CMCoreComponents2";
import type { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { BandLocalizedMarkdown, LocalizedMarkdown } from "src/locale/components/LocalizedMarkdown";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { createLocaleApi, type LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { resolveString } from "src/locale/shared/stringResolution";
import type { StaticStringEditorData, StaticStringTarget } from "src/locale/shared/staticStringEdit";

vi.mock("@blitzjs/rpc", () => ({ invoke: (...args: unknown[]) => read(...args), useMutation: () => [mutate] }));
vi.mock("src/locale/queries/getStaticStringEditor", () => ({ default: vi.fn() }));
vi.mock("src/locale/mutations/updateStaticString", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => presentation }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(presentation.data?.localization ?? null) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess, showError }) }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, disabled, onClick }: React.PropsWithChildren<Pick<CMButtonProps, "disabled" | "onClick">>) =>
        <button disabled={disabled} onClick={onClick}>{children}</button>,
    CMButtonGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@mui/material", () => ({
    TextField: ({ label, value, onChange, children }: React.PropsWithChildren<{ label: string; value: string; onChange: React.ChangeEventHandler<HTMLSelectElement> }>) =>
        <select aria-label={label} value={value} onChange={onChange}>{children}</select>,
    MenuItem: ({ value, disabled, children }: React.PropsWithChildren<{ value: string; disabled?: boolean }>) =>
        <option value={value} disabled={disabled}>{children}</option>,
}));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: { markdown: string | null }) => <div data-markdown>{markdown}</div> }));
vi.mock("src/core/components/markdown/MarkdownControl3", () => ({
    Markdown3Editor: (props: React.ComponentProps<typeof Markdown3Editor>) => {
        editorProps = props;
        return <textarea value={props.value} readOnly={props.readonly} onChange={event => props.onChange(event.target.value)} />;
    },
}));

const read = vi.fn();
const mutate = vi.fn();
const invalidate = vi.fn(async () => { });
const showSuccess = vi.fn();
const showError = vi.fn();
const key = "GlobalWikiPage_Markdown";
const bands = [parsePublicId<"Band">("MarkdownBand0001"), parsePublicId<"Band">("MarkdownBand0002")];
let presentation: ReturnType<typeof usePresentation>;
let editorProps: React.ComponentProps<typeof Markdown3Editor>;
let root: Root;
let container: HTMLDivElement;
function fixture(bandPublicId = bands[0]!, routeLocale = "fr-BE"): ReturnType<typeof usePresentation> {
    const input = { bandPublicId, routeLocale, browserLanguages: ["nl-BE"] };
    const preferences = collectLocalePreferences(input);
    const availability = { global: ["en-US", "fr-BE", "nl-BE"], band: ["en-US", "fr-BE", "nl-BE"] };
    // The fixture fills every registry key, matching complete server catalog delivery.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([id, definition]) => [id,
        resolveString({
            preferences, availability, registeredDefault: definition.defaultValue,
            globalValues: id === key ? [{ localeTag: "fr-BE", value: "Inherited help" }] : [], bandValues: []
        }),
    ])) as LocalizationCatalog["strings"];
    return {
        bandPublicId, invalidate, data: {
            queryExecutionTimeMs: 0,
            input, localization: {
                bandPublicId, preferences, availability,
                strings, formattingLocale: routeLocale, cacheKey: routeLocale, payloadBytes: 0
            },
            authorization: {
                bandPublicId, userPublicId: parsePublicId<"User">("MarkdownUser0001"),
                bandUserPublicId: parsePublicId<"BandUser">("MarkdownMember01"), effectivePermissionNames: [Permission.manage_band_localization]
            },
            settings: { global: {}, band: {}, user: {}, bandUser: {} },
        }
    };
}
const button = (label: string) => [...container.querySelectorAll("button")].find(item => item.textContent === label)!;
const textarea = () => container.querySelector("textarea")!;
const row = () => container.querySelector(`[data-localized-markdown="${key}"]`)!;
async function render(element = <BandLocalizedMarkdown id={key} />) {
    await act(async () => root.render(element));
}
async function click(label: string) {
    await act(async () => button(label).click());
}
async function edit(value: string) {
    await act(async () => { textarea().value = value; Simulate.change(textarea()); });
}
async function locale(tag: string) {
    const select = container.querySelector("select")!;
    await act(async () => { select.value = tag; Simulate.change(select); });
}
function grants(permissions: Permission[]) {
    presentation = {
        ...presentation, data: {
            ...presentation.data!, authorization: {
                ...presentation.data!.authorization, effectivePermissionNames: permissions,
            }
        }
    };
}
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    read.mockResolvedValue({ value: null, canSet: true });
    mutate.mockResolvedValue(undefined);
    invalidate.mockResolvedValue(undefined);
    presentation = fixture();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
});

describe("localized Markdown edit workflow", () => {
    it("shows resolved help without fetching or materializing an override", async () => {
        await render();
        expect(row().textContent).toContain("Inherited help");
        expect(read).not.toHaveBeenCalled();
        expect(mutate).not.toHaveBeenCalled();
    });
    it("loads the exact band/locale and starts a missing override empty", async () => {
        await render(); await click("Edit text");
        expect(read.mock.calls[0]?.[1]).toEqual({ key, scope: "band", localeTag: "fr-BE", bandPublicId: bands[0] });
        expect(textarea().value).toBe("");
        expect(button("Save").disabled).toBe(false);
        expect(editorProps.allowUploads).toBe(true);
        expect(editorProps.uploadFileContext).toEqual({ visiblePermission: Permission.visibility_public });
    });
    it("saves an intentional blank and stays open with a clean draft", async () => {
        await render(); await click("Edit text"); await click("Save");
        expect(mutate).toHaveBeenCalledWith({ target: { key, scope: "band", localeTag: "fr-BE", bandPublicId: bands[0] }, operation: { kind: "set", value: "" } });
        expect(invalidate).toHaveBeenCalledOnce();
        expect(textarea().value).toBe("");
        expect(button("Save").disabled).toBe(true);
    });
    it("cancels changes without sending a write", async () => {
        read.mockResolvedValue({ value: "Stored", canSet: true });
        await render(); await click("Edit text"); expect(textarea().value).toBe("Stored");
        await edit("draft"); await click("Cancel");
        expect(textarea()).toBeNull(); expect(mutate).not.toHaveBeenCalled();
    });
    it("closes only after a successful save-and-close", async () => {
        await render(); await click("Edit text"); await edit("new"); await click("Save and close");
        expect(textarea()).toBeNull(); expect(showSuccess).toHaveBeenCalledWith("Text saved.");
    });
    it("retains a failed save-and-close draft and lets the same draft be retried", async () => {
        mutate.mockRejectedValueOnce(new Error("revoked"));
        await render(); await click("Edit text"); await edit("failed draft"); await click("Save and close");
        expect(textarea().value).toBe("failed draft"); expect(invalidate).not.toHaveBeenCalled();
        expect(showError).toHaveBeenCalledWith("Text could not be saved. Your draft is retained.");
        await click("Save and close"); expect(textarea()).toBeNull();
    });
    it("removes an override explicitly instead of saving inherited text", async () => {
        read.mockResolvedValue({ value: "stored", canSet: true });
        await render(); await click("Edit text"); await click("Use inherited content");
        expect(textarea().readOnly).toBe(true);
        await click("Save");
        expect(mutate.mock.calls[0]?.[0].operation).toEqual({ kind: "reset" });
        expect(textarea().value).toBe("");
    });
    it("lets an unavailable locale override be reset but prevents a new value", async () => {
        read.mockResolvedValue({ value: "stored", canSet: false });
        await render(); await click("Edit text");
        expect(textarea().readOnly).toBe(true); expect(button("Save").disabled).toBe(true);
        await click("Use inherited content"); await click("Save");
        expect(mutate.mock.calls[0]?.[0].operation).toEqual({ kind: "reset" });
    });
    it("retains a failed draft across grant refreshes and disables editing after revocation", async () => {
        read.mockResolvedValue({ value: "stored", canSet: true });
        await render(); await click("Edit text"); await edit("retained");
        grants([]); await render(); expect(textarea().value).toBe("retained");
        expect(textarea().readOnly).toBe(true); expect(button("Save").disabled).toBe(true);
        grants([Permission.manage_band_localization]); await render();
        expect(textarea().value).toBe("retained"); expect(textarea().readOnly).toBe(false);
    });
    it("discards a stale exact-locale response after selecting another writing language", async () => {
        let respond: (data: StaticStringEditorData) => void = () => { };
        read.mockImplementationOnce(() => new Promise<StaticStringEditorData>(resolve => { respond = resolve; }));
        await render(); await click("Edit text"); await locale("nl-BE");
        await edit("Dutch draft"); await act(async () => respond({ value: "Old French", canSet: true }));
        expect(textarea().value).toBe("Dutch draft");
        await click("Save"); expect(mutate.mock.calls[0]?.[0].target.localeTag).toBe("nl-BE");
    });
    it("starts another band's independent editor while an old save is pending", async () => {
        let finish: () => void = () => { };
        mutate.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        await render(); await click("Edit text"); await edit("first"); await click("Save and close");
        presentation = fixture(bands[1], "nl-BE"); await render(); await click("Edit text"); await edit("second");
        await act(async () => finish());
        expect(textarea().value).toBe("second"); expect(invalidate).not.toHaveBeenCalled();
        await click("Save"); expect(mutate.mock.calls[1]?.[0].target).toMatchObject({ bandPublicId: bands[1], localeTag: "nl-BE" });
    });
    it("resets unsaved edits on route/browser preference changes", async () => {
        await render(); await click("Edit text"); await edit("French");
        presentation = fixture(bands[0], "nl-BE"); await render();
        expect(textarea()).toBeNull(); await click("Edit text");
        expect(container.querySelector("select")?.value).toBe("nl-BE"); expect(textarea().value).toBe("");
    });
    it("blocks save/cancel during attachment insertion and saving", async () => {
        await render(); await click("Edit text");
        await act(async () => editorProps.onUploadBusyChange?.(true));
        expect(button("Save").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true);
        await act(async () => editorProps.onUploadBusyChange?.(false));
        let finish: () => void = () => { };
        mutate.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        await click("Save"); await click("Save"); expect(mutate).toHaveBeenCalledOnce();
        await act(async () => finish());
    });
    it("reports display refresh failure separately after a committed save", async () => {
        invalidate.mockRejectedValueOnce(new Error("offline"));
        await render(); await click("Edit text"); await edit("committed"); await click("Save");
        expect(textarea().value).toBe("committed"); expect(button("Save").disabled).toBe(true);
        expect(showError).toHaveBeenCalledWith("Text was saved, but the display could not be refreshed.");
    });
    it("recovers from exact-value read failure with retry or cancellation", async () => {
        read.mockRejectedValueOnce(new Error("offline"));
        await render(); await click("Edit text"); expect(container.textContent).toContain("Saved text could not be loaded.");
        await click("Retry"); expect(textarea()).not.toBeNull(); await click("Cancel"); expect(textarea()).toBeNull();
    });
    it("withholds edit controls from another band's reader or an anonymous visitor", async () => {
        grants([]); await render(); expect(button("Edit text")).toBeUndefined();
        presentation = { ...presentation, data: { ...presentation.data!, authorization: { ...presentation.data!.authorization, userPublicId: null } } };
        await render(); expect(read).not.toHaveBeenCalled();
    });
    it("supports an explicit platform scope while disabling band attachments", async () => {
        grants([Permission.manage_global_localization]);
        await render(<LocalizedMarkdown id={key} scope="global" editLocale="fr-BE" onEditLocaleChange={() => { }}
            attachments={{ kind: "disabled" }} />); await click("Edit text");
        const request: StaticStringTarget = read.mock.calls[0]?.[1]; expect(request.scope).toBe("global");
        expect(editorProps.allowUploads).toBe(false); expect(editorProps.uploadFileContext).toBeUndefined();
        await click("Save"); expect(mutate.mock.calls[0]?.[0].target.scope).toBe("global");
    });
    it("keeps an explicit display fallback out of the editable draft", async () => {
        presentation = {
            ...presentation, data: {
                ...presentation.data!, localization: {
                    ...presentation.data!.localization,
                    strings: { ...presentation.data!.localization.strings, [key]: { ...presentation.data!.localization.strings[key], value: null } },
                }
            }
        };
        await render(<LocalizedMarkdown id={key} scope="band" editLocale="fr-BE" onEditLocaleChange={() => { }}
            attachments={{ kind: "disabled" }} fallbackMarkdown="Display fallback" />);
        expect(row().textContent).toContain("Display fallback");
        await click("Edit text"); expect(textarea().value).toBe(""); await click("Save");
        expect(mutate.mock.calls[0]?.[0].operation).toEqual({ kind: "set", value: "" });
    });
    it("preserves intentional blanks instead of automatically displaying a fallback", async () => {
        presentation = {
            ...presentation, data: {
                ...presentation.data!, localization: {
                    ...presentation.data!.localization,
                    strings: { ...presentation.data!.localization.strings, [key]: { ...presentation.data!.localization.strings[key], value: "" } },
                }
            }
        };
        read.mockResolvedValue({ value: "", canSet: true });
        await render(<LocalizedMarkdown id={key} scope="band" editLocale="fr-BE" onEditLocaleChange={() => { }}
            attachments={{ kind: "disabled" }} fallbackMarkdown="Display fallback" />);
        expect(row().textContent).not.toContain("Display fallback");
        await click("Edit text"); expect(textarea().value).toBe(""); expect(button("Save").disabled).toBe(true);
    });
    it("disables new writes after locale availability changes while retaining an existing draft", async () => {
        read.mockResolvedValue({ value: "stored", canSet: true });
        await render(); await click("Edit text"); await edit("retained");
        presentation = {
            ...presentation, data: {
                ...presentation.data!, localization: {
                    ...presentation.data!.localization,
                    availability: { ...presentation.data!.localization.availability, band: ["en-US", "nl-BE"] },
                }
            }
        };
        read.mockResolvedValue({ value: "stored", canSet: false });
        await render(); expect(textarea().value).toBe("retained"); expect(textarea().readOnly).toBe(true);
        expect(button("Save").disabled).toBe(true);
        await click("Use inherited content"); await click("Save");
        expect(mutate.mock.calls[0]?.[0].operation).toEqual({ kind: "reset" });
    });
    it("explains revoked access while an exact-value read is still pending and discards its late response", async () => {
        let respond: (data: StaticStringEditorData) => void = () => { };
        read.mockImplementationOnce(() => new Promise<StaticStringEditorData>(resolve => { respond = resolve; }));
        await render(); await click("Edit text"); grants([]); await render();
        expect(container.textContent).toContain("Text editing is unavailable in this scope.");
        await act(async () => respond({ value: "stale", canSet: true })); expect(textarea()).toBeNull();
        await click("Cancel"); expect(mutate).not.toHaveBeenCalled();
    });
});
