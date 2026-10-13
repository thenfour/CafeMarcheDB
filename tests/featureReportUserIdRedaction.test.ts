import { describe, expect, it } from "vitest";
import { ActivityReportTimeBucketSize } from "shared/mysqlUtils";
import { parsePublicId } from "shared/publicId";
import { ActivityDetailInputSchema, type ActivityDetailInput } from "src/core/components/featureReports/activityReportTypes";
import { emptyActivityFacetFilters } from "src/core/components/featureReports/ClientFacetHandlers";
import { activityContextBreadcrumbs, anonymousActivityContext } from "src/core/components/featureReports/activityContext";
import { activityDetailSelection, projectActivityDetailRows } from "src/core/components/featureReports/server/activityDetails";
import { activityParticipantToken } from "src/core/components/featureReports/server/activityAnonymization";
import type { ActivityAuthorizedReferences } from "src/core/components/featureReports/server/activityFacetReferences";
import type { ActivityAuthorizedDetailReferences } from "src/core/components/featureReports/server/activityDetailReferences";

const input: ActivityDetailInput = { bandPublicId: parsePublicId<"Band">("ActivityBand0001"),
    startDate: new Date("2026-01-01"), endDateExclusive: new Date("2026-02-01"), selectedBucket: "all",
    filterSpec: { bucketSize: ActivityReportTimeBucketSize.all, excludeYourself: true, excludeSysadmins: true,
        includeFeatures: [], excludeFeatures: [], contextBeginsWith: null }, facetFilters: emptyActivityFacetFilters(), detail: { facet: "total" } };
const references: ActivityAuthorizedReferences = { songs: { identities: [], labels: [], items: [] }, events: { identities: [], labels: [], items: [] },
    wikiPages: { identities: [], labels: [], items: [] }, menuLinks: { identities: [], labels: [], items: [] }, customLinks: { identities: [], labels: [], items: [] } };
const auxiliary: ActivityAuthorizedDetailReferences = { files: new Map(), segments: new Map(), setlists: new Map(), galleryItems: new Map(),
    plans: new Map(), creditTypes: new Map(), attendance: new Map(), instruments: new Map() };
const metadataPolicy = { applicationOrigin: "https://band.test", hosting: { kind: "platform" as const } };
const rawAction = { id: 1, userId: 42, createdAt: new Date("2026-01-02"), feature: "profile_view", context: "App/profile/PersonPublic001/Alice",
    isClient: true, pointerType: "mouse", screenWidth: 1920, screenHeight: 1080, deviceClass: "desktop", browserName: "chrome",
    operatingSystem: "windows", language: "fr", locale: "fr-be", timezone: "Europe/Brussels", songId: 21, eventId: 22,
    wikiPageId: 23, menuLinkId: 24, customLinkId: 25, eventSegmentId: 29, eventSongListId: 30, frontpageGalleryItemId: 31,
    setlistPlanId: 32, songCreditTypeId: 33, bandInstrumentId: 34,
    uri: "https://band.test/backstage/user/867/Alice?email=alice@example.invalid", queryText: "Alice private search",
    user: { name: "Alice", email: "alice@example.invalid", publicId: "PersonPublic001" }, fileId: 26, bandId: 27, attendanceId: 28 };

describe("activity report User identity boundary", () => {
    it("selects only server correlation identities and scalar activity fields, without a person or unchecked reference join", () => {
        expect(activityDetailSelection.select).not.toHaveProperty("user");
        expect(activityDetailSelection.select).toMatchObject({ uri: true, queryText: true });
        for (const field of ["file", "song", "event", "wikiPage", "customLink", "menuLink", "band", "attendance"]) {
            expect(activityDetailSelection.select).not.toHaveProperty(field);
        }
    });

    it("projects an explicit whitelist with scoped tokens and omits every unauthorized identity and saved URL/search", () => {
        const row = projectActivityDetailRows([rawAction], references, auxiliary, input, metadataPolicy)[0]!;
        expect(row.userHash).toBe(activityParticipantToken(rawAction.userId, input));
        expect(row.rowKey).toMatch(/^[a-f0-9]{64}$/);
        expect(row.rowKey).not.toBe(activityParticipantToken(rawAction.id, input));
        expect(row.context).toBe("App/profile/");
        expect(row).toMatchObject({ song: null, event: null, wikiPage: null, menuLink: null, customLink: null, uri: null, queryText: null });
        expect(JSON.stringify(row)).not.toMatch(/Alice|\/user\/867|PersonPublic001|example.invalid|userId|bandId|fileId|attendanceId|songId|eventId|email/);
    });

    it("keeps anonymous authors distinct from anonymized people and uses authorized reference identities", () => {
        const song = { publicId: parsePublicId<"Song">("ActivitySong0001"), name: "Public song" };
        const allowed = { ...references, songs: { identities: [{ id: 21, publicId: song.publicId }], labels: [{ publicId: song.publicId, label: song.name }], items: [song] } };
        expect(projectActivityDetailRows([{ ...rawAction, userId: null }], allowed, auxiliary, input, metadataPolicy)[0]).toMatchObject({ userHash: null, song });
    });

    it("exposes only authorized auxiliary references and never returns their server correlation IDs", () => {
        const file = { publicId: parsePublicId<"File">("ActivityFile0001"), fileLeafName: "Score.pdf" };
        const allowed = { ...auxiliary, files: new Map([[26, file]]) };
        const row = projectActivityDetailRows([rawAction], references, allowed, input, metadataPolicy)[0]!;
        expect(row.file).toEqual(file);
        expect(row).toMatchObject({ eventSegment: null, eventSongList: null, frontpageGalleryItem: null, setlistPlan: null, songCreditType: null, attendance: null, instrument: null });
        expect(JSON.stringify(row)).not.toMatch(/fileId|eventSegmentId|eventSongListId|frontpageGalleryItemId|setlistPlanId|songCreditTypeId|attendanceId|bandInstrumentId/);
    });
});

describe("activity detail request boundary", () => {
    it("requires an explicit detail selection and inherits all date, band and filter choices", () => {
        expect(ActivityDetailInputSchema.parse(input)).toEqual(input);
        expect(ActivityDetailInputSchema.safeParse({ ...input, detail: undefined }).success).toBe(false);
    });
    it.each([{ detail: { facet: "users", key: "42" } }, { detail: { facet: "screenSizes", key: "1920x1080" } },
        { detail: { facet: "songs", key: 21 } }, { detail: { facet: "events", key: "22" } }, { detail: { facet: "total", key: "extra" } },
        { userId: 42 }, { bandId: 1 }, { timeZone: "UTC" }, { limit: 1000 }, { startDate: input.endDateExclusive },
        { filterSpec: { ...input.filterSpec, contextBeginsWith: "App/profile/PersonPublic001" } },
        { detail: { facet: "contexts", key: "App/profile/867/Alice" } },
    ])("rejects forged scope, unsupported selections and identifying filters: %j", override => {
        expect(ActivityDetailInputSchema.safeParse({ ...input, ...override }).success).toBe(false);
    });
});

describe("anonymous historical context projection", () => {
    it.each([
        ["App/profile/PersonPublic001/Alice", "App/profile/"], ["App/profile/867/Alice", "App/profile/"],
        ["App/backstage/user/867/Alice?tab=activity", "App/backstage/user/"], ["App/song/ActivitySong0001", "App/song/"],
        ["App/profile/", "App/profile/"], ["App/a%_\\/child", "App/a%_\\/child"], ["App/alice@example.invalid/private", "App/"],
        ["867", null], [null, null],
    ])("removes identity-bearing suffixes from %s", (value, expected) => {
        expect(anonymousActivityContext(value)).toBe(expected);
    });
});

describe("literal activity context breadcrumbs", () => {
    it.each([
        ["App/branch/leaf", ["App/", "App/branch/", "App/branch/leaf"]],
        ["/App/branch/", ["/App/", "/App/branch/"]],
        ["//App///branch//", ["//App///", "//App///branch//"]],
        ["App/a%_\\/leaf", ["App/", "App/a%_\\/", "App/a%_\\/leaf"]],
        ["/", ["/"]], ["", []],
    ])("preserves exact roots and separators for %s", (value, prefixes) => {
        const parts = activityContextBreadcrumbs(value);
        expect(parts.map(part => part.prefix)).toEqual(prefixes);
        expect(parts.map(part => `${part.leadingSeparators}${part.label}${part.trailingSeparators}`).join("")).toBe(value);
        expect(parts.every(part => anonymousActivityContext(part.prefix) === part.prefix)).toBe(true);
    });
});
