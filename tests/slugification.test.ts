import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { slugify } from "shared/rootroot";
import { CmdbRouter, parsePortalPath } from "src/route/portalRouting";

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
    const bandPublicId = parsePublicId<"Band">("RoutingBand00001");
    const router = new CmdbRouter({ baseUri: "https://cmdb.test", hosting: { kind: "multiBand" }, requestPath: parsePortalPath(`/fr-BE/b/${bandPublicId}/backstage`, { kind: "multiBand" }) });
    const eventId = parsePublicId<"Event">("RoutingEvent0001");
    const songId = parsePublicId<"Song">("RoutingSong00001");

    it.each(["info", "setlists", "attendance"])("keeps the event tab %s at its fixed path position", tab => {
        const url = new URL(router.getURIForEvent({ publicId: eventId, name: "River Fanfare Répétition / Repetitie 2" }, tab));
        expect(url.pathname.split("/").slice(6)).toEqual([eventId, "river-fanfare-repetition-repetitie-2", tab]);
        expect(url.pathname).toContain(`/fr-BE/b/${bandPublicId}/`);
        expect(url.searchParams.has("bandPublicId")).toBe(false);
    });

    it("keeps song names in one segment and preserves the requested tab", () => {
        const url = new URL(router.getURIForSong({ publicId: songId, name: "March / Waltz" }, "files"));
        expect(url.pathname.split("/").slice(6)).toEqual([songId, "march-waltz", "files"]);
    });

    it.each([undefined, "Score / Recording"])("preserves File band and locale with slug %s", slug => {
        const fileId = parsePublicId<"File">("RoutingFile00001");
        const url = new URL(router.getURIForFileLandingPage({ publicId: fileId, slug }));
        expect(url.pathname).toBe(`/fr-BE/b/${bandPublicId}/backstage/file/${fileId}${slug ? "/score-recording" : ""}`);
        expect(url.searchParams.has("bandPublicId")).toBe(false);
    });
});
