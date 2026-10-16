import { parsePortalPath, PORTAL_PATH_QUERY_PARAM } from "src/route/portalRouting";
import { AuthenticationError, AuthorizationError, NotFoundError } from "blitz";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarFeedNotFoundError } from "src/auth/server/calendarFeedSubscription";
import { calendarBandPublicId } from "./support/calendarFeedFixtures";

vi.mock("src/blitz-server", () => ({ api: (handler: unknown) => handler }));
vi.mock("db", async () => ({ ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"), default: {} }));
vi.mock("src/core/db3/server/ical", async () => ({
    ...await vi.importActual<typeof import("src/core/db3/server/ical")>("src/core/db3/server/ical"),
    exportCalendarFeedForToken: vi.fn(),
}));
vi.mock("src/core/db3/server/recordActionServer", () => ({ createActionRecord: vi.fn() }));

import { createCalendar, exportCalendarFeedForToken } from "src/core/db3/server/ical";
import { createActionRecord } from "src/core/db3/server/recordActionServer";
import upcoming from "src/pages/api/ical/user/[calendarFeedToken]/upcoming";

function response() {
    const end = vi.fn();
    const send = vi.fn();
    return { end, send, status: vi.fn(() => ({ end, send })), setHeader: vi.fn() };
}
// Blitz is replaced above; this boundary uses only these HTTP members.
const handler = upcoming as unknown as (req: { method: string; query: object }, res: ReturnType<typeof response>) => Promise<void>;
const token = "a".repeat(64);
const path = parsePortalPath(`/b/${calendarBandPublicId}/api/ical/user/${token}/upcoming`, { kind: "multiBand" });
const query = { calendarFeedToken: token, [PORTAL_PATH_QUERY_PARAM]: JSON.stringify(path) };

describe("band-scoped private calendar HTTP boundary", () => {
    beforeEach(() => { vi.resetAllMocks(); });

    it("serves the scoped snapshot without caching or exposing the bearer credential to telemetry", async () => {
        const calendar = await createCalendar({ icalSettings: { calendarName: "Agenda", calendarCompany: "", calendarProduct: "", eventNamePrefix: "" } });
        const actionContext = { bandId: 123, localeContextId: 456 };
        vi.mocked(exportCalendarFeedForToken).mockResolvedValue({ calendar, userId: 789, actionContext });
        const res = response();
        await handler({ method: "GET", query }, res);
        expect(exportCalendarFeedForToken).toHaveBeenCalledWith(token, { type: "upcoming", bandPublicId: calendarBandPublicId });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(calendar.toString());
        expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/calendar; charset=utf-8");
        expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
        expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
        expect(createActionRecord).toHaveBeenCalledWith(expect.objectContaining({ uri: "/api/ical/user/[calendarFeedToken]/upcoming", userId: 789 }), actionContext);
        expect(JSON.stringify(vi.mocked(createActionRecord).mock.calls)).not.toContain(token);
        expect(calendar.toString()).toContain("PRODID:-//CMDB//Calendar//EN");
    });

    it.each([
        { calendarFeedToken: token },
        { ...query, [PORTAL_PATH_QUERY_PARAM]: ["ambiguous"] },
        { ...query, [PORTAL_PATH_QUERY_PARAM]: JSON.stringify({ ...path, bandPublicId: "123" }) },
        { ...query, calendarFeedToken: [token] },
        { ...query, calendarFeedToken: "public" },
        { ...query, calendarFeedToken: "bad" },
    ])("rejects malformed or unscoped requests before reading credentials: %j", async invalid => {
        const res = response();
        await handler({ method: "GET", query: invalid }, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store, max-age=0");
        expect(exportCalendarFeedForToken).not.toHaveBeenCalled();
        expect(createActionRecord).not.toHaveBeenCalled();
    });

    it.each([new CalendarFeedNotFoundError(), new NotFoundError(), new AuthenticationError(), new AuthorizationError()])("does not distinguish unknown credentials from unavailable access", async error => {
        vi.mocked(exportCalendarFeedForToken).mockRejectedValue(error);
        const res = response();
        await handler({ method: "GET", query }, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).not.toHaveBeenCalled();
        expect(createActionRecord).not.toHaveBeenCalled();
    });

    it("does not log request credentials or database arguments after unexpected failures", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(exportCalendarFeedForToken).mockRejectedValue(new Error(`Query contained ${token}`));
        const res = response();
        await handler({ method: "GET", query }, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(log).toHaveBeenCalledWith("Calendar feed request failed.");
        log.mockRestore();
    });

    it("rejects unsupported methods before any credential lookup", async () => {
        const res = response();
        await handler({ method: "POST", query }, res);
        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
        expect(exportCalendarFeedForToken).not.toHaveBeenCalled();
    });
});
