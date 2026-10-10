import { describe, expect, it } from "vitest";
import { parsePublicId } from "shared/publicId";
import { ZGetImportEventDataArgs } from "src/core/db3/shared/apiTypes";
import { extractImportDate, matchImportResponses, matchImportSongs, parseEventImportText } from "src/core/db3/shared/entities/event/eventImportParsing";

const bandPublicId = parsePublicId<"Band">("ImportBand000001");
const songId = parsePublicId<"Song">("ImportSong000001");
const otherSongId = parsePublicId<"Song">("ImportSong000002");
const userId = parsePublicId<"User">("ImportPerson0001");
const yes = parsePublicId<"EventAttendance">("ImportAnswer0001");
const no = parsePublicId<"EventAttendance">("ImportAnswer0002");

describe("original event import format", () => {
    it.each(["25 October 2024", "October 25, 2024", "October 25 2024", "25/10/2024", "25-10-2024"])(
        "parses explicit dates in %s", text => expect(extractImportDate(text, 2023)).toBe("2024-10-25"));
    it.each(["27 Sept", "Sept 27", "27 September", "September 27", "27/9", "27-09"])(
        "uses the config year for %s", text => expect(extractImportDate(text, 2026)).toBe("2026-09-27"));
    it.each(["31 February", "32/10", "25/13/2024", "No date"])(
        "does not roll over an invalid/unrecognized date in %s", text => expect(extractImportDate(text, 2023)).toBeNull());
    it("preserves first-line naming, rehearsal precedence, fallback config and the notes separator", () => {
        expect(parseEventImportText("\r\n  Concert rehearsal 27 Sept\r\nSong (solo)\r\n-----\r\nIgnored song", "y2026"))
            .toMatchObject({ name: "Concert rehearsal 27 Sept", type: "Rehearsal", date: "2026-09-27", fallbackYear: 2026,
                songs: [{ name: "Concert rehearsal 27 Sept", comment: "" }, { name: "Song", comment: "solo" }] });
        expect(parseEventImportText("Performance", "")).toMatchObject({ type: "Concert", fallbackYear: 2023, date: null });
        expect(parseEventImportText("Meeting", "").type).toBeNull();
    });
    it("honors explicit leap years instead of reinterpreting invalid full dates with the config year", () => {
        expect(extractImportDate("29 February 2024", 2023)).toBe("2024-02-29");
        expect(extractImportDate("29 February 2023", 2024)).toBeNull();
        expect(extractImportDate("29/02/2023", 2024)).toBeNull();
    });
    it("matches visible names/aliases by the reference token threshold, retaining order, repeats and comments", () => {
        const songs = [{ publicId: songId, name: "Smoke and Mirrors", aliases: "Old smoke" }, { publicId: otherSongId, name: "Paper Spaceships", aliases: "" }];
        const parsed = parseEventImportText("Smoke mirrors (solo)\nPaper spaceships(feat. Pieter)\nOld smoke\nSmoke mirrors\nUnknown tune\nx", "");
        expect(matchImportSongs(parsed.songs, songs, [])).toEqual([
            { songId, songName: songs[0]!.name, comment: "solo" }, { songId: otherSongId, songName: songs[1]!.name, comment: "feat. Pieter" },
            { songId, songName: songs[0]!.name, comment: "" }, { songId, songName: songs[0]!.name, comment: "" },
        ]);
    });
    it("reports equally ranked Songs instead of choosing an arbitrary identity", () => {
        const log: string[] = [];
        expect(matchImportSongs([{ name: "Smoke", comment: "" }], [
            { publicId: songId, name: "Smoke and Mirrors" }, { publicId: otherSongId, name: "Smoke Signals" },
        ], log)).toEqual([]);
        expect(log).toContain("  Ambiguous Song match; omitted.");
    });
    it("retains public attendance identities for the original aliases and ignores missing/inactive choices", () => {
        const people = [{ publicId: userId, name: "Carl Member" }, { publicId: parsePublicId<"User">("ImportPerson0002"), name: "Peter Member" }];
        expect(matchImportResponses("Gig\ncarl", people, { yes, no }, [])).toEqual([
            { userId, userName: "Carl Member", attendanceId: yes }, { userId: people[1]!.publicId, userName: "Peter Member", attendanceId: no },
        ]);
        expect(matchImportResponses("Gig\ncarl", people, { yes: null, no }, []).map(response => response.attendanceId)).toEqual([no]);
    });
    it("omits ambiguous people and avoids duplicate responses for a person matching two aliases", () => {
        const log: string[] = [];
        expect(matchImportResponses("carl", [{ publicId: userId, name: "Carl" },
            { publicId: parsePublicId<"User">("ImportPerson0002"), name: "Carl Other" }], { yes, no }, log)).toEqual([]);
        expect(log).toContain("carl: ambiguous member match; omitted.");
        expect(matchImportResponses("carl peter", [{ publicId: userId, name: "Carl Peter" }], { yes, no }, [])).toHaveLength(1);
    });
});

describe("strict import preview input", () => {
    const input = { bandPublicId, text: "Gig", config: "y2026" };
    it("requires explicit band/public inputs and bounded text/config with ordinary locale preferences", () => {
        expect(ZGetImportEventDataArgs.parse({ ...input, routeLocale: "fr-BE", browserLanguages: ["nl-BE"] })).toMatchObject(input);
        for (const value of [{ text: "Gig", config: "" }, { ...input, bandPublicId: 1 }, { ...input, bandId: 1 },
            { ...input, config: {} }, { ...input, text: "x".repeat(200_001) }, { ...input, config: "x".repeat(10_001) }]) {
            expect(ZGetImportEventDataArgs.safeParse(value).success).toBe(false);
        }
    });
});
