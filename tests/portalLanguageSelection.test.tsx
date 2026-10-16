// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { PortalRoutingProvider } from "src/route/PortalRoutingProvider";
import { PortalLanguageSelection } from "src/route/PortalLanguageSelection";
import { BandSelection } from "src/core/components/dashboard/BandSelection";
import type { BandHostingConfig } from "src/route/portalRouting";

vi.mock("next/router", () => ({ useRouter: () => ({ asPath: path, push }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({
    usePresentation: () => ({
        bandPublicId: band,
        data: { input: { bandPublicId: band, routeLocale: "fr-BE" }, localization: { availability: { global: ["en-US", "fr-BE", "nl-BE"], band: ["en-US", "fr-BE", "nl-BE"] } } },
    })
}));
vi.mock("src/locale/components/useLocale", () => ({
    useLocale: () => ({
        formattingLocale: "fr-BE",
        getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue,
    })
}));
vi.mock("@blitzjs/rpc", () => ({ useQuery: () => { choicesRead(); return [[]]; } }));
vi.mock("src/auth/queries/getAvailableBands", () => ({ default: vi.fn() }));
const band = parsePublicId<"Band">("PortalBand000001");
const push = vi.fn(async (_href: string) => true);
const choicesRead = vi.fn();
let path: string;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    push.mockReset().mockResolvedValue(true);
    choicesRead.mockClear();
    path = `/fr-BE/b/${band}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2#answer`;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
async function render(hosting: BandHostingConfig, children = <PortalLanguageSelection />) {
    await act(async () => root.render(<PortalRoutingProvider hosting={hosting}>{children}</PortalRoutingProvider>));
}
async function select(value: string) {
    const input = container.querySelector("select");
    if (!input) {
        throw new Error("Missing language selector");
    }
    await act(async () => {
        input.value = value;
        input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
}

describe("portal language navigation", () => {
    it("switches the equivalent platform page, retaining identity, tab, query and hash", async () => {
        await render({ kind: "platform" });
        await select("nl-BE");
        expect(push).toHaveBeenCalledWith(`/nl-BE/b/${band}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2#answer`);
    });
    it("returns to browser preference order without changing the page or band", async () => {
        await render({ kind: "platform" });
        await select("");
        expect(push).toHaveBeenCalledWith(`/b/${band}/backstage/event/PortalEvent0001/rehearsal/attendance?page=2#answer`);
    });
    it("preserves the familiar standalone URL and hides the band picker without reading choices", async () => {
        path = "/fr-BE/backstage/songs?q=brass#results";
        await render({ kind: "standalone", bandPublicId: band, tenant: "generic" }, <><BandSelection /><PortalLanguageSelection /></>);
        expect(container.querySelector("#dashboard-band")).toBeNull();
        expect(choicesRead).not.toHaveBeenCalled();
        await select("nl-BE");
        expect(push).toHaveBeenCalledWith("/nl-BE/backstage/songs?q=brass#results");
    });
    it("retains the selected language and shows a failed navigation", async () => {
        push.mockResolvedValueOnce(false);
        await render({ kind: "platform" });
        await select("nl-BE");
        expect(container.textContent).toContain("Could not change language");
        expect(container.querySelector("select")?.value).toBe("fr-BE");
    });
});
