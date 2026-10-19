import { resetAuthorizationDatabase } from "./authorization/support/authorizationSeed";
import { createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { ActivityFeature, ClientActionRequestSchema } from "src/core/components/featureReports/activityTracking";
import { createActionRecord, recordAuthenticatedClientAction } from "src/core/db3/server/recordActionServer";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";

const publicId = (id: number) => `Telemetry${String(id).padStart(7, "0")}`;
const bandId = parsePublicId<"Band">(publicId(1));
const actor = createAuthorizationTestUser("normal", { id: 7, publicId: parsePublicId<"User">(publicId(7)), name: "Member", email: "member@test.invalid" });
const associations = [
    { field: "songId", table: "song", owner: "song", id: 101 },
    { field: "customLinkId", table: "customLink", owner: "customLink", id: 102 },
    { field: "menuLinkId", table: "menuLink", owner: "menuLink", id: 103 },
    { field: "wikiPageId", table: "wikiPage", owner: "wikiPage", id: 104 },
    { field: "fileId", table: "file", owner: "file", id: 105 },
    { field: "frontpageGalleryItemId", table: "frontpageGalleryItem", owner: "file", id: 106 },
    { field: "eventId", table: "event", owner: "event", id: 107 },
    { field: "bandInstrumentId", table: "bandInstrument", owner: "bandInstrument", id: 108 },
    { field: "eventSegmentId", table: "eventSegment", owner: "event", id: 109 },
    { field: "eventSongListId", table: "eventSongList", owner: "event", id: 110 },
    { field: "setlistPlanId", table: "setlistPlan", owner: "setlistPlan", id: 111 },
] as const;

// Raw transport fixtures include malformed keys and values; Zod is the boundary under test.
const request = (event: Record<string, unknown> = {}, presentation: Record<string, unknown> = {}) => ClientActionRequestSchema.parse({
    event: { feature: ActivityFeature.profile_view, ...event },
    presentation: { bandPublicId: bandId, routeLocale: "fr-BE", browserLanguages: ["nl-BE"], ...presentation },
});
const authorize = () => loadAuthorizationForUser(actor, undefined, bandId);

beforeEach(() => {
    vi.restoreAllMocks();
    resetAuthorizationDatabase({
        user: [actor], action: [],
        band: [1, 2].map(id => ({ id, publicId: publicId(id), isDeleted: false })),
        locale: [{ id: 1, ietfTag: "en-US", isDeleted: false }, { id: 2, ietfTag: "fr-BE", isDeleted: false },
            { id: 3, ietfTag: "nl-BE", isDeleted: false }],
        song: [{ id: 101, publicId: publicId(101), bandId: 1 }],
        customLink: [{ id: 102, publicId: publicId(102), bandId: 1 }],
        menuLink: [{ id: 103, publicId: publicId(103), bandId: 1 }],
        wikiPage: [{ id: 104, publicId: publicId(104), bandId: 1 }],
        file: [{ id: 105, publicId: publicId(105), bandId: 1 }],
        frontpageGalleryItem: [{ id: 106, publicId: publicId(106), fileId: 105 }],
        event: [{ id: 107, publicId: publicId(107), bandId: 1 }],
        bandInstrument: [{ id: 108, publicId: publicId(108), bandId: 1 }],
        eventSegment: [{ id: 109, publicId: publicId(109), eventId: 107 }],
        eventSongList: [{ id: 110, publicId: publicId(110), eventId: 107 }],
        setlistPlan: [{ id: 111, publicId: publicId(111), bandId: 1 }],
        songCreditType: [{ id: 112, publicId: publicId(112) }],
        eventAttendance: [{ id: 113, publicId: publicId(113) }],
    });
});

describe("telemetry resource ownership", () => {
    it.each(associations)("resolves $field within the selected band", async ({ field, id }) => {
        await recordAuthenticatedClientAction(request({ [field]: publicId(id) }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ [field]: id, bandId: 1, userId: actor.id });
    });

    it.each(associations)("omits $field from another band", async ({ field, id, owner }) => {
        await authorizationTestDb.getDelegate(owner).updateMany({ data: { bandId: 2 } });
        await recordAuthenticatedClientAction(request({ [field]: publicId(id) }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ [field]: null, bandId: 1 });
    });

    it("does not infer a band or look up band resources in platform context", async () => {
        const lookups = associations.map(({ table }) => vi.spyOn(authorizationTestDb.getDelegate(table), "findFirst"));
        const event = Object.fromEntries(associations.map(({ field, id }) => [field, publicId(id)]));
        await recordAuthenticatedClientAction(request(event, { bandPublicId: null }), await loadAuthorizationForUser(actor));
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ bandId: null, userId: actor.id,
            ...Object.fromEntries(associations.map(({ field }) => [field, null])) });
        lookups.forEach(lookup => expect(lookup).not.toHaveBeenCalled());
    });

    it("keeps global credit-type and attendance associations in platform context", async () => {
        await recordAuthenticatedClientAction(request({ songCreditTypeId: publicId(112), attendanceId: publicId(113) }, { bandPublicId: null }),
            await loadAuthorizationForUser(actor));
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ songCreditTypeId: 112, attendanceId: 113, bandId: null });
    });

    it("omits unknown references without dropping the action", async () => {
        await recordAuthenticatedClientAction(request({ songId: publicId(999), attendanceId: publicId(998) }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ songId: null, attendanceId: null, bandId: 1 });
    });

    it("records anonymous band context without requiring or inventing a membership", async () => {
        await recordAuthenticatedClientAction(request(), await loadAuthorizationForUser(null, undefined, bandId));
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ bandId: 1, userId: null, isClient: true });
    });

    it("rejects a mismatched authorization context before persisting", async () => {
        await expect(recordAuthenticatedClientAction(request(), await loadAuthorizationForUser(actor))).rejects.toThrow(/context/);
        expect(authorizationTestDb.snapshot("action")).toEqual([]);
    });

    it("refreshes account state rather than trusting an earlier actor snapshot", async () => {
        const auth = await authorize();
        await authorizationTestDb.getDelegate("user").update({ where: { id: actor.id }, data: { isDeleted: true } });
        await recordAuthenticatedClientAction(request(), auth);
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ userId: null, bandId: 1 });
    });

    it("rejects a band deleted after authorization was loaded", async () => {
        const auth = await authorize();
        await authorizationTestDb.getDelegate("band").update({ where: { id: 1 }, data: { isDeleted: true } });
        await expect(recordAuthenticatedClientAction(request(), auth)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("action")).toEqual([]);
    });
});

describe("telemetry locale and sanitization", () => {
    it("keeps presentation locale separate from raw device language and locale", async () => {
        await recordAuthenticatedClientAction(request({ deviceInfo: { language: "DE", locale: "DE-DE" } }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ localeContextId: 2, language: "de", locale: "de-de" });
    });

    it("uses browser preference order when no route locale is supplied", async () => {
        await recordAuthenticatedClientAction(request({}, { routeLocale: null }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]?.localeContextId).toBe(3);
    });

    it("retains unknown or deleted presentation locales as null", async () => {
        await recordAuthenticatedClientAction(request({}, { routeLocale: "de-DE" }), await authorize());
        await authorizationTestDb.getDelegate("locale").update({ where: { id: 2 }, data: { isDeleted: true } });
        await recordAuthenticatedClientAction(request(), await authorize());
        expect(authorizationTestDb.snapshot("action").map(row => row.localeContextId)).toEqual([null, null]);
    });

    it("retains redaction, text limits, normalization and integer bounds", async () => {
        await recordAuthenticatedClientAction(request({ uri: "/api/ical/user/secret-token/upcoming", context: "c".repeat(300), queryText: "q".repeat(100),
            deviceInfo: { browser: "B".repeat(30), screenHeight: -1, screenWidth: 2147483648, timezone: "Europe/Brussels" } }), await authorize());
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ uri: "/api/ical/user/[calendarFeedToken]/upcoming",
            context: "c".repeat(256), queryText: "q".repeat(64), browserName: "b".repeat(16), screenHeight: null, screenWidth: null, timezone: "europe/brussels" });
    });

    it("records server account actions with explicit unknown context", async () => {
        await createActionRecord({ feature: ActivityFeature.login_google, userId: actor.id, isClient: false }, { bandId: null, localeContextId: null });
        expect(authorizationTestDb.snapshot("action")[0]).toMatchObject({ bandId: null, localeContextId: null, userId: actor.id, isClient: false });
        expect(authorizationTestDb.snapshot("action")[0]).not.toHaveProperty("instrumentId");
    });
});

describe("telemetry transport validation", () => {
    it.each([...associations, { field: "songCreditTypeId", id: 112 }, { field: "attendanceId", id: 113 }])("rejects a natural $field", ({ field, id }) => {
        expect(() => request({ [field]: id })).toThrow();
    });

    it.each(["userId", "bandId", "localeContextId", "isClient", "instrumentId"])("rejects client-owned %s", field => {
        expect(() => request({ [field]: 7 })).toThrow();
    });

    it("requires an explicit presentation envelope and validates locale hints", () => {
        expect(() => ClientActionRequestSchema.parse({ event: { feature: ActivityFeature.profile_view } })).toThrow();
        expect(() => request({}, { bandPublicId: 1 })).toThrow();
        expect(() => request({}, { routeLocale: "not a locale" })).toThrow();
        expect(() => request({}, { browserLanguages: Array(33).fill("en-US") })).toThrow();
        expect(() => request({}, { browserLanguages: ["invalid hint", "en-US"] })).not.toThrow();
    });
});
