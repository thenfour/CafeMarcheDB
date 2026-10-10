// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { shellSearchItemTypes } from "src/core/db3/shared/quickSearchTypes";

const bands = [parsePublicId<"Band">("ShellBand0000001"), parsePublicId<"Band">("ShellBand0000002")];
let band: typeof bands[number] | null;
let routeLocale: string;
let browserLanguages: string[];
let permissions: string[];
let snapshot: object;
let completeTelemetry: (() => void) | null;
const push = vi.fn();
vi.mock("next/router", () => ({ useRouter: () => ({ push }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: () => "Search..." }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: snapshot }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({
        authorizationContext: { bandPublicId: band, userPublicId: "ShellUser0000001", effectivePermissionNames: permissions },
        localePreferences: { routeLocale, browserLanguages },
        isAuthorized: (permission: Permission) => permissions.includes(permission),
    }),
    useFeatureRecorder: () => () => completeTelemetry ? new Promise<void>(resolve => { completeTelemetry = resolve; }) : Promise.resolve(),
}));

import { MainSiteSearch } from "src/core/components/search/MainSiteSearch";
import { fetchObjectQuery } from "src/core/components/ItemAssociation";

let container: HTMLDivElement;
let root: Root;
const requests: Array<{ url: string; signal?: AbortSignal; resolve: (response: Response) => void }> = [];
const input = () => container.querySelector("input")!;
const options = () => [...document.querySelectorAll('[role="option"]')].map(option => option.textContent);
async function type(value: string) {
    await act(async () => {
        input().value = value;
        Simulate.change(input());
        Simulate.focus(input());
    });
}
const reply = (name: string, itemType = "song") => new Response(JSON.stringify([{
    itemType, id: "ShellResult00001", name, absoluteUri: `/backstage/${itemType}/ShellResult00001?bandPublicId=${band}&routeLocale=${routeLocale}`,
    matchStrength: 1, matchingField: "name", ...(itemType === "wikiPage" ? { canonicalWikiSlug: "guide" } : {}),
}]), { status: 200 });

beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    band = bands[0]!;
    routeLocale = "fr-BE";
    browserLanguages = ["nl-BE", "en-US"];
    permissions = [Permission.login, Permission.view_songs];
    snapshot = {};
    completeTelemetry = null;
    push.mockClear();
    requests.length = 0;
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => new Promise<Response>(resolve => {
        requests.push({ url, signal: init.signal ?? undefined, resolve });
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MainSiteSearch />));
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("the original global shell autocomplete", () => {
    it("sends explicit band, all four plugins and ordered presentation preferences", async () => {
        await type("Compass");
        const query = new URL(requests[0]!.url, "https://shell.invalid").searchParams;
        expect(JSON.parse(query.get("allowedItemTypes")!)).toEqual(shellSearchItemTypes);
        expect(query.get("bandPublicId")).toBe(band);
        expect(query.get("routeLocale")).toBe(routeLocale);
        expect(JSON.parse(query.get("browserLanguages")!)).toEqual(browserLanguages);
        await act(async () => requests[0]!.resolve(reply("Wiki guide", "wikiPage")));
        await act(async () => Simulate.keyDown(input(), { key: "ArrowDown" }));
        expect(options()).toEqual([" Wiki guide"]);
    });

    it("aborts earlier queries and resets the text and results on band or ordered-locale changes", async () => {
        await type("First");
        await type("Second");
        expect(requests[0]!.signal?.aborted).toBe(true);
        await act(async () => requests[0]!.resolve(reply("Stale query")));
        band = bands[1]!;
        await act(async () => root.render(<MainSiteSearch />));
        expect(requests[1]!.signal?.aborted).toBe(true);
        expect(input().value).toBe("");
        await act(async () => requests[1]!.resolve(reply("Stale band")));
        await type("Current");
        browserLanguages = ["en-US", "nl-BE"];
        await act(async () => root.render(<MainSiteSearch />));
        expect(requests[2]!.signal?.aborted).toBe(true);
        expect(input().value).toBe("");
        expect(options()).toEqual([]);
        expect(push).not.toHaveBeenCalled();
    });

    it("clears cached results and refetches against a refreshed authority snapshot", async () => {
        await type("Compass");
        await act(async () => requests[0]!.resolve(reply("Before revocation")));
        snapshot = {};
        await act(async () => root.render(<MainSiteSearch />));
        expect(requests[0]!.signal?.aborted).toBe(true);
        expect(requests).toHaveLength(2);
        expect(options()).toEqual([]);
        await act(async () => requests[1]!.resolve(new Response("[]", { status: 200 })));
        expect(options()).toEqual([]);
        permissions = [Permission.login];
        await act(async () => root.render(<MainSiteSearch />));
        expect(input().value).toBe("");
    });

    it("retains keyboard selection, ignores free text, and clears with Escape and the existing button", async () => {
        await type("Compass");
        await act(async () => requests[0]!.resolve(reply("Concert", "event")));
        await act(async () => {
            Simulate.keyDown(input(), { key: "ArrowDown" });
            Simulate.keyDown(input(), { key: "Enter" });
        });
        expect(push).toHaveBeenCalledWith(expect.stringContaining("bandPublicId=" + bands[0]));
        push.mockClear();
        await type("Unselected");
        await act(async () => Simulate.keyDown(input(), { key: "Enter" }));
        expect(push).not.toHaveBeenCalled();
        await act(async () => Simulate.keyDown(input(), { key: "Escape" }));
        expect(input().value).toBe("");
        await type("Clear me");
        await act(async () => Simulate.click(container.querySelector(".CMSmallButton")!));
        expect(input().value).toBe("");
    });

    it.each(["refresh", "band"])("does not navigate after %s changes during selection telemetry", async change => {
        await type("Compass");
        await act(async () => requests[0]!.resolve(reply("Concert", "event")));
        completeTelemetry = () => {};
        await act(async () => {
            Simulate.keyDown(input(), { key: "ArrowDown" });
            Simulate.keyDown(input(), { key: "Enter" });
        });
        if (change === "band") {
            band = bands[1]!;
        } else {
            snapshot = {};
        }
        await act(async () => root.render(<MainSiteSearch />));
        await act(async () => completeTelemetry?.());
        expect(push).not.toHaveBeenCalled();
    });

    it.each(["anonymous", "unscoped"])("keeps %s shell search unavailable", async mode => {
        if (mode === "anonymous") {
            permissions = [];
        } else {
            band = null;
        }
        await act(async () => root.render(<MainSiteSearch />));
        expect(container.querySelector("input")).toBeNull();
        expect(requests).toHaveLength(0);
    });

    it("rejects numeric or unrequested public result identities", async () => {
        const first = fetchObjectQuery("Compass", [shellSearchItemTypes[0]], { bandPublicId: bands[0] }, "omitUnavailable");
        requests[0]!.resolve(reply("Wrong plugin", "song"));
        await expect(first).rejects.toThrow("unrequested item type");
        const second = fetchObjectQuery("Compass", shellSearchItemTypes, { bandPublicId: bands[0] }, "omitUnavailable");
        requests[1]!.resolve(new Response(JSON.stringify([{ itemType: "song", id: 123, name: "Natural ID", absoluteUri: "/song/123",
            matchStrength: 1, matchingField: "name" }])));
        await expect(second).rejects.toThrow();
    });
});
