// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType } from "shared/quickFilter";

const bands = [parsePublicId<"Band">("PickerBand000001"), parsePublicId<"Band">("PickerBand000002")];
let band = bands[0]!;
const dashboard = () => ({ authorizationContext: { bandPublicId: band },
    localePreferences: { routeLocale: "fr-BE", browserLanguages: ["nl-BE", "en-US"] },
    requireBandPublicId: () => band,
});
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => dashboard(), useFeatureRecorder: () => async () => {},
}));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: string) => key }) }));

import { AssociationAutocomplete } from "src/core/components/ItemAssociation";

let container: HTMLDivElement;
let root: Root;
const requests: Array<{ url: string; signal?: AbortSignal; resolve: (value: Response) => void }> = [];
const songTypes: readonly QuickSearchItemType.song[] = [QuickSearchItemType.song];
const onSelect = vi.fn();
const render = (query: string) => root.render(<AssociationAutocomplete<QuickSearchItemType.song>
    value={query} allowedItemTypes={songTypes} onSelect={onSelect} />);
const response = (name: string) => new Response(JSON.stringify([{ itemType: "song", id: "PickerSong000001", name,
    absoluteUri: `/backstage/song/PickerSong000001?bandPublicId=${band}`, matchStrength: 1, matchingField: "name" }]), { status: 200 });

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    band = bands[0]!;
    requests.length = 0;
    onSelect.mockClear();
    vi.stubGlobal("fetch", (url: string, options: RequestInit) => new Promise<Response>(resolve => {
        requests.push({ url, signal: options.signal ?? undefined, resolve });
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("restored song association autocomplete", () => {
    it("sends ordered locale preferences and aborts stale query and band responses", async () => {
        await act(async () => render("First"));
        expect(requests).toHaveLength(1);
        const query = new URL(requests[0]!.url, "https://picker.invalid").searchParams;
        expect(query.get("bandPublicId")).toBe(bands[0]);
        expect(query.get("routeLocale")).toBe("fr-BE");
        expect(JSON.parse(query.get("browserLanguages")!)).toEqual(["nl-BE", "en-US"]);
        await act(async () => render("Second"));
        expect(requests[0]!.signal?.aborted).toBe(true);
        await act(async () => { requests[0]!.resolve(response("Stale first song")); });
        band = bands[1]!;
        await act(async () => render("Second"));
        expect(requests[1]!.signal?.aborted).toBe(true);
        expect(new URL(requests[2]!.url, "https://picker.invalid").searchParams.get("bandPublicId")).toBe(bands[1]);
        await act(async () => { requests[1]!.resolve(response("Stale other band")); });
        const input = container.querySelector("input")!;
        await act(async () => Simulate.focus(input));
        expect(document.body.textContent).not.toContain("Stale first song");
        expect(document.body.textContent).not.toContain("Stale other band");
        await act(async () => {
            requests[2]!.resolve(response("Current song"));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        await act(async () => Simulate.keyDown(input, { key: "ArrowDown" }));
        expect(document.body.textContent).toContain("Current song");
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("clears uncontrolled text with Escape and the existing clear button", async () => {
        const changed = vi.fn();
        await act(async () => root.render(<AssociationAutocomplete<QuickSearchItemType.song>
            defaultValue="Authored query" allowedItemTypes={songTypes} onSelect={onSelect} onValueChange={changed} />));
        const input = container.querySelector("input")!;
        await act(async () => Simulate.keyDown(input, { key: "Escape" }));
        expect(input.value).toBe("");
        expect(changed).toHaveBeenCalledWith("");
        expect(requests[0]!.signal?.aborted).toBe(true);
        await act(async () => {
            input.value = "New query";
            Simulate.change(input);
        });
        await act(async () => Simulate.click(container.querySelector(".CMSmallButton")!));
        expect(input.value).toBe("");
        expect(onSelect).not.toHaveBeenCalled();
    });
});
