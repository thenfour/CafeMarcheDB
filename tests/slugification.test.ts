import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { slugify } from "shared/rootroot";
import { DashboardContextDataBase } from "src/core/components/dashboardContext/dashboardContextTypes";

// Routing does not use the dashboard's rendering policies.
class RoutingDashboard extends DashboardContextDataBase {
    partitionEventSegmentsByCancellation(): never {
        throw new Error("This fixture only supports routing.");
    }
    sortInstruments(): never {
        throw new Error("This fixture only supports routing.");
    }
    isAttendanceIdGoing(): never {
        throw new Error("This fixture only supports routing.");
    }
    getVisibilityPermissions(): never {
        throw new Error("This fixture only supports routing.");
    }
}

describe("single-segment slugification", () => {
    it.each([
        ["River Fanfare Répétition / Repetitie 2", "river-fanfare-repetition-repetitie-2"],
        ["Brass/Wind", "brass-wind"],
        ["Brass // _- Wind", "brass-wind"],
        ["  Déjà vu / Été!  ", "deja-vu-ete"],
        ["plain-slug", "plain-slug"],
        ["", ""],
    ])("slugifies %j into one segment", (input, expected) => {
        const result = slugify(input);
        expect(result).toBe(expected);
        expect(result).not.toContain("/");
        expect(slugify(result)).toBe(result);
    });

    it("combines text and numbers without allowing arguments to introduce path boundaries", () => {
        expect(slugify("Concert / Rehearsal", 2)).toBe("concert-rehearsal-2");
    });
});

describe("entity routing with slash-containing names", () => {
    const dashboard = new RoutingDashboard();
    dashboard.serverBaseUri = "https://cmdb.test";
    dashboard.memberPresentation = { bandPublicId: parsePublicId<"Band">("RoutingBand00001"), routeLocale: "fr-BE" };
    const eventId = parsePublicId<"Event">("RoutingEvent0001");
    const songId = parsePublicId<"Song">("RoutingSong00001");

    it.each(["info", "setlists", "attendance"])("keeps the event tab %s at its fixed path position", tab => {
        const url = new URL(dashboard.routingApi.getURIForEvent({ publicId: eventId, name: "River Fanfare Répétition / Repetitie 2" }, tab));
        expect(url.pathname.split("/").slice(3)).toEqual([eventId, "river-fanfare-repetition-repetitie-2", tab]);
        expect(url.searchParams.get("bandPublicId")).toBe(dashboard.memberPresentation.bandPublicId);
        expect(url.searchParams.get("routeLocale")).toBe("fr-BE");
    });

    it("keeps song names in one segment and preserves the requested tab", () => {
        const url = new URL(dashboard.routingApi.getURIForSong({ publicId: songId, name: "March / Waltz" }, "files"));
        expect(url.pathname.split("/").slice(3)).toEqual([songId, "march-waltz", "files"]);
    });

    it.each([undefined, "Score / Recording"])("preserves File band and locale with slug %s", slug => {
        const fileId = parsePublicId<"File">("RoutingFile00001");
        const url = new URL(dashboard.routingApi.getURIForFileLandingPage({ publicId: fileId, slug }));
        expect(url.pathname).toBe(`/backstage/file/${fileId}${slug ? "/score-recording" : ""}`);
        expect(url.searchParams.get("bandPublicId")).toBe(dashboard.memberPresentation.bandPublicId);
        expect(url.searchParams.get("routeLocale")).toBe("fr-BE");
    });
});
