import { describe, expect, it } from "vitest";
import { projectActivitySavedMetadata } from "src/core/components/featureReports/server/activitySavedMetadata";
import { activityRowsToCsv } from "src/core/components/featureReports/server/activityCsv";
import { activityCsvRecord, activityExportInput, activityExportRow, parseActivityCsv } from "./support/activityExportFixture";

const source: Parameters<typeof projectActivitySavedMetadata>[0] = { uri: null, queryText: null, feature: "link_follow_internal", context: "App/association", songId: 21, eventId: 22, fileId: 23 };
const policy = { applicationOrigin: "https://band.test", hosting: { kind: "multiBand" as const } };
const project = (overrides: Partial<typeof source>, row = activityExportRow()) =>
    projectActivitySavedMetadata({ ...source, ...overrides }, row, activityExportInput, policy);

describe("saved activity metadata disclosure", () => {
    it.each([
        ["/b/ActivityBand0001/song/ActivitySong0001/private-slug?email=private@example.invalid#secret", "/song/ActivitySong0001"],
        ["/b/ActivityBand0001/song/21/private-slug", "/song/ActivitySong0001"],
        ["https://band.test/b/ActivityBand0001/event/22/private-slug?bandPublicId=ForeignBand0001&token=secret", "/event/ActivityEvent001"],
        ["/b/ActivityBand0001/file/23/private-slug", "/file/ActivityFile0001"],
        ["/b/ActivityBand0001/wiki/help/%C3%A9t%C3%A9?secret=private", "/wiki/help/%C3%A9t%C3%A9"],
        ["/b/ActivityBand0001/songs?q=Alice&userId=867&token=secret", "/songs"],
    ])("reconstructs %s from the authorized reference and current presentation", (uri, path) => {
        const value = project({ uri }).uri!;
        const url = new URL(value, "https://band.test");
        expect(url.pathname).toBe(`/fr-BE/b/${activityExportInput.bandPublicId}${path}`);
        expect([...url.searchParams.entries()]).toEqual([]);
        expect(url.hash).toBe("");
        expect(value).not.toMatch(/private|Foreign|Alice|userId|token|867/);
    });

    it.each([
        "/b/ActivityBand0001/user/867/Alice?email=private@example.invalid", "/b/ActivityBand0001/user/PersonPublic001/Alice", "/b/ActivityBand0001/profile",
        "/auth/reset-password?token=secret", "/api/ical/user/secret/upcoming", "/api/files/download/storage-key.pdf",
        "/b/ActivityBand0001/song/PrivateSong0001", "/b/ActivityBand0001/event/21", "/b/ActivityBand0001/wiki/private-page",
        "https://external.test/b/ActivityBand0001/song/21", "https://name:password@band.test/b/ActivityBand0001/song/21",
        "//band.test/b/ActivityBand0001/song/21", "javascript:alert(1)", "data:text/html,private", "/b/ActivityBand0001/song/%XX",
        "/b/ActivityBand0001\\song\\21", "\n/b/ActivityBand0001/song/21", "/unrecognized/private", null,
    ])("withholds identifying, unverified or malformed saved URL %s", uri => {
        expect(project({ uri }).uri).toBeNull();
    });

    it("withholds matching entity routes when the reference is unavailable", () => {
        expect(project({ uri: "/b/ActivityBand0001/song/21" }, activityExportRow({ song: null })).uri).toBeNull();
        expect(project({ uri: "/b/ActivityBand0001/file/23" }, activityExportRow({ file: null })).uri).toBeNull();
    });

    it("requires the caller's trusted origin for absolute URLs while relative routes remain usable", () => {
        const row = activityExportRow();
        expect(projectActivitySavedMetadata({ ...source, uri: "https://band.test/b/ActivityBand0001/song/21" }, row, activityExportInput,
            { applicationOrigin: null, hosting: { kind: "multiBand" } }).uri).toBeNull();
        expect(projectActivitySavedMetadata({ ...source, uri: "/b/ActivityBand0001/song/21" }, row, activityExportInput,
            { applicationOrigin: null, hosting: { kind: "multiBand" } }).uri).toContain("/song/ActivitySong0001");
    });

    it.each(["été", " CHANSON ", "Fête", "help/été"])("retains the confirmed association query fragment %s", queryText => {
        expect(project({ queryText }).queryText).toBe(queryText);
    });

    it.each(["Alice private search", "private@example.invalid", "PersonPublic001", "867", "token=secret", "été\nprivate", ""])
        ("withholds unverified search text %s", queryText => {
            expect(project({ queryText }).queryText).toBeNull();
        });

    it.each(["App/profile/867/Alice", "App/users", "App/login", "App/alice@example.invalid/private"])
        ("withholds text from identifying context %s even with a readable content reference", context => {
            expect(project({ context, queryText: "été" }).queryText).toBeNull();
        });

    it("withholds unknown producers and revoked search references", () => {
        expect(project({ feature: "profile_view", queryText: "été" }).queryText).toBeNull();
        expect(project({ queryText: "été" }, activityExportRow({ song: null, event: null, wikiPage: null })).queryText).toBeNull();
    });
});

describe("activity CSV transport", () => {
    it("keeps stable headers even for an empty export", () => {
        const empty = parseActivityCsv(activityRowsToCsv([]));
        const populated = parseActivityCsv(activityRowsToCsv([activityExportRow()]));
        expect(empty).toEqual([populated[0]]);
        expect(empty[0]!.slice(0, 13)).toEqual(["id", "createdAt", "feature", "isClient", "userHash", "uri", "context", "queryText",
            "language", "locale", "timezone", "screenWidth", "screenHeight"]);
        expect(new Set(empty[0]).size).toBe(empty[0]!.length);
    });

    it("preserves Unicode, UTC timestamps, anonymous authors, zero dimensions, quotes and embedded line breaks", () => {
        const row = activityExportRow({ song: { publicId: activityExportRow().song!.publicId, name: 'Chanson, "été"\r\nDeuxième ligne' } });
        const records = parseActivityCsv(activityRowsToCsv([row]));
        expect(records).toHaveLength(2);
        expect(records[1]).toHaveLength(records[0]!.length);
        const record = activityCsvRecord(records, 0);
        expect(record.get("songName")).toBe(row.song!.name);
        expect(record.get("createdAt")).toBe("2026-01-01T23:15:00.000Z");
        expect(record.get("eventStartsAt")).toBe("2026-01-01T23:30:00.000Z");
        expect(record.get("id")).toBe(row.rowKey);
        expect(record.get("userHash")).toBe("");
        expect(record.get("screenWidth")).toBe("0");
        expect(record.get("fileStoredName")).toBe("");
        expect(record.get("fileExternalURI")).toBe("");
        expect(record.get("menuLinkCaption")).toBe("Navigation française");
        expect(record.get("eventId")).toBe(row.event!.publicId);
    });

    it.each(["=1+1", "+cmd|' /C calc'!A0", "-1+1", "@SUM(1)", " \t=1+1", "\uFEFF=1+1", "\ttext", "\rtext", "\ntext"])
        ("prevents spreadsheet evaluation of %j", value => {
            const row = activityExportRow({ feature: value, song: { publicId: activityExportRow().song!.publicId, name: value } });
            const record = activityCsvRecord(parseActivityCsv(activityRowsToCsv([row])), 0);
            expect(record.get("feature")).toBe(`'${value}`);
            expect(record.get("songName")).toBe(`'${value}`);
        });
});
