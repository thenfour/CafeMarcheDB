// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { AppContextMarker } from "src/core/components/AppContext";
import { ActivityFeature, ClientActionRequestSchema, collectDeviceInfo, type ClientActivityParams, type DeviceInfo } from "src/core/components/featureReports/activityTracking";
import { useClientTelemetryEvent } from "src/core/components/featureReports/useClientTelemetryEvent";

vi.mock("@blitzjs/auth", () => ({ getAntiCSRFToken: () => antiCSRFToken }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => presentation }));
vi.mock("src/core/components/featureReports/activityTracking", async () => {
    const actual = await vi.importActual<typeof import("src/core/components/featureReports/activityTracking")>("src/core/components/featureReports/activityTracking");
    return { ...actual, collectDeviceInfo: vi.fn(async () => ({ language: "de", locale: "de-DE" })) };
});

const bandA = parsePublicId<"Band">("TelemetryBand001");
const bandB = parsePublicId<"Band">("TelemetryBand002");
const songA = parsePublicId<"Song">("TelemetrySong001");
const songB = parsePublicId<"Song">("TelemetrySong002");
let presentation: { data: { input: PresentationInput } | null; bandPublicId: typeof bandA | null };
let antiCSRFToken: string | undefined;
let container: HTMLDivElement;
let root: Root;
let record: (args: ClientActivityParams) => Promise<void>;
const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true }));

function Recorder() {
    record = useClientTelemetryEvent("component");
    return null;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    vi.mocked(collectDeviceInfo).mockResolvedValue({ language: "de", locale: "de-DE" });
    antiCSRFToken = "csrf-token";
    presentation = { data: { input: { bandPublicId: bandA, routeLocale: "fr-BE", browserLanguages: ["nl-BE"] } }, bandPublicId: bandA };
    window.history.replaceState(null, "", "/before");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

async function render(songId = songA) {
    await act(async () => root.render(<AppContextMarker name="parent" songId={songId}><Recorder /></AppContextMarker>));
}

function deliveredRequest() {
    const init = fetchMock.mock.calls[0]![1];
    if (typeof init.body !== "string") {
        throw new Error("Expected JSON telemetry body.");
    }
    return ClientActionRequestSchema.parse(JSON.parse(init.body));
}

describe("telemetry delivery", () => {
    it("sends explicit presentation context and retains authenticated keepalive delivery", async () => {
        await render();
        await record({ feature: ActivityFeature.song_view, context: "view" });
        expect(fetchMock).toHaveBeenCalledWith("/api/telemetry", expect.objectContaining({
            method: "POST", keepalive: true, headers: [["Content-Type", "application/json"], ["anti-csrf", "csrf-token"]],
        }));
        expect(deliveredRequest()).toMatchObject({ event: { songId: songA, context: "/parent/component/view", deviceInfo: { locale: "de-DE" } },
            presentation: { bandPublicId: bandA, routeLocale: "fr-BE", browserLanguages: ["nl-BE"] } });
        expect(deliveredRequest().event).not.toHaveProperty("stack");
    });

    it("keeps the original band, locale, URI and association during asynchronous collection", async () => {
        let finishDevice = () => {};
        vi.mocked(collectDeviceInfo).mockImplementationOnce(() => new Promise<DeviceInfo>(resolve => {
            finishDevice = () => resolve({ language: "de" });
        }));
        await render();
        const pending = record({ feature: ActivityFeature.song_view });
        const originalUri = window.location.href;
        presentation = { data: { input: { bandPublicId: bandB, routeLocale: "nl-BE" } }, bandPublicId: bandB };
        window.history.replaceState(null, "", "/after");
        await render(songB);
        finishDevice();
        await pending;
        expect(deliveredRequest()).toMatchObject({ event: { songId: songA, uri: originalUri },
            presentation: { bandPublicId: bandA, routeLocale: "fr-BE" } });
        await record({ feature: ActivityFeature.song_view });
        const secondBody = fetchMock.mock.calls[1]![1].body;
        expect(typeof secondBody === "string" && JSON.parse(secondBody)).toMatchObject({
            event: { songId: songB, uri: window.location.href }, presentation: { bandPublicId: bandB, routeLocale: "nl-BE" },
        });
    });

    it("delivers anonymous platform actions with explicit null band context", async () => {
        antiCSRFToken = undefined;
        presentation = { data: null, bandPublicId: null };
        await render();
        await record({ feature: ActivityFeature.login_email });
        expect(deliveredRequest().presentation.bandPublicId).toBeNull();
        expect(fetchMock.mock.calls[0]![1].headers).toEqual([["Content-Type", "application/json"]]);
    });

    it("lets explicit action associations override the enclosing component association", async () => {
        await render();
        await record({ feature: ActivityFeature.song_view, songId: songB });
        expect(deliveredRequest().event.songId).toBe(songB);
    });
});
