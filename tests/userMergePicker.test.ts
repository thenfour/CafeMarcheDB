// @vitest-environment jsdom
import { createTestRouter } from "./support/routing";
import { parsePortalPath } from "src/route/portalRouting";
vi.mock("src/route/useCmdbRouter", () => ({ useCmdbRouter: () => createTestRouter({ baseUri: window.location.origin, hosting: { kind: "multiBand" }, requestPath: parsePortalPath("/platform", { kind: "multiBand" }) }, { push: navigate }) }));
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPublicId } from "shared/publicId";
import type { MergeIdentity, UserMergePreview } from "src/auth/userMergeSchemas";
import type { CMDialogProps } from "src/core/components/CMDialog";
import type { UserMassAnalysisResult } from "src/core/db3/shared/getUserMassAnalysisTypes";
import { userPublicId } from "./support/userFixtures";

vi.mock("@blitzjs/rpc", () => ({
    invoke: vi.fn(),
    useMutation: () => [commitMutation],
    // Disabled queries still expose cached data; changed keys can expose previous data.
    useQuery: (_query: unknown, args: { userId: UserPublicId }, options: object) => {
        queries.push({ args, options });
        return [analyses.get(args.userId) ?? previousAnalysis, { error: queryErrors.get(args.userId), refetch: refreshAnalysis }];
    },
}));
vi.mock("src/auth/mutations/mergeUsers", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/previewUserMerge", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/searchUserMergeCandidates", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/getUserMergeAccountAnalysis", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => requestContext }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: { authorization: { userPublicId: actorId } } }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: string) => controlLabels[key] ?? key }) }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: navigate }) }));
vi.mock("src/core/components/CMDialog", () => ({
    CMDialog: ({ children, header, actions }: CMDialogProps) => React.createElement("div", { role: "dialog" }, header, children, actions),
}));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMUserMgmtButton: (props: React.ComponentProps<"button">) => React.createElement("button", props),
    CMButton: (props: React.ComponentProps<"button">) => React.createElement("button", props),
}));
vi.mock("src/core/db3/components/IconMap", () => ({ RenderMuiIcon: () => null, gIconMap: {} }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: () => null }));
vi.mock("src/core/components/CMTable", () => ({
    CMTable: ({ rows }: { rows: { label: string; value: React.ReactNode }[] }) => React.createElement("table", null,
        React.createElement("tbody", null, rows.map((row, index) => React.createElement("tr", { key: index },
            React.createElement("th", null, row.label), React.createElement("td", null, row.value)))),
    ),
}));

vi.mock("src/core/components/DateTime/DateTimeComponents", () => ({ DateValue: () => null }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ formattingLocale: "fr-BE", localTimeZone: "Asia/Tokyo" }) }));

import { invoke } from "@blitzjs/rpc";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
import previewUserMerge from "src/auth/queries/previewUserMerge";
import { MergeUsersButton } from "src/core/components/user/MergeUsersButton";

const profile = { publicId: userPublicId(10), name: "Profile account" };
const candidate = (id: number, name: string): MergeIdentity => ({
    publicId: userPublicId(id), name, email: `${id}@test.invalid`, createdAt: new Date("2026-01-01"),
    roleId: null, roleName: null, isDeleted: false, isSysAdmin: false,
});
const first = candidate(20, "First other account");
const second = candidate(30, "Second other account");
const analysis = (user: { publicId: UserPublicId; name: string }): UserMassAnalysisResult => ({
    userInfo: { ...user, email: "test@test.invalid", createdAt: new Date("2026-01-01"),
        globalRoleId: null, globalRoleName: "", globalRoleIsDeleted: false, isProtectedAdministrator: false, mergedIntoUserId: null, mergedAt: null, isDeleted: false, isSysAdmin: false, hasGoogleIdentity: false },
    contentCounts: { createdSongs: 0, createdEvents: 0, createdWikiPages: 0, createdGalleryItems: 0,
        uploadedFiles: 0, createdMenuLinks: 0, createdCustomLinks: 0, songCredits: 0, setlistPlans: 0, wikiPageRevisions: 0 },
    participationCounts: { eventResponses: 0, eventSegmentResponses: 0, taggedFiles: 0, instruments: 0, userTags: 0 },
    systemCounts: { actions: 0, sessions: 0, tokens: 0, changes: 0, signInMethods: 0, userSettings: 0 },
    activityMetrics: { accountAgeInDays: 0, hasEverLoggedIn: false, lastActivityDate: null, daysSinceLastActivity: null },
    memberships: [],
    riskAssessment: { riskLevel: "low", safeToDelete: true, warnings: [], blockers: [] },
});
const analyses = new Map<UserPublicId, UserMassAnalysisResult>();
let previousAnalysis: UserMassAnalysisResult;
let root: Root;
const commitMutation = vi.fn();
const navigate = vi.fn();
const refreshAnalysis = vi.fn();
const queryErrors = new Map<UserPublicId, Error>();
const queries: { args: { userId: UserPublicId }; options: object }[] = [];
let actorId = userPublicId(1);
let requestContext: { routeLocale: string; browserLanguages: string[]; clientRequestId: string; bandPublicId: string };
const controlLabels: { [key: string]: string } = {
    // These test labels make the rendered controls readable while retaining real selection behavior.
    "accountMerge.open": "Merge with another user", "accountMerge.select": "Select another user", "accountMerge.preview": "Preview merge",
    "accountMerge.swap": "Swap Main and Retiring", "accountMerge.cancel": "Cancel", "accountMerge.keep": "Account to keep", "accountMerge.retire": "Account to retire",
    "accountMerge.accept": "Accept report and merge accounts", "accountMerge.refresh": "Refresh analysis",
};
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    actorId = userPublicId(1);
    requestContext = { routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "1", bandPublicId: "MergeBand0000001" };
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue([first, second]);
    commitMutation.mockReset(); navigate.mockReset(); refreshAnalysis.mockReset();
    queries.length = 0; queryErrors.clear();
    analyses.clear();
    analyses.set(profile.publicId, analysis(profile));
    analyses.set(first.publicId, analysis(first));
    previousAnalysis = analysis(profile);
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
    else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
const button = (text: string) => {
    const result = [...document.querySelectorAll("button")].find(item => item.textContent?.trim() === text);
    if (!result) throw new Error(`Button not found: ${text}`);
    return result;
};
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const render = async () => { await act(async () => root.render(React.createElement(MergeUsersButton, { user: profile }))); };
const cards = () => [...document.querySelectorAll<HTMLDivElement>(".user-mass-analysis-summary-card")];
const search = async (text: string) => {
    const input = document.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error("Search input not found");
    await act(async () => {
        input.value = text;
        Simulate.change(input);
    });
};
const select = async (name: string) => {
    await click(button("Select another user"));
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
        .find(item => item.textContent?.includes(name));
    if (!option) throw new Error(`Candidate not found: ${name}`);
    await click(option);
};

describe("user merge dialog", () => {
    it.each(["Lisa", "lIsA", "Smet Lisa", "lisa@example", userPublicId(40)])("keeps server matches visible when searching for %s", async query => {
        const lisa = { ...candidate(40, "Lisa De Smet"), email: "lisa@example.test" };
        vi.mocked(invoke).mockResolvedValue([lisa]);
        await render();
        await click(button("Merge with another user"));
        await click(button("Select another user"));
        await search(query);
        expect(invoke).toHaveBeenLastCalledWith(searchUserMergeCandidates, { query, excludeUserId: profile.publicId, routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "1" });
        const option = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
            .find(item => item.textContent?.includes(lisa.name));
        expect(option).toBeDefined();
        await click(option!);
        expect(button("Preview merge").disabled).toBe(false);
    });

    it("starts with no other account even when the disabled query returns cached profile data", async () => {
        await render();
        expect(queries).toHaveLength(0);
        await click(button("Merge with another user"));
        expect(cards()).toHaveLength(1);
        expect(cards()[0]!.textContent).toContain(profile.name);
        expect(button("Preview merge").disabled).toBe(true);
        expect(button("Swap Main and Retiring").disabled).toBe(true);
        expect(vi.mocked(invoke)).not.toHaveBeenCalled();
        expect(queries.every(query => !("bandPublicId" in query.args))).toBe(true);
        expect(queries[1]?.options).toMatchObject({ enabled: false, staleTime: 0, cacheTime: 0, keepPreviousData: false });
    });

    it("loads candidates once, supports manual selection and swapping, and clears on None and reopening", async () => {
        await render();
        await click(button("Merge with another user"));
        await click(button("Select another user"));
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith(searchUserMergeCandidates, { query: "", excludeUserId: profile.publicId, routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "1" });
        await render();
        expect(invoke).toHaveBeenCalledTimes(1);
        const option = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
            .find(item => item.textContent?.includes(first.name))!;
        await click(option);
        expect(cards()).toHaveLength(2);
        expect(cards()[1]!.textContent).toContain(first.name);
        expect(button("Preview merge").disabled).toBe(false);
        await click(button("Swap Main and Retiring"));
        expect(cards()[0]!.textContent).toContain(first.name);
        expect(cards()[1]!.textContent).toContain(profile.name);
        await select("None");
        expect(cards()).toHaveLength(1);
        expect(cards()[0]!.textContent).toContain(profile.name);
        expect(button("Preview merge").disabled).toBe(true);
        await click(button("Cancel"));
        await click(button("Merge with another user"));
        expect(cards()).toHaveLength(1);
        expect(button("Swap Main and Retiring").disabled).toBe(true);
    });

    it("hides previous-account analysis while the newly selected account is loading", async () => {
        await render();
        await click(button("Merge with another user"));
        await select(first.name);
        previousAnalysis = analysis(first);
        await select(second.name);
        expect(cards()).toHaveLength(1);
        expect(cards()[0]!.textContent).toContain(profile.name);
        analyses.set(second.publicId, analysis(second));
        await render();
        expect(cards()).toHaveLength(2);
        expect(cards()[1]!.textContent).toContain(second.name);
    });
});

const previewReport = (canCommit = true): UserMergePreview => ({ policyVersion: 2,
    main: candidate(10, profile.name), retiring: first, canCommit, confirmation: "a".repeat(64),
    sections: [{ key: "memberships", title: { key: "accountMerge.membershipTitle" }, policy: { key: "accountMerge.membershipPolicy" },
        effects: [{ label: { key: "accountMerge.importedMembers" }, count: 12000 }], blockers: canCommit ? [] : ["Resolve this blocker"] }],
});
async function prepareReport(report = previewReport()) {
    await render(); await click(button("Merge with another user")); await select(first.name);
    vi.mocked(invoke).mockResolvedValueOnce(report);
    await click(button("Preview merge"));
}
describe("merge report lifecycle", () => {
    it("submits only the reviewed direction, confirmation and presentation, prevents duplicate submission and navigates to Main", async () => {
        await prepareReport();
        expect(document.querySelector('.user-merge-report')?.textContent).toContain(new Intl.NumberFormat("fr-BE").format(12000));
        let complete!: (value: { mainUserId: UserPublicId }) => void;
        commitMutation.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        await click(button("Accept report and merge accounts"));
        expect(button("Accept report and merge accounts").disabled).toBe(true);
        expect(button("Cancel").disabled).toBe(true);
        await click(button("Accept report and merge accounts"));
        expect(commitMutation).toHaveBeenCalledTimes(1);
        expect(commitMutation).toHaveBeenCalledWith({ participants: { mainUserId: profile.publicId, retiringUserId: first.publicId }, confirmation: "a".repeat(64),
            routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "1" });
        await act(async () => complete({ mainUserId: profile.publicId }));
        expect(navigate).toHaveBeenCalledWith("/fr-BE/platform/user/" + profile.publicId, undefined, undefined);
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    it("blocks a report with blockers, resets the report on swapping and previews the reversed direction", async () => {
        await prepareReport(previewReport(false));
        expect(button("Accept report and merge accounts").disabled).toBe(true);
        await click(button("Swap Main and Retiring"));
        expect(document.querySelector('.user-merge-report')).toBeNull();
        vi.mocked(invoke).mockResolvedValueOnce(previewReport());
        await click(button("Preview merge"));
        expect(invoke).toHaveBeenLastCalledWith(previewUserMerge, expect.objectContaining({ participants: { mainUserId: first.publicId, retiringUserId: profile.publicId } }));
    });
    it("requires a fresh preview after failed commits and hides a cached report after authorization failure", async () => {
        await prepareReport();
        commitMutation.mockRejectedValueOnce(new Error("The accounts changed. Refresh the report."));
        await click(button("Accept report and merge accounts"));
        expect(document.querySelector('.user-merge-report')).toBeNull();
        expect(document.body.textContent).toContain("The accounts changed");
        expect(button("Preview merge").disabled).toBe(false);
        vi.mocked(invoke).mockResolvedValueOnce(previewReport()); await click(button("Preview merge"));
        queryErrors.set(profile.publicId, new Error("merge_users revoked")); await render();
        expect(document.querySelector('.user-merge-report')).toBeNull();
        expect(button("Accept report and merge accounts").disabled).toBe(true);
        expect(cards()).toHaveLength(1);
        queryErrors.clear(); await render(); await click(button("Refresh analysis"));
        expect(refreshAnalysis).toHaveBeenCalledTimes(2);
        expect(document.querySelector('.user-merge-report')).toBeNull();
    });
    it.each(["band", "route", "language order", "revision", "actor"])("closes the old preview and clears candidates on %s changes", async scope => {
        await prepareReport();
        if (scope === "band") { requestContext = { ...requestContext, bandPublicId: "MergeBand0000002" }; }
        if (scope === "route") { requestContext = { ...requestContext, routeLocale: "nl-BE" }; }
        if (scope === "language order") { requestContext = { ...requestContext, browserLanguages: ["nl-BE", "fr-BE"] }; }
        if (scope === "revision") { requestContext = { ...requestContext, clientRequestId: "2" }; }
        if (scope === "actor") { actorId = userPublicId(2); }
        await render(); expect(document.querySelector('[role="dialog"]')).toBeNull();
        await click(button("Merge with another user")); expect(button("Preview merge").disabled).toBe(true);
    });
    it("discards a held old preview after the actor changes", async () => {
        await render(); await click(button("Merge with another user")); await select(first.name);
        let complete!: (value: UserMergePreview) => void;
        vi.mocked(invoke).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
        await click(button("Preview merge"));
        actorId = userPublicId(2); await render(); await click(button("Merge with another user"));
        await act(async () => complete(previewReport()));
        expect(document.querySelector('.user-merge-report')).toBeNull();
        expect(button("Preview merge").disabled).toBe(true);
    });
});
