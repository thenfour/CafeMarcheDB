// @vitest-environment jsdom
import React from "react";
vi.mock("src/route/PortalRoutingProvider", () => ({ usePortalHosting: () => ({ kind: "platform" }) }));
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { BandMemberProfile, BandMemberProfileEditor } from "src/core/components/user/BandMemberProfile";
import { BandMemberDirectory } from "src/core/components/user/BandMemberDirectory";
import { createDashboardReferenceStore } from "src/core/db3/shared/references/dashboardReferences";
import { MakeEmptySearchResultsRet, type GetSearchResultsInput, type SearchResultsFacet } from "src/core/db3/shared/apiTypes";
import { CMClientAuthorization } from "src/auth/shared/cmAuthorization";
import { PermissionSet } from "src/auth/shared/PermissionSet";

interface ReadInput {
    readonly bandPublicId?: string;
    readonly clientRequestId?: string;
    readonly table: { readonly viewID: string };
    readonly filter: { readonly quickFilterValues?: string[]; readonly tableParams?: { readonly personPublicId?: string } };
    readonly skip?: number;
}
vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: () => ({ invoke }) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: bandId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"], clientRequestId: requestId }) }));
vi.mock("src/core/db3/queries/db3queries", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/db3paginatedQueries", () => ({ default: vi.fn() }));
vi.mock("src/core/components/search/SearchBase", () => ({ fetchSearchResultsApi: async (args: GetSearchResultsInput) => {
    searchRequests.push(args);
    return { ...MakeEmptySearchResultsRet(), results: [currentMember], rowCount: 25, facets: directoryFacets };
} }));
vi.mock("@blitzjs/rpc", async () => ({ ...await vi.importActual<typeof import("@blitzjs/rpc")>("@blitzjs/rpc"), useQuery: (_resolver: unknown, args: ReadInput) => {
    queries.push(args);
    return [{ items: args.table.viewID === bandUserProfileView.viewID ? [currentMember] : [], count: 25, hasMore: true },
        { refetch, isFetching: false, error: null }];
} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useFeatureRecorder: () => recordFeature, useDashboardContext: () => ({
    refreshCachedData: refreshDashboard, userTag: { items: [], getById: () => undefined },
    instrument: { items: directoryInstruments, getById: (id: string) => directoryInstruments.find(item => item.publicId === id) },
    referenceStore: references, authorizationContext: { bandPublicId: bandId },
    authorization: new CMClientAuthorization({ id: 1, publicId: personId }, new PermissionSet(permissions)),
    localePreferences: { routeLocale: "fr-BE", browserLanguages: ["nl-BE"] },
    portalHosting: { kind: "platform" as const }, memberPresentation: { bandPublicId: bandId, routeLocale: "fr-BE" },
    isAuthorized: (permission: Permission) => permissions.includes(permission),
}) }));
vi.mock("src/core/components/SnackbarContext", async () => ({ ...await vi.importActual<typeof import("src/core/components/SnackbarContext")>("src/core/components/SnackbarContext"),
    useSnackbar: () => ({ showMessage: vi.fn() }) }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("src/core/components/user/BandUserInstruments", () => ({ BandUserInstrumentsEditor: () => <span>Instrument assignments</span> }));
vi.mock("src/core/components/user/BandUserTags", () => ({ BandUserTagsEditor: () => <span>Tag assignments</span> }));
vi.mock("src/core/components/user/BandUserRoles", () => ({ BandUserRoleEditor: () => <span>Role assignment</span> }));
// Account controls and analytics have separate specifications; these cases own membership composition.
vi.mock("src/core/components/user/UserDetail", () => ({ UserDetail: () => null }));
vi.mock("next/router", () => ({ useRouter: () => ({ pathname: "/backstage/users", query: {}, asPath: "/backstage/users", replace: vi.fn() }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: bandId, data: {
    authorization: { userPublicId: actorId, effectivePermissionNames: permissions }, input: { clientRequestId: requestId },
}, invalidate }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));

const personId = parsePublicId<"User">("User000000000001");
const member = bandUserProfileView.parseDto({
    publicId: "Membership000001", userId: personId, user: { publicId: personId, name: "Alice", email: "alice@test.invalid", phone: "+32 123" },
    bandRoleId: null, bandRole: null, bandUserInstruments: [], bandUserTagAssignments: [], isDeleted: false,
});
const invoke = vi.fn(async (_input: unknown): Promise<unknown> => ({ membershipId: member.publicId, personId }));
const refetch = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const invalidate = vi.fn(async () => {});
const recordFeature = vi.fn(async () => {});
const queries: ReadInput[] = [];
const searchRequests: GetSearchResultsInput[] = [];
const references = createDashboardReferenceStore();
interface DirectoryInstrument {
    readonly publicId: string;
    readonly name: string;
    readonly isHidden: boolean;
    readonly functionalGroup: { readonly isHidden: boolean };
}
let directoryInstruments: DirectoryInstrument[];
let directoryFacets: SearchResultsFacet[];
let currentMember = member;
let actorId: string;
let permissions: Permission[];
let bandId: string | null;
let requestId: string;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    invoke.mockResolvedValue({ membershipId: member.publicId, personId });
    refetch.mockResolvedValue(undefined);
    refreshDashboard.mockResolvedValue(undefined);
    invalidate.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    currentMember = member;
    actorId = personId;
    permissions = [Permission.login, Permission.view_users_basic_info, Permission.search_users];
    bandId = "Band000000000001";
    requestId = "first";
    queries.length = 0;
    searchRequests.length = 0;
    directoryInstruments = [];
    directoryFacets = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.trim() === label);
    if (!button) {
        throw new Error(`Missing button ${label}`);
    }
    await act(async () => button.click());
}
async function fill(label: string, value: string) {
    const labelledInput = [...document.querySelectorAll<HTMLLabelElement>("label")].find(element => element.textContent === label);
    const field = labelledInput ? document.getElementById(labelledInput.htmlFor) : null;
    if (!(field instanceof window.HTMLInputElement)) {
        throw new Error(`Missing input ${label}`);
    }
    await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(field, value);
        field.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
}
const renderEditor = () => act(async () => root.render(<BandMemberProfileEditor member={currentMember} refetch={refetch} />));
const renderProfile = () => act(async () => root.render(<BandMemberProfile personId={personId} />));
const renderDirectory = () => act(async () => root.render(<BandMemberDirectory />));

describe("band member profile controls", () => {
    it("edits only shared name and phone, then refreshes all presentation caches", async () => {
        await renderEditor();
        await click("Edit shared profile");
        expect(document.body.textContent).toContain("Name and phone are shared across all this person's bands.");
        expect(document.querySelectorAll("input")).toHaveLength(2);
        await fill("Name", "Alice updated");
        await fill("Phone", "+32 456");
        await click("Save profile");
        expect(invoke).toHaveBeenCalledWith({ membershipId: member.publicId, name: "Alice updated", phone: "+32 456" });
        expect(refetch).toHaveBeenCalledOnce();
        expect(refreshDashboard).toHaveBeenCalledOnce();
        expect(invalidate).toHaveBeenCalledOnce();
    });
    it("retains a failed draft for retry and blocks duplicate pending saves", async () => {
        await renderEditor();
        await click("Edit shared profile");
        await fill("Name", "Unsaved draft");
        invoke.mockRejectedValueOnce(new Error("Denied"));
        await click("Save profile");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not update the profile.");
        expect([...document.querySelectorAll<HTMLInputElement>("input")].some(input => input.value === "Unsaved draft")).toBe(true);
        let finish: (value: unknown) => void = () => {};
        invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await click("Save profile");
        await click("Save profile");
        expect(invoke).toHaveBeenCalledTimes(2);
        await act(async () => finish({ membershipId: member.publicId, personId }));
    });
    it("reports a committed write separately when refreshing fails", async () => {
        await renderEditor();
        await click("Edit shared profile");
        invalidate.mockRejectedValueOnce(new Error("Refresh failed"));
        await click("Save profile");
        expect(container.textContent).toContain("Profile saved. Reload this page to show the latest values.");
        expect(invoke).toHaveBeenCalledOnce();
    });
    it("keeps other people's shared profiles read-only for band managers", async () => {
        actorId = "User000000000002";
        permissions = [Permission.login, Permission.manage_users];
        await renderEditor();
        expect(container.textContent).not.toContain("Edit shared profile");
        permissions.push(Permission.manage_global_users);
        currentMember = bandUserProfileView.parseDto({ ...member, user: { publicId: personId, name: "Alice" } });
        await renderEditor();
        await click("Edit shared profile");
        expect(document.querySelectorAll("input")).toHaveLength(1);
        await click("Save profile");
        expect(invoke).toHaveBeenCalledWith({ membershipId: member.publicId, name: "Alice" });
    });
    it("uses explicit band/person queries, reuses assignment controls and resets a draft on band switch", async () => {
        permissions = [Permission.login];
        await renderProfile();
        expect(queries.find(query => query.table.viewID === bandUserProfileView.viewID)).toMatchObject({ bandPublicId: bandId, filter: { tableParams: { personPublicId: personId } } });
        expect(container.textContent).toContain("Instrument assignments");
        expect(container.textContent).toContain("Role assignment");
        expect(container.querySelector('a[href^="/backstage/users"]')).toBeNull();
        await click("Edit shared profile");
        await fill("Name", "Old band's draft");
        bandId = "Band000000000002";
        requestId = "second";
        currentMember = bandUserProfileView.parseDto({ ...member, publicId: "Membership000002", user: { publicId: personId, name: "New band name" } });
        await renderProfile();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(container.textContent).toContain("New band name");
        expect(container.textContent).not.toContain("alice@test.invalid");
        expect(queries[queries.length - 1]!.bandPublicId).toBe(bandId);
    });
    it("clears member data when band selection disappears", async () => {
        await renderProfile();
        bandId = null;
        await renderProfile();
        expect(container.textContent).toContain("Select a band to view its members.");
        expect(container.textContent).not.toContain("alice@test.invalid");
    });
});

describe("member directory", () => {
    it("redacts hidden instrument cards and displays the authorized server facets", async () => {
        directoryInstruments = [
            { publicId: "Instrument000001", name: "Hidden group trumpet", isHidden: false, functionalGroup: { isHidden: true } },
            { publicId: "Instrument000002", name: "Visible drums", isHidden: false, functionalGroup: { isHidden: false } },
        ];
        currentMember = bandUserProfileView.parseDto({ ...member,
            bandUserInstruments: [{ publicId: "Assignment000001", bandInstrumentId: directoryInstruments[0]!.publicId,
                bandInstrument: { publicId: directoryInstruments[0]!.publicId }, isPrimary: true }],
        });
        // Facet authorization belongs to the native search reader; the UI displays its result.
        directoryFacets = [{ db3Column: "bandUserInstruments", items: [{
            id: "Instrument000002", label: "Visible drums", rowCount: 1,
            color: null, iconName: null, tooltip: null, shape: undefined,
        }] }];
        await renderDirectory();
        expect(container.querySelector(".instruments")?.textContent).toBe("");
        expect(container.textContent).not.toContain("Hidden group trumpet");
        const expand = container.querySelector<HTMLElement>(".headerExpandableButton")!;
        await act(async () => expand.click());
        const options = [...container.querySelectorAll(".filterGroup")].find(group => group.querySelector(".filterGroupLabel")?.textContent === "Instruments");
        expect(options?.textContent).toContain("Visible drums");
        expect(options?.textContent).not.toContain("Hidden group trumpet");
        currentMember = bandUserProfileView.parseDto({ ...member,
            bandUserInstruments: [{ publicId: "Assignment000002", bandInstrumentId: "Instrument000002",
                bandInstrument: { publicId: "Instrument000002" }, isPrimary: true }],
        });
        requestId = "visible instrument";
        await renderDirectory();
        expect(container.querySelector(".instruments")?.textContent).toContain("Visible drums");
    });
    it("pages with scoped requests and resets to the first page when the search changes", async () => {
        await renderDirectory();
        const link = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(element => element.textContent?.trim() === "Alice");
        expect(link?.getAttribute("href")).toBe(`/fr-BE/b/${bandId}/backstage/user/${personId}`);
        await click("Load more results...");
        expect(searchRequests.at(-1)).toMatchObject({ bandPublicId: bandId, routeLocale: "fr-BE", offset: 1 });
        const search = container.querySelector<HTMLInputElement>('input[placeholder="Search"]')!;
        await act(async () => {
            search.value = "Alice Alpha";
            Simulate.change(search, { target: search });
        });
        expect(searchRequests.at(-1)).toMatchObject({ bandPublicId: bandId, offset: 0, quickFilter: "Alice Alpha" });
    });
    it("does not retain old rows across band/permission refreshes", async () => {
        await renderDirectory();
        bandId = "Band000000000002";
        requestId = "next band";
        currentMember = bandUserProfileView.parseDto({ ...member, publicId: "Membership000002", user: { publicId: personId, name: "Other band profile" } });
        await renderDirectory();
        expect(container.textContent).toContain("Other band profile");
        expect(container.textContent).not.toContain("alice@test.invalid");
        permissions = [Permission.login];
        await renderDirectory();
        expect(container.textContent).not.toContain("Other band profile");
        expect(container.textContent).toContain("You do not have access to the member directory in this band.");
    });
});
