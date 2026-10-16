// @vitest-environment jsdom
import { createTestRouter } from "./support/routing";
import { parsePortalPath } from "src/route/portalRouting";
vi.mock("src/route/useCmdbRouter", () => ({ useCmdbRouter: () => createTestRouter({ baseUri: "https://test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(`/${dashboard.localePreferences.routeLocale}/b/${dashboard.bandPublicId}/backstage/eventImport`, { kind: "multiBand" }) }) }));
import React from "react";
import { act, Simulate } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import type { TGetImportEventDataRet } from "src/core/db3/shared/apiTypes";
import type * as DB3Module from "src/core/db3/db3";
import { kStaticLocalizedStringRegistry, type LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";

const invoke = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => vi.fn());
vi.mock("@blitzjs/rpc", () => ({ useQuery: query }));
vi.mock("src/core/db3/queries/getImportEventData", () => ({ default: vi.fn() }));
vi.mock("src/core/db3/clientAPI", () => ({ API: { events: { newEventMutation: { useToken: () => ({ invoke }) } } } }));
vi.mock("src/core/components/dashboardContext/DashboardContext", () => ({ useDashboardContext: () => dashboard }));
vi.mock("src/locale/components/useLocale", () => ({ useLocale: () => ({
    getPlainString: (key: LocalizedPlainStringKey) => kStaticLocalizedStringRegistry[key].defaultValue,
}) }));
vi.mock("src/core/components/SnackbarContext", () => ({ useSnackbar: () => ({ showMessage: vi.fn() }) }));
vi.mock("src/core/components/dashboard/DashboardLayout", () => ({ default: ({ children }: React.PropsWithChildren) => <main>{children}</main> }));
vi.mock("src/core/components/CMCoreComponents2", () => ({
    CMButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    NameValuePair: ({ name, value }: { name: string; value: React.ReactNode }) => <div>{name}{value}</div>,
    EventDateField: () => <span>Date</span>,
}));
vi.mock("src/core/components/event/AttendanceChipView", () => ({
    AttendanceChipView: ({ value }: { value: DB3Module.EventAttendanceDisplay | null }) => <span>{value?.buttonCaption}</span>,
    AttendanceChipTooltipContent: () => <span>Attendance tooltip</span>,
}));
vi.mock("src/core/components/VisibilityControl", () => ({ VisibilityControl: () => <span>Visibility</span> }));
vi.mock("src/core/components/event/EventComponentsBase", () => ({ EventTableClientColumns: {
    name: "name", type: "type", status: "status", tags: "tags", expectedAttendanceUserTag: "expectedAttendanceUserTag", visiblePermission: "visiblePermission",
} }));
vi.mock("src/core/components/event/EventSegmentComponents", () => ({ EventSegmentClientColumns: { startsAt: "startsAt" } }));
vi.mock("src/core/db3/db3", async () => ({ ...await vi.importActual<typeof DB3Module>("src/core/db3/db3"),
    xEvent: { authorizeColumnForInsert: () => true },
}));

interface EditorRow { name?: string; startsAt?: Date | null }
vi.mock("src/core/db3/DB3Client", () => ({
    xTableClientCaps: { None: 0 }, useTableRenderContext: vi.fn(), makeClientColumnSelection: (...columns: string[]) => columns,
    defineTableClientSpec: () => ({ args: { table: { ValidateAndComputeDiff: () => ({}) } },
        renderEditor: (field: string, row: EditorRow, _validation: unknown, onChange: (row: EditorRow) => void) => {
            if (field === "name") {
                return <input key={field} aria-label="Event name" value={row.name ?? ""} onChange={event => onChange({ ...row, name: event.target.value })} />;
            }
            if (field === "startsAt") {
                return <input key={field} aria-label="Event date" type="date" value={row.startsAt?.toISOString().slice(0, 10) ?? ""}
                    onChange={event => onChange({ ...row, startsAt: new Date(`${event.target.value}T00:00:00Z`) })} />;
            }
            return <span key={field}>{field}</span>;
        },
    }),
}));

import ImportPage from "src/pages/backstage/eventImport";
const band = parsePublicId<"Band">("ImportBand000001");
const otherBand = parsePublicId<"Band">("ImportBand000002");
const preview: TGetImportEventDataRet = {
    event: { name: "26 October Rehearsal", locationDescription: null, typeId: null, statusId: null, tags: [], expectedAttendanceUserTagId: null, visiblePermissionId: null },
    segment: { name: "Segment 1", description: "", startsAt: new Date("2026-10-26T00:00:00Z"), durationMillis: 86400000, isAllDay: true },
    songList: [{ songId: parsePublicId<"Song">("ImportSong000001"), songName: "Smoke", comment: "solo" }],
    responses: [{ userId: parsePublicId<"User">("ImportPerson0001"), userName: "Carl Member", attendanceId: parsePublicId<"EventAttendance">("ImportAnswer0001") }], log: ["Preview log"],
};
const saved = { event: { publicId: parsePublicId<"Event">("ImportedEvent001"), name: "Edited concert" }, segment: preview.segment };
const dashboard = {
    authorizationContext: { bandPublicId: band },
    requireBandPublicId: () => dashboard.bandPublicId,
    bandPublicId: band, localePreferences: { routeLocale: "fr-BE", browserLanguages: ["nl-BE"] },
    authorization: {}, isAuthorized: () => true, referenceStore: {},
    eventType: { getById: () => null }, eventStatus: { getById: () => null }, userTag: { getById: () => null },
    permission: { getById: () => null }, eventAttendance: { getById: (id: string | null) => id === preview.responses[0]!.attendanceId
        ? { publicId: preview.responses[0]!.attendanceId, buttonCaption: "Oui", description: "Available", color: null, iconName: null, strength: 100, isActive: true, sortOrder: 0 }
        : null },
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    invoke.mockReset(); query.mockReset();
    query.mockReturnValue([preview, { isFetching: false, error: null }]);
    dashboard.bandPublicId = band; dashboard.localePreferences = { routeLocale: "fr-BE", browserLanguages: ["nl-BE"] };
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<ImportPage />)); }
async function change(label: string, value: string) {
    const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
    input.value = value; await act(async () => Simulate.change(input));
}
async function save() { await act(async () => container.querySelector<HTMLButtonElement>("button")!.click()); }

describe("original import editor workflow", () => {
    it("offers text/config, editable preview, ordered Songs/responses and log without creating an Event", async () => {
        await render();
        expect(container.querySelectorAll("textarea")).toHaveLength(2);
        expect(container.textContent).toContain("Carl Member"); expect(container.textContent).toContain("Smoke");
        expect(container.querySelector(".attendanceList")?.textContent).toContain("Oui");
        expect(container.textContent).toContain("Preview log"); expect(invoke).not.toHaveBeenCalled();
        expect(query.mock.calls[0]![1]).toMatchObject({ bandPublicId: band, routeLocale: "fr-BE", browserLanguages: ["nl-BE"], config: "y2023" });
    });
    it("saves edited name/date and exact public child choices, then adds a contextual history link", async () => {
        invoke.mockResolvedValue(saved); await render();
        await change("Event name", "Edited concert"); await change("Event date", "2026-10-25"); await save();
        expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ bandPublicId: band, routeLocale: "fr-BE", browserLanguages: ["nl-BE"],
            event: { ...preview.event, name: "Edited concert" }, segment: { ...preview.segment, startsAt: new Date("2026-10-25T00:00:00Z") },
            responses: preview.responses, songList: preview.songList,
        }));
        expect(container.querySelector(".history a")?.getAttribute("href")).toContain(`/fr-BE/b/${band}/backstage/event/`);
    });
    it("keeps a failed draft, blocks duplicate pending saves and permits retry", async () => {
        let reject!: (error: Error) => void;
        invoke.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
        await render(); await change("Event name", "Keep this draft"); await save(); await save();
        expect(invoke).toHaveBeenCalledTimes(1); expect(container.querySelector("button")!.disabled).toBe(true);
        await act(async () => reject(new Error("Revoked grant")));
        expect(container.querySelector<HTMLInputElement>('[aria-label="Event name"]')!.value).toBe("Keep this draft");
        expect(container.querySelector(".history a")).toBeNull(); expect(container.querySelector("button")!.disabled).toBe(false);
        invoke.mockResolvedValue(saved); await save(); expect(invoke).toHaveBeenCalledTimes(2);
    });
    it("clears the earlier draft during new input loading and after a failed preview", async () => {
        await render(); await change("Event name", "Old edited preview");
        query.mockReturnValue([undefined, { isFetching: true, error: null }]); await change("Event text", "New input");
        expect(container.querySelector("button")).toBeNull(); expect(container.textContent).not.toContain("Old edited preview");
        query.mockReturnValue([preview, { isFetching: false, error: null }]); await render();
        expect(container.querySelector<HTMLInputElement>('[aria-label="Event name"]')!.value).toBe(preview.event.name);
        query.mockReturnValue([preview, { isFetching: false, error: new Error("Denied") }]); await render();
        expect(container.querySelector("button")).toBeNull(); expect(container.querySelector('[role="alert"]')).not.toBeNull();
    });
    it("drops history/drafts across band or locale preference changes, including equal formatting locales", async () => {
        invoke.mockResolvedValue(saved); await render(); await save(); expect(container.querySelector(".history a")).not.toBeNull();
        await change("Event name", "Old draft"); dashboard.bandPublicId = otherBand; await render();
        expect(container.querySelector(".history a")).toBeNull();
        expect(container.querySelector<HTMLInputElement>('[aria-label="Event name"]')!.value).toBe(preview.event.name);
        await change("Event name", "Different preferences"); dashboard.localePreferences.browserLanguages = ["en-US"]; await render();
        expect(container.querySelector<HTMLInputElement>('[aria-label="Event name"]')!.value).toBe(preview.event.name);
        expect(query.mock.calls.at(-1)![1]).toMatchObject({ bandPublicId: otherBand, routeLocale: "fr-BE", browserLanguages: ["en-US"] });
    });
});
