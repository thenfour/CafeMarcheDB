// @vitest-environment jsdom
import { PortalRoutingProvider } from "src/route/useCmdbRouter";
import { parsePortalPath } from "src/route/portalRouting";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { BandSelection } from "src/core/components/dashboard/BandSelection";

vi.mock("next/router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (_query: unknown, input: unknown) => { queries.push(input); return [choices]; } }));
vi.mock("src/auth/queries/getAvailableBands", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId, data: { input: {
    bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "snapshot",
} } }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const push = vi.fn(async (_href: string, _as?: string, _options?: unknown) => true);
const queries: unknown[] = [];
let choices: Array<{ publicId: string; name: string | null; supportedLocales: string[] }>;
let bandPublicId: string | null;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    push.mockReset().mockResolvedValue(true);
    choices = [{ publicId: "Band000000000001", name: "First band", supportedLocales: ["fr-BE", "nl-BE"] },
        { publicId: "Band000000000002", name: "Second band", supportedLocales: ["fr-BE", "nl-BE"] }];
    bandPublicId = null;
    queries.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
async function select(value: string) {
    const input = container.querySelector("select");
    if (!input) {
        throw new Error("Missing band selector");
    }
    await act(async () => { input.value = value; input.dispatchEvent(new window.Event("change", { bubbles: true })); });
}

describe("explicit dashboard band selection", () => {
    it("returns to browser preference order when the destination band does not enable the chosen language", async () => {
        choices[1]!.supportedLocales = ["en-US", "nl-BE"];
        await act(async () => root.render(<PortalRoutingProvider config={{ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}/backstage` : "/fr-BE/backstage", { kind: "multiBand" }) }}><BandSelection /></PortalRoutingProvider>));
        await select(choices[1]!.publicId);
        expect(push).toHaveBeenCalledWith("/b/Band000000000002/backstage", undefined, undefined);
    });
    it("never automatically selects a band and carries full language preferences to its account query", async () => {
        await act(async () => root.render(<PortalRoutingProvider config={{ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}/backstage` : "/fr-BE/backstage", { kind: "multiBand" }) }}><BandSelection /></PortalRoutingProvider>));
        expect(container.querySelector("select")?.value).toBe("");
        expect(push).not.toHaveBeenCalled();
        expect(queries[0]).toEqual({ routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "snapshot" });
        await select(choices[1]!.publicId);
        expect(push).toHaveBeenCalledWith("/fr-BE/b/Band000000000002/backstage", undefined, undefined);
    });
    it("supports returning to platform context and retains the selected band on navigation failure", async () => {
        bandPublicId = choices[0]!.publicId;
        push.mockRejectedValueOnce(new Error("Navigation failed"));
        await act(async () => root.render(<PortalRoutingProvider config={{ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}/backstage` : "/fr-BE/backstage", { kind: "multiBand" }) }}><BandSelection /></PortalRoutingProvider>));
        await select("");
        expect(push).toHaveBeenCalledWith("/fr-BE/backstage", undefined, undefined);
        expect(container.textContent).toContain("Could not change bands");
        expect(container.querySelector("select")?.value).toBe(bandPublicId);
    });
    it("shows an unavailable selected band and does not fall back to another membership", async () => {
        bandPublicId = "Band000000000099";
        await act(async () => root.render(<PortalRoutingProvider config={{ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}/backstage` : "/fr-BE/backstage", { kind: "multiBand" }) }}><BandSelection /></PortalRoutingProvider>));
        expect(container.querySelector("select")?.selectedOptions[0]?.textContent).toContain("Selected band is unavailable");
        expect(push).not.toHaveBeenCalled();
    });
    it("prevents duplicate selection while navigation is pending", async () => {
        let finish: (changed: boolean) => void = () => {};
        push.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
        await act(async () => root.render(<PortalRoutingProvider config={{ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}/backstage` : "/fr-BE/backstage", { kind: "multiBand" }) }}><BandSelection /></PortalRoutingProvider>));
        await select(choices[0]!.publicId);
        expect(container.querySelector("select")?.disabled).toBe(true);
        await act(async () => finish(true));
        expect(container.querySelector("select")?.disabled).toBe(false);
    });
});
