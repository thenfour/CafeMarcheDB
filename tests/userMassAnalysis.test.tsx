// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId, type UserPublicId } from "shared/publicId";
import type { DB3QueryContextInput } from "src/core/db3/components/useDB3Context";
import type { AccountAnalysisChoice } from "src/core/components/user/AccountAnalysisComparisonPicker";
import type { UserMassAnalysisResult } from "src/core/db3/shared/getUserMassAnalysisTypes";

vi.mock("src/core/db3/queries/getUserMassAnalysis", () => ({ default: "analysis" }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (query: string, input: { userId: UserPublicId }, options: { enabled?: boolean }) => {
    queries.push({ query, input, options });
    return [reports.get(wrongCandidate && input.userId === secondId ? firstId : input.userId), {
        error: errors.get(input.userId), isFetching: fetching.has(input.userId), refetch: () => refresh(input.userId),
    }];
} }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => context }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: { authorization: { userPublicId: actorId } } }) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: string) => key }) }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({ formattingLocale: language, localTimeZone: timeZone }) }));
vi.mock("src/core/components/CMCoreComponents2", () => ({ CMButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock("src/core/components/ResponsiveDialog", () => ({ ResponsiveDialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => open ? <div role="dialog">{children}</div> : null }));
vi.mock("src/core/components/user/userChip", () => ({ UserChip: ({ value }: { value: { name: string } }) => <span>{value.name}</span> }));
vi.mock("src/core/components/user/AccountAnalysisComparisonPicker", () => ({
    AccountAnalysisComparisonPicker: ({ onSelect, onClose }: { onSelect: (account: AccountAnalysisChoice) => void; onClose: () => void }) =>
        <div>{[firstId, secondId].map(publicId => <button key={publicId} onClick={() => {
            onSelect({ publicId, name: publicId === firstId ? "First candidate" : "Second candidate", email: "candidate@test.invalid", isDeleted: true });
            onClose();
        }}>{publicId === firstId ? "Choose first" : "Choose second"}</button>)}</div>,
}));

import { AccountAnalysisAction, AccountAnalysisReport, UserMassAnalysisTabContent } from "src/core/components/user/UserMassAnalysisTab";
const mainId = parsePublicId<"User">("AnalysisPerson01");
const firstId = parsePublicId<"User">("AnalysisPerson02");
const secondId = parsePublicId<"User">("AnalysisPerson03");
function report(publicId: UserPublicId, name: string): UserMassAnalysisResult {
    return {
        userInfo: { publicId, name, email: "person@test.invalid", createdAt: new Date("2026-03-28T23:30:00Z"), isSysAdmin: false,
            isDeleted: false, isProtectedAdministrator: false, globalRoleId: null, globalRoleName: "", globalRoleIsDeleted: false,
            mergedIntoUserId: null, mergedAt: null, hasGoogleIdentity: false },
        contentCounts: { createdSongs: 0, createdEvents: 0, createdWikiPages: 0, createdGalleryItems: 0, uploadedFiles: 0,
            createdMenuLinks: 0, createdCustomLinks: 0, songCredits: 0, setlistPlans: 0, wikiPageRevisions: 0 },
        participationCounts: { eventResponses: 0, eventSegmentResponses: 0, taggedFiles: 0, instruments: 0, userTags: 0 },
        systemCounts: { actions: 0, sessions: 0, tokens: 0, changes: 0, signInMethods: 0, userSettings: 0 },
        activityMetrics: { accountAgeInDays: 10, hasEverLoggedIn: false, lastActivityDate: null, daysSinceLastActivity: null },
        riskAssessment: { safeToDelete: true, riskLevel: "low", warnings: [], blockers: [] }, memberships: [],
    };
}
let context: DB3QueryContextInput;
let actorId: UserPublicId;
let language: string;
let timeZone: string;
let root: Root;
let container: HTMLDivElement;
let reports: Map<UserPublicId, UserMassAnalysisResult>;
let errors: Map<UserPublicId, Error>;
let fetching: Set<UserPublicId>;
let wrongCandidate: boolean;
let queries: Array<{ query: string; input: object; options: object }>;
const refresh = vi.fn();
const renderTab = () => act(async () => root.render(<UserMassAnalysisTabContent user={{ publicId: mainId }} />));
async function click(label: string) {
    const button = [...container.querySelectorAll("button")].find(item => item.textContent === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
}
async function choose(label: string) {
    await click("accountAnalysis.compare");
    await click(label);
}
const row = (label: string) => [...container.querySelectorAll("tbody tr")].find(item => item.querySelector("td")?.textContent === label);

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    context = { bandPublicId: parsePublicId<"Band">("AnalysisBand0001"), routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "revision1" };
    actorId = mainId;
    language = "fr-BE";
    timeZone = "America/Los_Angeles";
    queries = [];
    reports = new Map([[mainId, report(mainId, "Primary")], [firstId, report(firstId, "First report")], [secondId, report(secondId, "Second report")]]);
    errors = new Map();
    fetching = new Set();
    wrongCandidate = false;
    refresh.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("restored account dependency tables and comparison", () => {
    it("keeps list analysis lazy and sends public account/ordered locale inputs without selected-band scope", async () => {
        await act(async () => root.render(<AccountAnalysisAction userId={mainId} />));
        expect(queries).toEqual([]);
        await click("accountAnalysis.inspect");
        expect(queries[0]?.input).toEqual({ userId: mainId, routeLocale: "fr-BE", browserLanguages: ["fr-BE", "nl-BE"], clientRequestId: "revision1" });
        expect(queries[0]?.options).toMatchObject({ staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
        expect(queries[1]?.options).toMatchObject({ enabled: false });
    });
    it("shows original tables/bars when only the comparison has dependencies; formats dates, blanks and unknown activity explicitly", async () => {
        const main = reports.get(mainId)!;
        const comparison = reports.get(firstId)!;
        comparison.contentCounts.createdSongs = 1240;
        comparison.participationCounts.eventResponses = 2;
        comparison.systemCounts.signInMethods = 2;
        await act(async () => root.render(<AccountAnalysisReport analysis={main} comparison={comparison} />));
        expect([...container.querySelectorAll("h4")].map(title => title.textContent)).toEqual(["Summary Statistics", "Content Created",
            "Participation & Engagement", "System Data", "User Information", "accountAnalysis.memberships: Primary", "accountAnalysis.memberships: First report"]);
        expect(row("Songs")?.lastElementChild?.textContent).toBe(new Intl.NumberFormat("fr-BE").format(1240));
        expect(row("Days Since Last Activity")?.children[1]?.textContent).toBe("--");
        expect(row("accountAnalysis.globalRole")?.children[1]?.textContent).toBe("");
        expect(row("Created")?.children[1]?.textContent).toBe("sam. 28 mars 2026");
        expect(container.querySelectorAll('.account-dependency-risk')).toHaveLength(2);
        expect(row("Songs")?.lastElementChild?.getAttribute("style")).toContain("--fill_percent: 100.00%");
        language = "nl-BE";
        timeZone = "Asia/Tokyo";
        await act(async () => root.render(<AccountAnalysisReport analysis={main} comparison={comparison} />));
        expect(row("Created")?.children[1]?.textContent).toBe("zo 29 mrt 2026");
    });
    it("replaces and clears comparisons, rejects mismatched late results, and refreshes both current reports", async () => {
        await renderTab();
        await choose("Choose first");
        expect(container.textContent).toContain("First report: LOW");
        await click("accountAnalysis.refresh");
        expect(refresh.mock.calls).toEqual([[mainId], [firstId]]);
        wrongCandidate = true;
        await choose("Choose second");
        expect(container.textContent).not.toContain("First report: LOW");
        expect(container.textContent).not.toContain("Second report: LOW");
        wrongCandidate = false;
        await renderTab();
        expect(container.textContent).toContain("Second report: LOW");
        await click("accountAnalysis.clear");
        expect(container.textContent).not.toContain("Second report: LOW");
        expect(queries.at(-1)?.options).toMatchObject({ enabled: false });
    });
    it.each(["band", "route", "preferences", "revision", "actor"])("clears the comparison and dialog after a %s context change", async change => {
        await renderTab();
        await choose("Choose first");
        await click("accountAnalysis.compare");
        if (change === "band") {
            context = { ...context, bandPublicId: parsePublicId<"Band">("AnalysisBand0002") };
        }
        if (change === "route") {
            context = { ...context, routeLocale: "nl-BE" };
        }
        if (change === "preferences") {
            context = { ...context, browserLanguages: ["fr-BE", "en-US"] };
        }
        if (change === "revision") {
            context = { ...context, clientRequestId: "revision2" };
        }
        if (change === "actor") {
            actorId = firstId;
        }
        await renderTab();
        expect(container.textContent).not.toContain("First report: LOW");
        expect(container.textContent).not.toContain("Choose first");
        expect(queries.at(-1)?.options).toMatchObject({ enabled: false });
    });
    it("hides cached data after primary or comparison authorization failures and permits a fresh retry", async () => {
        await renderTab();
        await choose("Choose first");
        errors.set(firstId, new Error("Forbidden"));
        await renderTab();
        expect(container.textContent).not.toContain("First report: LOW");
        expect(container.textContent).toContain("Primary: LOW");
        expect(container.querySelector('[role="alert"]')?.textContent).toContain("accountAnalysis.failed");
        errors.set(mainId, new Error("Forbidden"));
        await renderTab();
        expect(container.textContent).not.toContain("Primary: LOW");
        await click("accountAnalysis.refresh");
        errors.clear();
        await renderTab();
        expect(container.textContent).toContain("First report: LOW");
    });
});
