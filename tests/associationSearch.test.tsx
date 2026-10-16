// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { QuickSearchItemType as Type, QuickSearchItemTypeSets, type QuickSearchItemMatch } from "shared/quickFilter";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import type * as CoreControls from "src/core/components/CMCoreComponents2";

const bands = [parsePublicId<"Band">("PickerBand000001"), parsePublicId<"Band">("PickerBand000002")];
let band: typeof bands[number] | null;
let permissions: Permission[];
let browserLanguages: string[];
let snapshot: object;
let allowNull: boolean;
const changes = vi.fn();
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: snapshot }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({
        authorizationContext: { bandPublicId: band, effectivePermissionNames: permissions },
        localePreferences: { routeLocale: "fr-BE", browserLanguages },
        isAuthorized: (permission: Permission) => permissions.includes(permission),
    }),
    useFeatureRecorder: () => async () => { },
}));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: React.PropsWithChildren) => <main>{children}</main> }));
vi.mock("src/auth/server/serverPageAuthorization", () => ({ makeServerSidePermissionGuard: () => () => ({ props: {} }) }));
vi.mock("src/core/components/CMCoreComponents2", async () => ({
    ...await vi.importActual<typeof CoreControls>("src/core/components/CMCoreComponents2"),
    // Payload inspection needs no session store in this component harness.
    AdminInspectObject: ({ src }: { src: unknown }) => <pre>{JSON.stringify(src)}</pre>,
}));

import { AssociationSelect, AssociationAutocomplete } from "src/core/components/ItemAssociation";
import { QuickSearchExplorer } from "@/src/pages/dev/quickSearchTest";

const saved: QuickSearchItemMatch<Type.song> = {
    itemType: Type.song, id: parsePublicId<"Song">("PickerSong000001"), name: "Saved song",
    absoluteUri: "/backstage/song/PickerSong000001?bandPublicId=PickerBand000001", matchStrength: 1, matchingField: "name"
};
const person: QuickSearchItemMatch<Type.user> = {
    itemType: Type.user, id: parsePublicId<"User">("PickerPerson0001"), name: "Band person",
    absoluteUri: "/backstage/user/PickerPerson0001?bandPublicId=PickerBand000001&routeLocale=fr-BE", matchStrength: 1, matchingField: "name"
};
let root: Root;
let container: HTMLDivElement;
const requests: Array<{ url: string; init: RequestInit; resolve: (response: Response) => void }> = [];
const input = () => container.querySelector<HTMLInputElement>(".AssociationSelect input")!;
const options = () => [...container.querySelectorAll('[role="option"]')];
const reply = (items: QuickSearchItemMatch[] = [person]) => new Response(JSON.stringify(items), { status: 200 });
async function type(element: HTMLInputElement, value: string) {
    await act(async () => { element.value = value; Simulate.change(element); Simulate.focus(element); });
}
function Harness() {
    const [value, setValue] = React.useState<QuickSearchItemMatch | null>(saved);
    return <><textarea defaultValue="Unrelated draft" /><AssociationSelect allowNull={allowNull} searchEnabled permissionPolicy="omitUnavailable"
        allowedItemTypes={QuickSearchItemTypeSets.Everything} value={value} onChange={selection => { changes(selection); setValue(selection); }} /></>;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    band = bands[0]!;
    permissions = [Permission.login, Permission.search_users, Permission.view_songs];
    browserLanguages = ["nl-BE", "en-US"];
    snapshot = {};
    allowNull = true;
    changes.mockClear();
    requests.length = 0;
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => new Promise<Response>(resolve => requests.push({ url, init, resolve })));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("reference association selection", () => {
    it("retains the two-character threshold, explicit scope, ranked choices and selected link", async () => {
        await act(async () => root.render(<Harness />));
        expect(container.querySelector("a")?.getAttribute("href")).toBe(saved.absoluteUri);
        await type(input(), "u");
        expect(requests).toHaveLength(0);
        await type(input(), "u:Band");
        const request = requests[0]!;
        const query = new URL(request.url, "https://picker.invalid").searchParams;
        expect(query.get("bandPublicId")).toBe(band);
        expect(query.get("permissionPolicy")).toBe("omitUnavailable");
        expect(query.get("routeLocale")).toBe("fr-BE");
        expect(JSON.parse(query.get("browserLanguages")!)).toEqual(browserLanguages);
        expect(JSON.parse(query.get("allowedItemTypes")!)).toEqual(QuickSearchItemTypeSets.Everything);
        expect(request.init.cache).toBe("no-store");
        await act(async () => request.resolve(reply([person, saved])));
        expect(options().map(option => option.textContent?.trim())).toEqual([person.name, saved.name]);
        await act(async () => Simulate.click(options()[0]!));
        expect(changes).toHaveBeenCalledWith(person);
        expect(input().value).toBe("");
        expect(options()).toHaveLength(0);
        expect(container.querySelector("a")?.getAttribute("href")).toBe(person.absoluteUri);
        expect(container.querySelector("textarea")?.value).toBe("Unrelated draft");
    });

    it("requires an explicit clear action and honors allowNull", async () => {
        allowNull = false;
        await act(async () => root.render(<Harness />));
        expect(container.querySelector('[role="button"]')).toBeNull();
        allowNull = true;
        await act(async () => root.render(<Harness />));
        await act(async () => Simulate.keyDown(container.querySelector('[role="button"]')!, { key: "Enter" }));
        expect(changes).toHaveBeenCalledOnce();
        expect(changes).toHaveBeenCalledWith(null);
        expect(container.querySelector("a")).toBeNull();
        expect(requests).toHaveLength(0);
    });

    it("supports keyboard selection and Escape without accepting arbitrary text", async () => {
        await act(async () => root.render(<Harness />));
        await type(input(), "Unselected text");
        await act(async () => Simulate.keyDown(input(), { key: "Enter" }));
        expect(changes).not.toHaveBeenCalled();
        await act(async () => requests[0]!.resolve(reply()));
        await act(async () => { Simulate.keyDown(input(), { key: "ArrowDown" }); });
        expect(options()[0]?.getAttribute("aria-selected")).toBe("true");
        await act(async () => { Simulate.keyDown(input(), { key: "Enter" }); });
        expect(changes).toHaveBeenCalledWith(person);
        await type(input(), "Escape draft");
        await act(async () => Simulate.keyDown(input(), { key: "Escape" }));
        expect(input().value).toBe("");
        expect(changes).toHaveBeenCalledOnce();
    });

    it.each(["band", "languages", "authority"])("aborts %s changes while retaining the association and parent draft", async scope => {
        await act(async () => root.render(<Harness />));
        await type(input(), "First query");
        await type(input(), "Second query");
        expect(requests[0]!.init.signal?.aborted).toBe(true);
        await act(async () => requests[0]!.resolve(reply([{ ...person, name: "Old query" }])));
        if (scope === "band") {
            band = bands[1]!;
        } else if (scope === "languages") {
            browserLanguages.reverse();
        } else {
            permissions = [Permission.login];
        }
        await act(async () => root.render(<Harness />));
        expect(requests[1]!.init.signal?.aborted).toBe(true);
        await act(async () => requests[1]!.resolve(reply([{ ...person, name: "Old scope" }])));
        expect(input().value).toBe("");
        expect(options()).toHaveLength(0);
        expect(container.querySelector("a")?.textContent).toContain(saved.name);
        expect(container.querySelector("textarea")?.value).toBe("Unrelated draft");
        expect(changes).not.toHaveBeenCalled();
    });

    it("refreshes current suggestions and recovers from failure without changing the selected value", async () => {
        await act(async () => root.render(<Harness />));
        await type(input(), "Band");
        await act(async () => requests[0]!.resolve(reply()));
        snapshot = {};
        await act(async () => root.render(<Harness />));
        expect(input().value).toBe("Band");
        expect(options()).toHaveLength(0);
        await act(async () => requests[1]!.resolve(new Response("denied", { status: 403 })));
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not be loaded");
        expect(container.querySelector("a")?.textContent).toContain(saved.name);
        await type(input(), "Band again");
        await act(async () => requests[2]!.resolve(reply()));
        expect(options()).toHaveLength(1);
        expect(container.querySelector('[role="alert"]')).toBeNull();
        expect(changes).not.toHaveBeenCalled();
    });

    it("keeps no-band selection disabled and preserves the existing link", async () => {
        band = null;
        await act(async () => root.render(<Harness />));
        expect(input().disabled).toBe(true);
        expect(container.querySelector("a")?.textContent).toContain(saved.name);
        expect(requests).toHaveLength(0);
    });

    it("exposes person autocomplete through the restored plugin", async () => {
        await act(async () => root.render(<AssociationAutocomplete searchEnabled permissionPolicy="requireAll" allowedItemTypes={[Type.user]}
            onSelect={changes} />));
        const field = container.querySelector("input")!;
        await type(field, "u:Band");
        await act(async () => requests[0]!.resolve(reply()));
        await act(async () => { Simulate.keyDown(field, { key: "ArrowDown" }); });
        await act(async () => { Simulate.keyDown(field, { key: "Enter" }); });
        expect(changes).toHaveBeenCalledWith(person, "u:Band");
    });
});

describe("protected quick-search explorer", () => {
    const explorerInput = () => container.querySelector<HTMLInputElement>(".quickSearchExplorer input")!;
    it("restores match-strength probes, grammar inspection, result links and ranking diagnostics", async () => {
        permissions.push(Permission.sysadmin);
        await act(async () => root.render(<QuickSearchExplorer />));
        expect(container.textContent).toContain("Db text to search");
        expect(container.textContent).toContain("Match strength:");
        await type(explorerInput(), "u:Band");
        await act(async () => requests[0]!.resolve(reply()));
        expect(container.textContent).toContain("match strength: 1 matching on field name");
        expect(container.querySelector("a")?.getAttribute("href")).toBe(person.absoluteUri);
        expect(container.querySelectorAll(".test_quickSearchResultItem")).toHaveLength(1);
    });

    it("clears stale scoped results without resetting the independent probe draft", async () => {
        permissions.push(Permission.sysadmin);
        await act(async () => root.render(<QuickSearchExplorer />));
        await type(container.querySelector("input")!, "Probe draft");
        await type(explorerInput(), "First query");
        browserLanguages.reverse();
        await act(async () => root.render(<QuickSearchExplorer />));
        expect(requests[0]!.init.signal?.aborted).toBe(true);
        await act(async () => requests[0]!.resolve(reply()));
        expect(explorerInput().value).toBe("");
        expect(container.querySelector("input")?.value).toBe("Probe draft");
        expect(container.querySelector("a")).toBeNull();
    });

    it("removes revoked administration controls and performs no search in no-band contexts", async () => {
        permissions.push(Permission.sysadmin);
        band = null;
        await act(async () => root.render(<QuickSearchExplorer />));
        expect(container.textContent).toContain("Select a band");
        expect(container.querySelector("input")).toBeNull();
        band = bands[0]!;
        await act(async () => root.render(<QuickSearchExplorer />));
        await type(explorerInput(), "Pending query");
        permissions = [Permission.login];
        await act(async () => root.render(<QuickSearchExplorer />));
        expect(requests[0]!.init.signal?.aborted).toBe(true);
        await act(async () => requests[0]!.resolve(reply()));
        expect(container.querySelector("input")).toBeNull();
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("platform administration");
        expect(container.querySelector("a")).toBeNull();
    });
});
