// @vitest-environment jsdom
import { PortalRoutingProvider } from "src/route/useCmdbRouter";
import { parsePortalPath, type BandHostingConfig } from "src/route/portalRouting";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { BandMenuItems } from "src/core/components/dashboard/BandMenuItems";
import { MenuList } from "@mui/material";
import type { AvailableBand } from "src/auth/shared/availableBands";
import { parsePublicId } from "shared/publicId";

vi.mock("next/router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (_query: unknown, input: unknown) => { queries.push(input); return [choices]; } }));
vi.mock("src/auth/queries/getAvailableBands", () => ({ default: vi.fn() }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId, data: { input: {
    bandPublicId, routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "snapshot",
} } }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const push = vi.fn(async (_href: string, _as?: string, _options?: unknown) => true);
const queries: unknown[] = [];
const closeMenu = vi.fn();
let choices: AvailableBand[];
let bandPublicId: string | null;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    push.mockReset().mockResolvedValue(true);
    choices = [
        { publicId: parsePublicId<"Band">("Band000000000001"), name: "First band", supportedLocales: ["fr-BE", "nl-BE"],
            logoUrl: "/first.svg", theme: { primaryMain: "#123456", secondaryMain: "#654321", contrastText: "#ffffff" } },
        { publicId: parsePublicId<"Band">("Band000000000002"), name: "Second band", supportedLocales: ["fr-BE", "nl-BE"],
            logoUrl: "", theme: { primaryMain: "#831012", secondaryMain: "#ede331", contrastText: "#ffff00" } },
    ];
    bandPublicId = null;
    queries.length = 0;
    closeMenu.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});
async function render() {
    const hosting = { kind: "multiBand" } satisfies BandHostingConfig;
    const requestPath = parsePortalPath(bandPublicId ? `/fr-BE/b/${bandPublicId}` : "/fr-BE/platform", hosting);
    await act(async () => root.render(
        <PortalRoutingProvider config={{ baseUri: "https://test", hosting, requestPath }}>
            <MenuList><BandMenuItems onNavigate={closeMenu} /></MenuList>
        </PortalRoutingProvider>,
    ));
}
async function select(value: string) {
    const href = value ? `/fr-BE/b/${value}` : "/fr-BE/platform";
    const link = Array.from(container.querySelectorAll("a")).find(item => item.href.endsWith(href)
        || (value && item.href.endsWith(`/b/${value}`)));
    if (!link) {
        throw new Error("Missing band navigation link");
    }
    await act(async () => { link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); });
}

describe("band navigation menu", () => {
    it("returns to browser preference order when the destination band does not enable the chosen language", async () => {
        choices[1] = { ...choices[1]!, supportedLocales: ["en-US", "nl-BE"] };
        await render();
        await select(choices[1]!.publicId);
        expect(push).toHaveBeenCalledWith("/b/Band000000000002", undefined, undefined);
    });
    it("never automatically selects a band and carries full language preferences to its account query", async () => {
        await render();
        expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain("Account and platform");
        expect(push).not.toHaveBeenCalled();
        expect(queries[0]).toEqual({ routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"], clientRequestId: "snapshot" });
        await select(choices[1]!.publicId);
        expect(push).toHaveBeenCalledWith("/fr-BE/b/Band000000000002", undefined, undefined);
    });
    it("supports returning to platform context and retains the selected band on navigation failure", async () => {
        bandPublicId = choices[0]!.publicId;
        push.mockRejectedValueOnce(new Error("Navigation failed"));
        await render();
        await select("");
        expect(push).toHaveBeenCalledWith("/fr-BE/platform", undefined, undefined);
        expect(container.textContent).toContain("Could not change bands");
        expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain("First band");
        expect(closeMenu).not.toHaveBeenCalled();
    });
    it("does not select another membership when the selected band is unavailable", async () => {
        bandPublicId = "Band000000000099";
        await render();
        expect(container.querySelectorAll(".BandBadge")).toHaveLength(choices.length);
        expect(container.querySelector('a[aria-current="page"]')).toBeNull();
        expect(push).not.toHaveBeenCalled();
    });
    it("prevents duplicate selection while navigation is pending", async () => {
        let finish: (changed: boolean) => void = () => {};
        push.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
        await render();
        await select(choices[0]!.publicId);
        expect(Array.from(container.querySelectorAll('a[role="menuitem"]')).every(item => item.getAttribute("aria-disabled") === "true")).toBe(true);
        await act(async () => finish(true));
        expect(container.querySelector('a[aria-disabled="true"]')).toBeNull();
        expect(closeMenu).toHaveBeenCalledOnce();
    });
    it("renders each band's colors and logo independently, and marks the active band", async () => {
        bandPublicId = choices[1]!.publicId;
        await render();
        const badges = container.querySelectorAll(".BandBadge");
        expect(window.getComputedStyle(badges[0]!).backgroundColor).toBe("rgb(18, 52, 86)");
        expect(window.getComputedStyle(badges[0]!).color).toBe("rgb(255, 255, 255)");
        expect(window.getComputedStyle(badges[0]!).borderLeftColor).toBe("rgb(101, 67, 33)");
        expect(badges[0]!.querySelector("img")?.getAttribute("src")).toBe("/first.svg");
        expect(window.getComputedStyle(badges[1]!).backgroundColor).toBe("rgb(131, 16, 18)");
        expect(badges[1]!.textContent).toContain("SB");
        expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain("Second band");
        expect(badges[1]!.querySelector('[data-testid="CheckIcon"]')).not.toBeNull();
    });
    it("preserves a missing band name without inventing a display name", async () => {
        choices[0] = { ...choices[0]!, name: null, logoUrl: "" };
        await render();
        expect(container.querySelector(".BandBadge .MuiTypography-root")?.textContent).toBe("");
    });
    it("supports keyboard focus through the band entries and skips the section heading", async () => {
        await render();
        const links = container.querySelectorAll("a");
        await act(async () => {
            links[0]!.focus();
            links[0]!.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
        expect(document.activeElement).toBe(links[1]);
    });
    it("keeps the menu open when Next cancels navigation", async () => {
        push.mockResolvedValueOnce(false);
        await render();
        await select(choices[0]!.publicId);
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("Could not change bands");
        expect(closeMenu).not.toHaveBeenCalled();
    });

});
