// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useURLState } from "src/core/components/CMCoreComponents2";

const replace = vi.fn(async (_href: string, _as?: string, _options?: { shallow: boolean }) => true);
vi.mock("next/router", () => ({ useRouter: () => ({ asPath: window.location.pathname + window.location.search + window.location.hash, replace }) }));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    replace.mockClear();
    window.history.replaceState({}, "", "/fr-BE/b/PortalBand000001/backstage/songs?probe=keep#results");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
});
function Filter() {
    const [query, setQuery] = useURLState<string>("qf", "");
    return <button onClick={() => setQuery("brass")}>{query || "Search"}</button>;
}
describe("filter URL state in a portal", () => {
    it("keeps an unchanged URL intact, then preserves portal, existing query and fragment when a filter changes", async () => {
        await act(async () => root.render(<Filter />));
        expect(replace).not.toHaveBeenCalled();
        await act(async () => container.querySelector("button")!.click());
        const href = replace.mock.calls[0]?.[0];
        if (typeof href !== "string") {
            throw new Error("The filter did not publish a URL.");
        }
        const url = new URL(href, window.location.origin);
        expect(url.pathname).toBe("/fr-BE/b/PortalBand000001/backstage/songs");
        expect(url.searchParams.get("probe")).toBe("keep");
        expect(url.searchParams.get("qf")).toBe('"brass"');
        expect(url.hash).toBe("#results");
        expect(replace.mock.calls[0]?.[2]).toEqual({ shallow: true });
    });
});
