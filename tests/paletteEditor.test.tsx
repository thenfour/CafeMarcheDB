// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { CMButtonProps } from "src/core/components/CMCoreComponents2";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { createLocaleApi, type LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { resolveString } from "src/locale/shared/stringResolution";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import ColorEditorPage from "src/pages/backstage/colorEditor2";

vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [mutate] }));
vi.mock("src/setting/server/mutations/updateSetting", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => presentation }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(presentation.data?.localization ?? null) }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
vi.mock("src/core/components/CMCoreComponents", () => ({
    CMSinglePageSurfaceCard: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
    OpenCloseIcon: () => null,
}));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, disabled, onClick }: React.PropsWithChildren<Pick<CMButtonProps, "disabled" | "onClick">>) =>
        <button disabled={disabled} onClick={onClick}>{children}</button>,
}));
vi.mock("src/core/components/color/ColorPageUtils", () => ({
    ColorBlender: () => null, FindClosestColorMatch: vi.fn(), PaletteEntryEditor: () => null,
    SwatchTempPalette: () => null, UserPaletteGrid: () => null,
}));
vi.mock("src/core/components/color/ColorPaletteListComponent", () => ({ ColorPaletteListComponent: () => null }));

const mutate = vi.fn();
const invalidate = vi.fn(async () => {});
const showMessage = vi.fn();
const bandA = parsePublicId<"Band">("Band000000000001");
const bandB = parsePublicId<"Band">("Band000000000002");
const key = "global.dev.textPalette";
let presentation: ReturnType<typeof usePresentation>;
let root: Root;
let container: HTMLDivElement;

function fixture(value = "#ffffff", canEdit = true): ReturnType<typeof usePresentation> {
    const input = { bandPublicId: bandA, browserLanguages: ["en-US"] };
    const preferences = collectLocalePreferences(input);
    const availability = { global: ["en-US"], band: ["en-US"] };
    // Populate the registered labels, matching the presentation transport.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([name, definition]) => [name,
        resolveString({ preferences, availability, registeredDefault: definition.defaultValue, globalValues: [], bandValues: [] }),
    ])) as LocalizationCatalog["strings"];
    return { bandPublicId: bandA, invalidate, data: {
        input, authorization: { bandPublicId: bandA, userPublicId: parsePublicId<"User">("User000000000001"),
            bandUserPublicId: null, effectivePermissionNames: [] },
        localization: { bandPublicId: bandA, preferences, availability, strings, formattingLocale: "en-US", cacheKey: "palette", payloadBytes: 0 },
        settings: { global: { [key]: { value, source: "stored", capabilities: { canView: true, canEdit } } }, band: {}, user: {}, bandUser: {} },
    } };
}

async function render() {
    await act(async () => root.render(<SnackbarContext.Provider value={{ showMessage, showSuccess: vi.fn(), showError: vi.fn(), invokeAsync: vi.fn() }}>
        <ColorEditorPage />
    </SnackbarContext.Provider>));
}

async function openTextPalette() {
    const header = [...container.querySelectorAll<HTMLDivElement>(".header")].find(element => element.textContent?.includes("Text palette"))!;
    await act(async () => header.click());
}

function saveButton(): HTMLButtonElement {
    return [...container.querySelectorAll("button")].find(button => button.textContent === "Save")!;
}

async function edit(value: string) {
    const textarea = container.querySelector("textarea")!;
    await act(async () => {
        textarea.value = value;
        Simulate.change(textarea);
    });
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mutate.mockReset();
    invalidate.mockReset().mockResolvedValue(undefined);
    showMessage.mockClear();
    presentation = fixture();
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("palette setting recovery", () => {
    it("waits for settings and hides the palette when the protected key is unavailable", async () => {
        presentation = { ...presentation, data: null };
        await render();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        presentation = fixture();
        presentation = { ...presentation, data: { ...presentation.data!, settings: { global: {}, band: {}, user: {}, bandUser: {} } } };
        await render();
        expect(container.textContent).toContain("requires platform administrator access");
        expect(container.querySelector(".paletteeditor2")).toBeNull();
        expect(mutate).not.toHaveBeenCalled();
    });

    it.each([bandA, bandB, null])("saves an intentional blank to the global hive with band context %s", async bandPublicId => {
        presentation = { ...presentation, bandPublicId };
        await render();
        await openTextPalette();
        expect(saveButton().disabled).toBe(true);
        await edit("");
        await act(async () => saveButton().click());
        expect(mutate).toHaveBeenCalledWith({ hive: "global", key, bandPublicId, operation: { kind: "set", value: "" } });
        expect(invalidate).toHaveBeenCalledOnce();
        expect(showMessage).toHaveBeenCalledWith({ severity: "success", children: "Setting saved." });
    });

    it("keeps read-only previews available without exposing a write", async () => {
        presentation = fixture("#ffffff", false);
        await render();
        await openTextPalette();
        await edit("#000000");
        expect(saveButton().disabled).toBe(true);
        await act(async () => saveButton().click());
        expect(mutate).not.toHaveBeenCalled();
    });

    it("prevents concurrent saves and retains edits made while the first save is pending", async () => {
        let finish: () => void = () => {};
        mutate.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        await render();
        await openTextPalette();
        await edit("#000000");
        await act(async () => { saveButton().click(); saveButton().click(); });
        expect(saveButton().disabled).toBe(true);
        expect(mutate).toHaveBeenCalledOnce();
        await edit("#ff0000");
        presentation = fixture("#000000");
        await render();
        await act(async () => finish());
        expect(container.querySelector("textarea")?.value).toBe("#ff0000");
        expect(saveButton().disabled).toBe(false);
    });

    it.each(["write", "refresh"])("retains the draft after a failed %s and permits retry", async stage => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        if (stage === "write") {
            mutate.mockRejectedValueOnce(new Error("permission revoked"));
        } else {
            invalidate.mockRejectedValueOnce(new Error("refresh failed"));
        }
        await render();
        await openTextPalette();
        await edit("#123456");
        await act(async () => saveButton().click());
        expect(container.querySelector("textarea")?.value).toBe("#123456");
        expect(saveButton().disabled).toBe(false);
        expect(showMessage).toHaveBeenCalledWith({ severity: "error", children: expect.stringContaining("Your changes are retained") });
        await act(async () => saveButton().click());
        expect(mutate).toHaveBeenCalledTimes(2);
    });

    it("refreshes untouched values, preserves dirty drafts, and clears them on an account switch", async () => {
        await render();
        await openTextPalette();
        presentation = fixture("#000000");
        await render();
        expect(container.querySelector("textarea")?.value).toBe("#000000");
        await edit("#123456");
        presentation = fixture("#ff0000");
        await render();
        expect(container.querySelector("textarea")?.value).toBe("#123456");
        presentation = { ...presentation, data: { ...presentation.data!, authorization: { ...presentation.data!.authorization,
            userPublicId: parsePublicId<"User">("User000000000002") } } };
        await render();
        await openTextPalette();
        expect(container.querySelector("textarea")?.value).toBe("#ff0000");
    });
});
