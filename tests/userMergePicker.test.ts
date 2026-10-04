// @vitest-environment jsdom
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPublicId } from "shared/publicId";
import type { MergeIdentity } from "src/auth/userMergeSchemas";
import type { CMDialogProps } from "src/core/components/CMDialog";
import type { UserMassAnalysisResult } from "src/core/db3/shared/getUserMassAnalysisTypes";
import { userPublicId } from "./support/userFixtures";

vi.mock("@blitzjs/rpc", () => ({
    invoke: vi.fn(),
    useMutation: () => [vi.fn()],
    // Disabled queries still expose cached data; changed keys can expose previous data.
    useQuery: (_query: unknown, args: { userId: UserPublicId }) => [
        analyses.get(args.userId) ?? previousAnalysis, { refetch: vi.fn() },
    ],
}));
vi.mock("src/auth/mutations/mergeUsers", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/previewUserMerge", () => ({ default: vi.fn() }));
vi.mock("src/auth/queries/searchUserMergeCandidates", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/queries/getUserMassAnalysis", () => ({ default: vi.fn() }));
vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn(), reload: vi.fn() }) }));
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
vi.mock("src/core/components/RoleChip", () => ({ RoleChip: () => null }));
vi.mock("src/core/components/DateTime/DateTimeComponents", () => ({ DateValue: () => null }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({}) }));

import { invoke } from "@blitzjs/rpc";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
import { MergeUsersButton } from "src/core/components/user/MergeUsersButton";

const profile = { publicId: userPublicId(10), name: "Profile account" };
const candidate = (id: number, name: string): MergeIdentity => ({
    publicId: userPublicId(id), name, email: `${id}@test.invalid`, createdAt: new Date("2026-01-01"),
    roleId: null, isDeleted: false, isSysAdmin: false,
});
const first = candidate(20, "First other account");
const second = candidate(30, "Second other account");
const analysis = (user: { publicId: UserPublicId; name: string }): UserMassAnalysisResult => ({
    userInfo: { ...user, email: "test@test.invalid", createdAt: new Date("2026-01-01"),
        roleId: null, roleName: null, isDeleted: false, isSysAdmin: false, hasGoogleIdentity: false },
    contentCounts: { createdSongs: 0, createdEvents: 0, createdWikiPages: 0, createdGalleryItems: 0,
        uploadedFiles: 0, createdMenuLinks: 0, createdCustomLinks: 0, songCredits: 0, setlistPlans: 0, wikiPageRevisions: 0 },
    participationCounts: { eventResponses: 0, eventSegmentResponses: 0, taggedFiles: 0, instruments: 0, userTags: 0 },
    systemCounts: { actions: 0, sessions: 0, tokens: 0 },
    activityMetrics: { accountAgeInDays: 0, hasEverLoggedIn: false, lastActivityDate: null, daysSinceLastActivity: null },
    riskAssessment: { riskLevel: "low", safeToDelete: true, warnings: [], blockers: [] },
});
const analyses = new Map<UserPublicId, UserMassAnalysisResult>();
let previousAnalysis: UserMassAnalysisResult;
let root: Root;
const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue([first, second]);
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
        expect(invoke).toHaveBeenLastCalledWith(searchUserMergeCandidates, { query, excludeUserId: profile.publicId });
        const option = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
            .find(item => item.textContent?.includes(lisa.name));
        expect(option).toBeDefined();
        await click(option!);
        expect(button("Preview merge").disabled).toBe(false);
    });

    it("starts with no other account even when the disabled query returns cached profile data", async () => {
        await render();
        await click(button("Merge with another user"));
        expect(cards()).toHaveLength(1);
        expect(cards()[0]!.textContent).toContain(profile.name);
        expect(button("Preview merge").disabled).toBe(true);
        expect(button("Swap Main and Retiring").disabled).toBe(true);
        expect(vi.mocked(invoke)).not.toHaveBeenCalled();
    });

    it("loads candidates once, supports manual selection and swapping, and clears on None and reopening", async () => {
        await render();
        await click(button("Merge with another user"));
        await click(button("Select another user"));
        expect(invoke).toHaveBeenCalledTimes(1);
        expect(invoke).toHaveBeenCalledWith(searchUserMergeCandidates, { query: "", excludeUserId: profile.publicId });
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
