// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { createDashboardReferenceStore } from "src/core/db3/shared/references/dashboardReferences";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { OwnProfileContent } from "src/core/components/user/OwnAccountProfile";
import { AccountProfile } from "src/core/components/user/AccountProfile";
import { UserDetail } from "src/core/components/user/UserDetail";

interface QueryInput {
    readonly bandPublicId?: string | null;
    readonly table?: { readonly viewID: string };
    readonly includeDeleted?: boolean;
    readonly userId?: string;
}
vi.mock("src/core/db3/queries/db3queries", () => ({ default: "db3" }));
vi.mock("src/auth/queries/getUserManagementCapabilities", () => ({ default: "capabilities" }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (query: string, input: QueryInput) => {
    reads.push({ query, input });
    return [query === "capabilities" ? capabilities : { items: input.table?.viewID === "BandUser_Profile" ? [membership] : [account] }, { refetch }];
} }));
vi.mock("src/core/db3/components/useDB3Command", () => ({ useDB3Command: (command: { commandID: string }, context: { bandPublicId: string | null }) => ({
    invoke: async (payload: unknown) => { writes.push({ command: command.commandID, context, payload }); return invoke(payload); },
}) }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({ bandPublicId: band, routeLocale, browserLanguages: ["nl-BE"], clientRequestId: revision }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ bandPublicId: band,
    data: { input: { clientRequestId: revision }, authorization: { userPublicId: personId, bandUserPublicId: hasMembership ? membership.publicId : null } }, invalidate,
}) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({
    useDashboardContext: () => ({ referenceStore: references, currentUser: { publicId: actorId }, refreshCachedData: refreshDashboard,
        isAuthorized: (permission: Permission) => permissions.includes(permission) }),
    useFeatureRecorder: () => recordFeature,
    useRecordFeatureUse: (event: unknown) => { React.useEffect(() => { recordedViews.push(event); }, []); },
}));
vi.mock("next/router", () => ({ useRouter: () => ({ query: { id_slug_tab: [personId, "member", requestedTab] }, push, replace }) }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage: vi.fn() }) }));
// Dialog transitions have separate coverage; these cases verify drafts and command boundaries.
vi.mock("src/core/components/ResponsiveDialog", () => ({ ResponsiveDialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) =>
    open ? <div role="dialog">{children}</div> : null }));
vi.mock("src/core/components/user/BandUserInstruments", () => ({ BandUserInstrumentsEditor: () => <span>Band instruments</span> }));
vi.mock("src/core/components/user/BandUserTags", () => ({ BandUserTagsEditor: () => <span>Band tags</span> }));
vi.mock("src/core/components/user/UserAdminPanel", () => ({ UserAdminPanel: ({ onDeactivated }: { onDeactivated: () => Promise<unknown> }) =>
    <button onClick={() => void onDeactivated()}>Deactivate account</button> }));
vi.mock("src/core/components/user/AccountRoleControl", () => ({ AccountRoleControl: () => <span>Global role control</span> }));
vi.mock("src/core/components/user/UserIdentityIndicator", () => ({ UserIdentityIndicator: () => <span>Account identity</span> }));
vi.mock("src/core/components/user/UserSignInMethodsButton", () => ({ UserSignInMethodsButton: () => <span>Sign-in methods</span> }));
vi.mock("src/core/components/user/AdminResetPasswordButton", () => ({ AdminResetPasswordButton: () => <span>Password reset</span> }));
vi.mock("src/core/components/user/ImpersonateUserButton", () => ({ ImpersonateUserButton: () => <span>Impersonate account</span> }));
vi.mock("src/core/components/user/UserAnalyticTables", () => ({
    UserAttendanceTabContent: () => <span>Attendance history</span>, UserCreditsTabContent: () => <span>Song credits</span>,
    UserWikiContributionsTabContent: () => <span>Wiki history</span>, UserMassAnalysisTabContent: () => <span>Account analysis</span>,
}));

const personId = parsePublicId<"User">("ProfilePerson001");
const references = createDashboardReferenceStore();
const accountTemplate = { publicId: personId, name: "Shared profile", email: "profile@test.invalid", phone: "+32 123",
    cssClass: null, createdAt: new Date("2026-01-01T12:00:00Z"), isDeleted: false, isSysAdmin: false };
const membership = { publicId: "ProfileMember001", userId: personId, user: accountTemplate, bandUserInstruments: [], bandUserTagAssignments: [], bandRoleId: null, bandRole: null, isDeleted: false };
interface ProfileCapabilities {
    readonly canAssignRole: boolean; readonly canDeactivate: boolean; readonly canReactivate: boolean;
    readonly canResetPassword: boolean; readonly canManageSignInMethods: boolean; readonly mergedIntoUserId: string | null;
}
const initialCapabilities: ProfileCapabilities = { canAssignRole: true, canDeactivate: true, canReactivate: false, canResetPassword: true,
    canManageSignInMethods: true, mergedIntoUserId: null };
const reads: Array<{ query: string; input: QueryInput }> = [];
const writes: Array<{ command: string; context: { bandPublicId: string | null }; payload: unknown }> = [];
const recordedViews: unknown[] = [];
const refetch = vi.fn(async () => {});
const invalidate = vi.fn(async () => {});
const refreshDashboard = vi.fn(async () => {});
const recordFeature = vi.fn(async () => {});
const invoke = vi.fn(async (_input: unknown): Promise<unknown> => ({}));
const push = vi.fn();
const replace = vi.fn(async () => true);
let account = accountTemplate;
let capabilities = initialCapabilities;
let actorId: string;
let permissions: Permission[];
let band: string | null;
let hasMembership: boolean;
let routeLocale: string;
let revision: string;
let requestedTab: string;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    account = accountTemplate; capabilities = initialCapabilities; actorId = personId;
    permissions = [Permission.login]; band = null; hasMembership = false; routeLocale = "fr-BE"; revision = "first"; requestedTab = "attendance";
    reads.length = 0; writes.length = 0; recordedViews.length = 0;
    invoke.mockResolvedValue({}); refetch.mockResolvedValue(undefined); invalidate.mockResolvedValue(undefined);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function click(label: string) {
    const button = [...document.querySelectorAll<HTMLElement>("button, .CMTabHeaderRoot")].find(item => item.textContent?.trim() === label);
    if (!button) {
        throw new Error(`Missing button ${label}`);
    }
    await act(async () => button.click());
}
async function fill(label: string, value: string) {
    const element = [...document.querySelectorAll<HTMLLabelElement>("label")].find(item => item.textContent === label);
    const field = element && document.getElementById(element.htmlFor);
    if (!(field instanceof window.HTMLInputElement)) {
        throw new Error(`Missing field ${label}`);
    }
    await act(async () => { field.value = value; Simulate.change(field); });
}
const own = () => act(async () => root.render(<OwnProfileContent personId={personId} />));
const platform = (mode: "controls" | "page" = "page") => act(async () => root.render(<AccountProfile personId={personId} mode={mode} />));

describe("profile closure interactions", () => {
    it("reads and edits the own account without band context and records only a committed profile edit", async () => {
        await own();
        expect(container.textContent).toContain("Shared profile");
        expect(reads[0]?.input).toMatchObject({ bandPublicId: null, table: { viewID: "User_Editor" } });
        expect(container.textContent).not.toContain("Band instruments");
        await click("Edit shared profile"); await fill("Name", " Updated person "); await fill("Phone", " "); await click("Save profile");
        expect(writes).toEqual([{ command: "User_Update", context: { bandPublicId: null }, payload: { identity: personId, patch: { name: "Updated person", phone: null } } }]);
        expect(recordFeature).toHaveBeenCalledWith({ feature: "profile_edit", context: `profile/${personId}` });
        expect(refetch).toHaveBeenCalledOnce(); expect(invalidate).toHaveBeenCalledOnce();
    });
    it("keeps failed edits open for retry and cancels without writes or edit telemetry", async () => {
        await own(); await click("Edit shared profile"); await fill("Name", "Unsaved profile");
        invoke.mockRejectedValueOnce(new Error("Fresh rejection")); await click("Save profile");
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Could not update the profile.");
        expect(recordFeature).not.toHaveBeenCalled();
        expect([...document.querySelectorAll<HTMLInputElement>("input")].some(field => field.value === "Unsaved profile")).toBe(true);
        await click("Cancel"); expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(writes).toHaveLength(1);
    });
    it("discards old drafts on band and locale revisions while keeping account writes explicitly unscoped", async () => {
        band = "ProfileBand00001"; hasMembership = true; await own();
        expect(container.textContent).toContain("Band instruments"); expect(container.textContent).toContain("Band tags");
        await click("Edit shared profile"); await fill("Name", "Old band draft");
        band = "ProfileBand00002"; routeLocale = "nl-BE"; revision = "second"; await own();
        expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(writes).toEqual([]);
        expect(reads.at(-1)?.input).toMatchObject({ bandPublicId: band, table: { viewID: "BandUser_Profile" } });
    });
    it("hides platform data and controls from a band-only manager without making a platform read", async () => {
        permissions = [Permission.login, Permission.manage_users]; band = "ProfileBand00001"; await platform();
        expect(container.textContent).toBe(""); expect(reads).toEqual([]);
    });
    it("shows deactivation and merge status, a contextual remaining-account link and no merged-account editor", async () => {
        permissions = [Permission.login, Permission.manage_global_users]; account = { ...accountTemplate, isDeleted: true }; await platform();
        expect(reads[0]?.input).toMatchObject({ bandPublicId: null, includeDeleted: true });
        expect(container.textContent).toContain("This account is deactivated.");
        capabilities = { ...initialCapabilities, canAssignRole: false, mergedIntoUserId: "ProfilePerson002" }; revision = "merged"; await platform();
        expect(container.textContent).toContain("cannot be reactivated");
        expect(container.querySelector('a[href*="ProfilePerson002"]')?.getAttribute("href"))
            .toBe("/backstage/user/ProfilePerson002?routeLocale=fr-BE");
        expect(container.textContent).not.toContain("Edit shared profile");
    });
    it("leaves a deactivated band profile for its account URL while retaining the explicit route locale", async () => {
        permissions = [Permission.login, Permission.manage_global_users]; band = "ProfileBand00001"; await platform("controls");
        await click("Deactivate account"); expect(replace).toHaveBeenCalledWith(`/backstage/user/${personId}?routeLocale=fr-BE`);
    });
    it("retains contextual analytic tabs and dedicated impersonation independent of account management", async () => {
        permissions = [Permission.login, Permission.sysadmin]; band = "ProfileBand00001"; requestedTab = "credits";
        await act(async () => root.render(<UserDetail person={accountTemplate} />));
        expect(container.textContent).toContain("Song credits");
        await click("Wiki Contributions"); expect(push).toHaveBeenCalledWith(
            `/backstage/user/${personId}/shared-profile/wiki?bandPublicId=${band}&routeLocale=fr-BE`, undefined, { shallow: true });
        permissions = [Permission.login, Permission.impersonate_user]; actorId = "ProfileActor0001";
        await act(async () => root.render(<UserDetail person={accountTemplate} />));
        expect(container.textContent).toContain("Impersonate account"); expect(container.textContent).not.toContain("Attendance history");
        expect(reads).toEqual([]);
    });
});
