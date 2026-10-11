// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type getHistory from "src/core/db3/queries/getUserEventAttendance";
import type getContributions from "src/core/db3/queries/getUserWikiContributions";

vi.mock("src/core/db3/queries/getUserEventAttendance", () => ({ default: "attendance" }));
vi.mock("src/core/db3/queries/getUserWikiContributions", () => ({ default: "wiki" }));
vi.mock("src/core/db3/queries/getUserCredits", () => ({ default: "credits" }));
vi.mock("src/core/db3/queries/getUserMassAnalysis", () => ({ default: "analysis" }));
vi.mock("src/core/db3/queries/getUserAccountAnalysisChoices", () => ({ default: "choices" }));
vi.mock("@blitzjs/rpc", () => ({ useQuery: (query: string, input: object, options: object) => {
    queries.push({ query, input, options });
    return [query === "attendance" ? history : contributions];
} }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => ({
    requireBandPublicId: () => bandId,
    formattingLocale: language, localTimeZone: "America/Los_Angeles",
    eventDatePresentation: { viewerTimeZone: "America/Los_Angeles", bandTimeZone: "Europe/Brussels", locale: language },
    memberPresentation: { bandPublicId: bandId, routeLocale: language },
    eventAttendance: { getById: (id: string | null) => id ? { publicId: id, strength: id === goingId ? 100 : 0 } : null },
    instrument: { getById: () => null },
}) }));
vi.mock("src/core/components/CMChip", () => ({
    CMChip: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
    CMChipContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("src/core/components/CMCoreComponents", () => ({ InstrumentChip: () => null }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    AdminInspectObject: () => null,
    KeyValueTable: ({ data }: { data: { [label: string]: React.ReactNode } }) => <dl>{Object.entries(data).map(([key, value]) =>
        <React.Fragment key={key}><dt>{key}</dt><dd data-summary={key}>{value}</dd></React.Fragment>)}</dl>,
}));
vi.mock("src/core/components/event/AttendanceChips", () => ({ AttendanceChip: () => <span>Response</span> }));
vi.mock("src/core/components/event/EventChips", () => ({ EventChip: ({ value }: { value: { name: string } }) => <span>{value.name}</span> }));
vi.mock("src/core/components/markdown/Markdown", () => ({ Markdown: ({ markdown }: { markdown: string }) => <span>{markdown}</span> }));
vi.mock("src/core/components/CMLink", () => ({ CMLink: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("src/core/db3/components/useDB3Context", () => ({ useDB3QueryContext: () => ({}) }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({ getPlainString: (key: string) => key }) }));
vi.mock("src/locale/components/PresentationProvider", () => ({ usePresentation: () => ({ data: null }) }));
vi.mock("src/core/components/user/userChip", () => ({ UserChip: () => null }));

import { UserAttendanceTabContent, UserWikiContributionsTabContent } from "src/core/components/user/UserAnalyticTables";

type History = Awaited<ReturnType<typeof getHistory>>;
type Contributions = Awaited<ReturnType<typeof getContributions>>;
let history: History;
let contributions: Contributions;
let queries: Array<{ query: string; input: object; options: object }>;
let root: Root;
let container: HTMLDivElement;
let bandId = parsePublicId<"Band">("ProfileBand00001");
let language: string;
const person = { publicId: parsePublicId<"User">("ProfilePerson001") };
const goingId = parsePublicId<"EventAttendance">("ProfileGoing0001");
const noId = parsePublicId<"EventAttendance">("ProfileAbsent001");

function event(name: string, isAllDay: boolean, answers: Array<typeof goingId | null>): History["events"][number] {
    return { publicId: parsePublicId<"Event">("ProfileEvent0001"), name, startsAt: new Date("2026-03-28T23:30:00Z"),
        isAllDay, durationMillis: BigInt(3600000), typeId: null, statusId: null, expectedAttendanceUserTagId: null,
        instrumentId: null, userComment: "Visible comment", isInvited: false,
        segments: answers.map((attendanceId, index) => ({ publicId: parsePublicId<"EventSegment">(`ProfileSet00000${index}`),
            name: "Set", startsAt: new Date("2026-03-28T23:30:00Z"), isAllDay: false, durationMillis: BigInt(0), statusId: null, attendanceId })),
    };
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    bandId = parsePublicId<"Band">("ProfileBand00001");
    language = "fr-BE";
    history = { events: [] };
    contributions = { wikiContributions: [] };
    queries = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("profile attendance and contribution parity", () => {
    it("retains response/attendance statistics, original page sizes and strict fresh query inputs", async () => {
        history.events = [event("Concert", false, [goingId, noId, null])];
        await act(async () => root.render(<UserAttendanceTabContent user={person} />));
        expect(container.querySelector('[data-summary="totalSegmentCount"]')?.textContent).toBe("3");
        expect(container.querySelector('[data-summary="Response rate"]')?.textContent).toBe("66.7%");
        expect(container.querySelector('[data-summary="Attendance rate (overall)"]')?.textContent).toBe("33.3%");
        expect(container.querySelector('[data-summary="Attendance rate (when responding)"]')?.textContent).toBe("50.0%");
        for (const take of [50, 100, 250, 500, 1000]) {
            const chip = [...container.querySelectorAll("button")].find(button => button.textContent === String(take))!;
            await act(async () => chip.click());
            expect(queries.at(-1)).toEqual({ query: "attendance", input: { bandPublicId: bandId, userId: person.publicId, take },
                options: { staleTime: 0, cacheTime: 0, keepPreviousData: false } });
        }
        expect(container.textContent).toContain("Visible comment");
    });

    it("shows an absent rate for unanswered events instead of dividing by zero", async () => {
        history.events = [event("Unanswered", false, [null, null])];
        await act(async () => root.render(<UserAttendanceTabContent user={person} />));
        expect(container.querySelector('[data-summary="Attendance rate (when responding)"]')?.textContent).toBe("--");
        expect(container.textContent).not.toMatch(/NaN|Infinity/);
        history.events = [];
        await act(async () => root.render(<UserAttendanceTabContent user={person} />));
        expect(container.querySelector("dl")).toBeNull();
    });

    it("uses band calendar dates for all-day Events and viewer dates for timed Events", async () => {
        history.events = [event("All day", true, [null]), event("Timed", false, [null])];
        await act(async () => root.render(<UserAttendanceTabContent user={person} />));
        const dates = [...container.querySelectorAll(".DateValue")].map(date => date.textContent);
        expect(dates).toEqual(["dim. 29 mars 2026", "sam. 28 mars 2026"]);
        expect([...container.querySelectorAll("tbody tr")].map(row => row.textContent)).toEqual([
            expect.stringContaining("All day"), expect.stringContaining("Timed"),
        ]);
    });

    it("retains Wiki revision counts, first/latest dates, sortable columns and contextual links", async () => {
        contributions.wikiContributions = [
            { publicId: parsePublicId<"WikiPage">("ProfileWiki00001"), slug: "alpha", revisions: [
                { createdAt: new Date("2026-03-28T23:30:00Z"), createdByUser: null },
                { createdAt: new Date("2025-02-10T08:00:00Z"), createdByUser: null },
            ] },
            { publicId: parsePublicId<"WikiPage">("ProfileWiki00002"), slug: "beta", revisions: [
                { createdAt: new Date("2025-01-01T08:00:00Z"), createdByUser: null },
            ] },
        ];
        await act(async () => root.render(<UserWikiContributionsTabContent user={person} />));
        const row = container.querySelector("tbody tr")!;
        expect(row.textContent).toContain("alpha2lun. 10 févr. 2025sam. 28 mars 2026");
        expect(row.querySelector("a")?.getAttribute("href")).toBe(`/backstage/wiki/alpha?bandPublicId=${bandId}&routeLocale=fr-BE`);
        const header = [...container.querySelectorAll("th")].find(th => th.textContent?.startsWith("Revisions"))!;
        await act(async () => header.click());
        expect(container.querySelector("tbody tr a")?.textContent).toBe("beta");
        await act(async () => header.click());
        expect(container.querySelector("tbody tr a")?.textContent).toBe("alpha");
        bandId = parsePublicId<"Band">("ProfileBand00002");
        language = "nl-BE";
        contributions = { wikiContributions: [] };
        await act(async () => root.render(<UserWikiContributionsTabContent key={bandId} user={person} />));
        expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
        expect(queries.at(-1)).toEqual({ query: "wiki", input: { bandPublicId: bandId, userId: person.publicId },
            options: { staleTime: 0, cacheTime: 0, keepPreviousData: false } });
    });
});
