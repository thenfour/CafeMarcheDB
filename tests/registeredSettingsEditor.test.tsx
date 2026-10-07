// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CMButtonProps } from "src/core/components/CMCoreComponents2";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { createLocaleApi, type LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import { resolveString } from "src/locale/shared/stringResolution";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { RegisteredSettingsEditor } from "src/setting/client/components/RegisteredSettingsEditor";
import type { SettingsHive, SettingsSnapshot } from "src/setting/shared/settingsContract";
import { parsePublicId } from "shared/publicId";

vi.mock("@blitzjs/rpc", () => ({ useMutation: () => [mutate] }));
vi.mock("src/setting/server/mutations/updateBulkSettings", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => presentation }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => createLocaleApi(presentation.data?.localization ?? null) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess, showError }) }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: ({ children, disabled, onClick }: React.PropsWithChildren<Pick<CMButtonProps, "disabled" | "onClick">>) =>
        <button disabled={disabled} onClick={onClick}>{children}</button>,
    CMButtonGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

const mutate = vi.fn();
const invalidate = vi.fn(async () => {});
const showSuccess = vi.fn();
const showError = vi.fn();
const readClipboard = vi.fn();
const writeClipboard = vi.fn();
const bandA = parsePublicId<"Band">("Band000000000001");
const bandB = parsePublicId<"Band">("Band000000000002");
let presentation: ReturnType<typeof usePresentation>;
let root: Root;
let container: HTMLDivElement;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function fixture(bandPublicId = bandA, userPublicId = parsePublicId<"User">("User000000000001")): ReturnType<typeof usePresentation> {
    const input = { bandPublicId, browserLanguages: ["en-US"] };
    const preferences = collectLocalePreferences(input);
    const availability = { global: ["en-US"], band: ["en-US"] };
    // Populate the full registry, matching the server's presentation contract.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([key, definition]) => [key,
        resolveString({ preferences, availability, registeredDefault: definition.defaultValue, globalValues: [], bandValues: [] }),
    ])) as LocalizationCatalog["strings"];
    return { bandPublicId, invalidate, data: {
        input, authorization: { bandPublicId, userPublicId,
            bandUserPublicId: parsePublicId<"BandUser">("Member0000000001"), effectivePermissionNames: [] },
        localization: { bandPublicId, preferences, availability, strings, formattingLocale: "en-US", cacheKey: "settings", payloadBytes: 0 },
        settings: { global: {}, band: {
            "siteCustomization.title": { value: bandPublicId, source: "stored", capabilities: { canView: true, canEdit: true } },
        }, user: {}, bandUser: {} },
    } };
}

function setSettings(settings: SettingsSnapshot) {
    presentation = { ...presentation, data: { ...presentation.data!, settings } };
}

function row(key = "siteCustomization.title"): HTMLDivElement {
    return container.querySelector<HTMLDivElement>(`[data-settings-key="${key}"]`)!;
}

function button(label: string, within: ParentNode = container): HTMLButtonElement {
    return [...within.querySelectorAll("button")].find(button => button.textContent === label)!;
}

async function edit(value: string, key = "siteCustomization.title") {
    const input = row(key).querySelector("input")!;
    await act(async () => {
        input.value = value;
        Simulate.change(input);
    });
}

async function render(hive: SettingsHive = "band") {
    await act(async () => root.render(<RegisteredSettingsEditor hive={hive} />));
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mutate.mockReset();
    invalidate.mockClear();
    showSuccess.mockClear();
    showError.mockClear();
    readClipboard.mockReset();
    writeClipboard.mockReset();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: readClipboard, writeText: writeClipboard } });
    presentation = fixture();
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    if (originalActEnvironment) {
        Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    } else {
        Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
    if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
        Reflect.deleteProperty(navigator, "clipboard");
    }
});

describe("registered settings editor", () => {
    it("does not expose values or request strings before presentation loads", async () => {
        presentation = { ...presentation, data: null };
        await render();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(container.querySelector("input")).toBeNull();
        expect(mutate).not.toHaveBeenCalled();
    });

    it("saves an intentional blank to the explicit band and awaits presentation refresh", async () => {
        let finish: () => void = () => {};
        mutate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
        await render();
        await edit("");
        await act(async () => button("Save", row()).click());
        expect(mutate).toHaveBeenCalledWith({ bandPublicId: bandA,
            commands: [{ hive: "band", key: "siteCustomization.title", operation: { kind: "set", value: "" } }] });
        expect(button("Save", row()).disabled).toBe(true);
        expect(invalidate).not.toHaveBeenCalled();
        expect(showSuccess).not.toHaveBeenCalled();
        await act(async () => finish());
        expect(invalidate).toHaveBeenCalledOnce();
        expect(showSuccess).toHaveBeenCalledWith("Setting saved.");
    });

    it("uses an explicit reset operation and preserves the draft when saving fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mutate.mockRejectedValueOnce(new Error("Revoked grant"));
        await render();
        await edit("Unsaved title");
        await act(async () => button("Save", row()).click());
        expect(row().querySelector("input")?.value).toBe("Unsaved title");
        expect(invalidate).not.toHaveBeenCalled();
        expect(showError).toHaveBeenCalled();
        mutate.mockResolvedValueOnce(undefined);
        await act(async () => button("Reset to default", row()).click());
        expect(mutate).toHaveBeenLastCalledWith({ bandPublicId: bandA,
            commands: [{ hive: "band", key: "siteCustomization.title", operation: { kind: "reset" } }] });
        expect(row().querySelector("input")?.value).toBe("Backstage");
    });

    it("discards old drafts when switching bands or accounts", async () => {
        await render();
        await edit("Old draft");
        presentation = fixture(bandB);
        await render();
        expect(row().querySelector("input")?.value).toBe(bandB);
        await edit("Account A draft");
        presentation = fixture(bandB, parsePublicId<"User">("User000000000002"));
        await render();
        expect(row().querySelector("input")?.value).toBe(bandB);
        expect(mutate).not.toHaveBeenCalled();
    });

    it("updates untouched values on refresh while retaining unsaved changes", async () => {
        await render();
        const settings = presentation.data!.settings;
        const title = settings.band["siteCustomization.title"]!;
        setSettings({ ...settings, band: { "siteCustomization.title": { ...title, value: "Remote edit" } } });
        await render();
        expect(row().querySelector("input")?.value).toBe("Remote edit");
        await edit("Local draft");
        setSettings({ ...settings, band: { "siteCustomization.title": { ...title, value: "Second remote edit" } } });
        await render();
        expect(row().querySelector("input")?.value).toBe("Local draft");
        await act(async () => button("Cancel", row()).click());
        expect(row().querySelector("input")?.value).toBe("Second remote edit");
    });

    it("hides protected entries and removes writes after permission revocation", async () => {
        await render();
        await edit("Draft");
        const settings = presentation.data!.settings;
        setSettings({ ...settings, band: {
            "siteCustomization.title": { value: "Read only", source: "stored", capabilities: { canView: true, canEdit: false } },
            "ical.calendarName": { value: "Secret", source: "stored", capabilities: { canView: false, canEdit: false } },
        } });
        await render();
        expect(row().querySelector("input")?.disabled).toBe(true);
        expect(button("Save", row())).toBeUndefined();
        expect(container.textContent).not.toContain("Secret");
        expect(button("Import from clipboard")).toBeUndefined();
        expect(mutate).not.toHaveBeenCalled();
    });

    it("validates time zones before enabling a save", async () => {
        setSettings({ ...presentation.data!.settings, band: {
            "dateTime.bandTimeZone": { value: "Europe/Brussels", source: "stored", capabilities: { canView: true, canEdit: true } },
        } });
        await render();
        await edit("Invalid/Zone", "dateTime.bandTimeZone");
        expect(button("Save", row("dateTime.bandTimeZone")).disabled).toBe(true);
        expect(mutate).not.toHaveBeenCalled();
    });

    it("keeps boolean values typed and explicitly resets default-backed rows", async () => {
        setSettings({ ...presentation.data!.settings, user: {
            "calendar.showDeclinedEvents": { value: true, source: "default", capabilities: { canView: true, canEdit: true } },
        } });
        await render("user");
        const key = "calendar.showDeclinedEvents";
        expect(button("Reset to default", row(key)).disabled).toBe(true);
        await act(async () => row(key).querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
        await act(async () => button("Save", row(key)).click());
        expect(mutate).toHaveBeenCalledWith({ bandPublicId: bandA,
            commands: [{ hive: "user", key, operation: { kind: "set", value: false } }] });
    });

    it("lets the user choose a settings scope explicitly", async () => {
        await act(async () => root.render(<RegisteredSettingsEditor />));
        expect(container.querySelector("[data-settings-key]")).toBeNull();
        const scope = container.querySelector("input")!;
        await act(async () => {
            scope.value = "band";
            Simulate.change(scope);
        });
        expect(row().querySelector("input")?.value).toBe(bandA);
        expect(mutate).not.toHaveBeenCalled();
    });

    it("renders enum selections and sends their registered string values", async () => {
        const key = "global.ui.visiblePermission.selectStyle";
        setSettings({ ...presentation.data!.settings, global: {
            [key]: { value: "inline", source: "default", capabilities: { canView: true, canEdit: true } },
        } });
        await render("global");
        const input = row(key).querySelector("input")!;
        await act(async () => {
            input.value = "dialog";
            Simulate.change(input);
        });
        expect(row(key).textContent).toContain("Dialog");
        await act(async () => button("Save", row(key)).click());
        expect(mutate).toHaveBeenCalledWith({ bandPublicId: bandA,
            commands: [{ hive: "global", key, operation: { kind: "set", value: "dialog" } }] });
    });

    it("imports a validated batch and never sends a partially invalid batch", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await render();
        readClipboard.mockResolvedValueOnce('[{"key":"siteCustomization.title","value":""},{"key":"unknown","value":"x"}]');
        await act(async () => button("Import from clipboard").click());
        expect(mutate).not.toHaveBeenCalled();
        expect(showError).toHaveBeenCalled();
        readClipboard.mockResolvedValueOnce('[{"key":"siteCustomization.title","value":"Imported"}]');
        await act(async () => button("Import from clipboard").click());
        expect(mutate).toHaveBeenCalledWith({ bandPublicId: bandA,
            commands: [{ hive: "band", key: "siteCustomization.title", operation: { kind: "set", value: "Imported" } }] });
        expect(invalidate).toHaveBeenCalledOnce();
    });

    it("abandons a pending clipboard read if the selected band changes", async () => {
        let finish: (text: string) => void = () => {};
        readClipboard.mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
        await render();
        await act(async () => button("Import from clipboard").click());
        presentation = fixture(bandB);
        await render();
        await act(async () => finish('[{"key":"siteCustomization.title","value":"Old import"}]'));
        expect(mutate).not.toHaveBeenCalled();
        expect(row().querySelector("input")?.value).toBe(bandB);
    });

    it("copies only the displayed scope without owner IDs", async () => {
        await render();
        await act(async () => button("Copy settings").click());
        expect(JSON.parse(writeClipboard.mock.calls[0]![0])).toEqual([{ key: "siteCustomization.title", value: bandA }]);
    });
});
