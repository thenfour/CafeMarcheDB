// @vitest-environment jsdom
import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "@blitzjs/auth";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { PresentationProvider, invalidatePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useBandSettings, useUserSettings } from "src/setting/client/useSettings";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import { kStaticLocalizedStringRegistry } from "src/locale/shared/staticLocalizedStringRegistry";
import { resolveString } from "src/locale/shared/stringResolution";
import type { PresentationData } from "src/locale/shared/presentationContext";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import type { LocalizationCatalog } from "src/locale/shared/localizationCatalog";
import { parsePublicId, type BandPublicId } from "shared/publicId";
import { CalendarUserSettingsControl } from "src/core/components/user/UserSettingsControls";
import { queryClient } from "src/blitz-client";

vi.mock("@blitzjs/rpc", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("@blitzjs/auth", () => ({ useSession: vi.fn() }));
vi.mock("src/blitz-client", () => ({ queryClient: { invalidateQueries: vi.fn(async () => {}) } }));
vi.mock("src/locale/queries/getPresentationData", () => ({ default: vi.fn() }));
vi.mock("src/setting/server/mutations/updateSetting", () => ({ default: vi.fn() }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showSuccess: () => {}, showError: showPreferenceError }) }));

let root: Root;
let container: HTMLDivElement;
let sessionUserId: number | null;
let serverText: string;
let declined: boolean;
let uninvited: boolean;
const mutate = vi.fn();
const showPreferenceError = vi.fn();
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const firstBand = parsePublicId<"Band">("Band000000000001");
const secondBand = parsePublicId<"Band">("Band000000000002");

function dataFor(input: PresentationInput): PresentationData {
    const preferences = collectLocalePreferences(input);
    const band = input.bandPublicId ?? null;
    const availability = { global: ["en-US", "fr-BE", "nl-BE"], band: ["en-US", "fr-BE", "nl-BE"] };
    // Every registry key is resolved here, as in the server's catalog builder.
    const strings = Object.fromEntries(Object.entries(kStaticLocalizedStringRegistry).map(([key, entry]) => [key,
        resolveString({ preferences, availability, globalValues: key === "common.action.ok"
            ? [{ localeTag: "en-US", value: `${serverText}/${band ?? "platform"}` }] : [], bandValues: [], registeredDefault: entry.defaultValue }),
    ])) as LocalizationCatalog["strings"];
    return {
        input, authorization: { bandPublicId: band, userPublicId: sessionUserId ? parsePublicId<"User">("User000000000042") : null,
            bandUserPublicId: null, effectivePermissionNames: [] },
        localization: { bandPublicId: band, preferences, availability, strings, formattingLocale: selectFormattingLocale(preferences), cacheKey: "fixture", payloadBytes: 1 },
        settings: { global: {}, band: band ? { "siteCustomization.title": { value: band, source: "stored", capabilities: { canView: true, canEdit: true } } } : {},
            user: { "calendar.showDeclinedEvents": { value: declined, source: "stored", capabilities: { canView: true, canEdit: true } },
                "calendar.showUninvitedEvents": { value: uninvited, source: "default", capabilities: { canView: true, canEdit: true } } }, bandUser: {} },
    };
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    sessionUserId = 42; serverText = "Initial"; declined = true; uninvited = true;
    mutate.mockReset();
    showPreferenceError.mockClear();
    // The mock exposes only the session fields and query methods used by these hooks.
    vi.mocked(useSession).mockImplementation(() => ({ userId: sessionUserId, permissionNames: [] }) as unknown as ReturnType<typeof useSession>);
    vi.mocked(useQuery).mockImplementation((_query, input, options) => [options?.initialData ?? dataFor(input), { refetch: vi.fn() }] as unknown as ReturnType<typeof useQuery>);
    vi.mocked(useMutation).mockReturnValue([mutate, {}] as unknown as ReturnType<typeof useMutation>);
    vi.mocked(queryClient.invalidateQueries).mockClear();
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove(); vi.restoreAllMocks();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

function Probe() {
    const locale = useLocale(), settings = useBandSettings();
    return <span>{locale.getPlainString("common.action.ok")}|{locale.formattingLocale}|{settings.getCapabilities("siteCustomization.title").canView ? settings.getValue("siteCustomization.title") : "platform"}</span>;
}

describe("presentation and settings delivery", () => {
    it("reuses the SSR preferences on first render and refetches after browser preferences change", async () => {
        const initial = dataFor({ browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}><Probe /></PresentationProvider>));
        expect(container.textContent).toContain("en-US");
        expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ initialData: initial, enabled: false }));
        vi.spyOn(navigator, "languages", "get").mockReturnValue(["nl-BE", "en-US"]);
        await act(async () => window.dispatchEvent(new Event("languagechange")));
        expect(container.textContent).toContain("nl-BE");
        expect(useQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ browserLanguages: ["nl-BE", "en-US"] }), expect.anything());
    });
    it("drops old band and account snapshots on switches", async () => {
        const initial = dataFor({ bandPublicId: firstBand, browserLanguages: ["en-US"] });
        const render = (bandPublicId: BandPublicId | null) => root.render(<PresentationProvider initial={initial} bandPublicId={bandPublicId}><Probe /></PresentationProvider>);
        await act(async () => render(firstBand));
        expect(container.textContent).toContain("Band000000000001");
        await act(async () => render(secondBand));
        expect(container.textContent).not.toContain("Band000000000001");
        const oldRequests = vi.mocked(useQuery).mock.calls.map(call => call[1].clientRequestId);
        sessionUserId = 43;
        await act(async () => render(secondBand));
        expect(vi.mocked(useQuery).mock.lastCall?.[1].clientRequestId).not.toBe(oldRequests[oldRequests.length - 1]);
        await act(async () => render(null));
        expect(container.textContent).toContain("platform");
        expect(container.textContent).not.toContain("Band000000000002");
        expect(vi.mocked(useQuery).mock.lastCall?.[1].bandPublicId).toBeNull();
    });
    it("refreshes when returning to the SSR band instead of resurrecting its old snapshot", async () => {
        const initial = dataFor({ bandPublicId: firstBand, browserLanguages: ["en-US"] });
        const render = (bandPublicId: BandPublicId | null) => root.render(<PresentationProvider initial={initial} bandPublicId={bandPublicId}><Probe /></PresentationProvider>);
        await act(async () => render(firstBand));
        serverText = "Fresh after switch";
        await act(async () => render(null));
        await act(async () => render(firstBand));
        expect(container.textContent).toContain("Fresh after switch");
    });
    it("invalidates initial catalogs and settings after writes and remote/focus changes", async () => {
        const initial = dataFor({ browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}><Probe /></PresentationProvider>));
        serverText = "Updated";
        await act(async () => invalidatePresentation());
        expect(container.textContent).toContain("Updated");
        expect(queryClient.invalidateQueries).toHaveBeenCalled();
        serverText = "Other tab";
        await act(async () => window.dispatchEvent(new StorageEvent("storage", { key: "cmdb-presentation-changed" })));
        expect(container.textContent).toContain("Other tab");
        serverText = "Fresh grants";
        await act(async () => window.dispatchEvent(new Event("focus")));
        expect(container.textContent).toContain("Fresh grants");
    });
    it.each(["calendar.showDeclinedEvents", "calendar.showUninvitedEvents"] as const)("saves %s and refreshes every mounted calendar preference control", async key => {
        mutate.mockImplementation(async input => {
            if (key === "calendar.showDeclinedEvents") {
                declined = input.operation.value;
            } else {
                uninvited = input.operation.value;
            }
        });
        const initial = dataFor({ bandPublicId: firstBand, browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}>
            <CalendarUserSettingsControl /><CalendarUserSettingsControl />
        </PresentationProvider>));
        const inputs = () => [...container.querySelectorAll<HTMLInputElement>(`input[name="${key}"]`)];
        expect(inputs().map(input => input.checked)).toEqual([true, true]);
        await act(async () => inputs()[0]!.click());
        expect(mutate).toHaveBeenCalledWith({ hive: "user", key, operation: { kind: "set", value: false },
            bandPublicId: firstBand });
        expect(inputs().map(input => input.checked)).toEqual([false, false]);
    });
    it.each(["calendar.showDeclinedEvents", "calendar.showUninvitedEvents"] as const)("retains %s and reports a failed save", async key => {
        mutate.mockRejectedValueOnce(new Error("Permission revoked"));
        const initial = dataFor({ bandPublicId: firstBand, browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}><CalendarUserSettingsControl /></PresentationProvider>));
        const input = container.querySelector<HTMLInputElement>(`input[name="${key}"]`)!;
        await act(async () => input.click());
        expect(input.checked).toBe(true);
        expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
        expect(showPreferenceError).toHaveBeenCalledWith("Could not save your calendar preference. Please try again.");
    });
    it("keeps stored values after failed mutations and makes reset explicit", async () => {
        let actions: ReturnType<typeof useUserSettings> | undefined;
        function Actions() { actions = useUserSettings(); return <span>{String(actions.getValue("calendar.showDeclinedEvents"))}</span>; }
        const initial = dataFor({ browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}><Actions /></PresentationProvider>));
        mutate.mockRejectedValueOnce(new Error("Denied"));
        await expect(actions!.setValue("calendar.showDeclinedEvents", false)).rejects.toThrow("Denied");
        expect(container.textContent).toBe("true");
        expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
        mutate.mockResolvedValueOnce(undefined);
        await act(async () => actions!.reset("calendar.showDeclinedEvents"));
        expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({ operation: { kind: "reset" } }));
    });
    it("never shows old strings or settings while a new band is loading", async () => {
        const initial = dataFor({ bandPublicId: firstBand, browserLanguages: ["en-US"] });
        await act(async () => root.render(<PresentationProvider initial={initial}><Probe /></PresentationProvider>));
        let release: () => void = () => {};
        const pending = new Promise<void>(resolve => { release = resolve; });
        let loading = true;
        // A pending query suspends the new band exactly as Blitz's query hook does.
        vi.mocked(useQuery).mockImplementation((_query, input) => {
            if (loading) throw pending;
            // Only data/refetch are needed; React Query's unused state is omitted in this test double.
            return [dataFor(input), { refetch: vi.fn() }] as unknown as ReturnType<typeof useQuery>;
        });
        await act(async () => root.render(<PresentationProvider initial={initial} bandPublicId={secondBand}><Probe /></PresentationProvider>));
        expect(container.textContent).not.toContain("Band000000000001");
        expect(container.textContent).toContain("Loading");
        loading = false;
        await act(async () => release());
        expect(container.textContent).toContain("Band000000000002");
    });

    it("keeps a form mounted when the SSR snapshot is invalidated in the same scope", async () => {
        const initial = dataFor({ browserLanguages: ["en-US"] });
        function Draft() {
            const [draft, setDraft] = React.useState("saved");
            return <button onClick={() => setDraft("unsaved")}>{draft}</button>;
        }
        await act(async () => root.render(<PresentationProvider initial={initial}><Draft /></PresentationProvider>));
        await act(async () => container.querySelector("button")!.click());
        await act(async () => invalidatePresentation());
        expect(container.querySelector("button")?.textContent).toBe("unsaved");
    });
});
