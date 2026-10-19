import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission, gPermissionRegistry } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { CreateChangeContext } from "src/auth/server/activityLog";
import { loadLocalizationCatalog } from "src/locale/server/localization";
import { loadStaticStringEditor, writeStaticString } from "src/locale/server/staticStringEditor";
import { StaticStringTargetSchema, StaticStringWriteSchema, selectStaticStringEditLocale,
    type StaticStringTarget, type StaticStringWrite } from "src/locale/shared/staticStringEdit";
import { collectLocalePreferences } from "src/locale/shared/localePreferences";
import updateStaticString from "src/locale/mutations/updateStaticString";
import getStaticStringEditor from "src/locale/queries/getStaticStringEditor";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";
import { createAuthorizationTestContext, createAuthorizationTestUser } from "./authorization/support/authorizationFixtures";
import { invokeResolver } from "./authorization/support/resolverHarness";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("./authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

// The fake implements the Prisma delegates used by the translation owner and authorization.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const bands = [parsePublicId<"Band">("Band000000000001"), parsePublicId<"Band">("Band000000000002")];
const user = { id: 42, publicId: "User000000000042", globalRoleId: null, isDeleted: false, mergedIntoUserId: null, isSysAdmin: false };
const admin = { ...user, id: 43, publicId: "User000000000043", globalRoleId: 30 };
const permissionId = (permission: Permission) => gPermissionRegistry.findIndex(entry => entry.key === permission) + 1;
const target = (overrides: Partial<StaticStringTarget> = {}): StaticStringTarget => ({
    key: "GlobalWikiPage_Markdown", scope: "band", bandPublicId: bands[0]!, localeTag: "fr-BE", ...overrides,
});
const set = (value: string, overrides: Partial<StaticStringTarget> = {}): StaticStringWrite => ({
    target: target(overrides), operation: { kind: "set", value },
});
async function write(command: StaticStringWrite, principal: Parameters<typeof loadAuthorizationForUser>[0] = user, band = bands[0]) {
    const auth = await loadAuthorizationForUser(principal, database, band);
    await authorizationTestDb.transaction(() => writeStaticString(database, auth, command, CreateChangeContext("static-test")));
}

beforeEach(() => authorizationTestDb.reset({
    user: [user, admin],
    band: [1, 2].map(id => ({ id, publicId: bands[id - 1], isDeleted: false })),
    bandUser: [1, 2].map(id => ({ id, publicId: `Member000000000${id}`, userId: 42, bandId: id, bandRoleId: 10 + id, isDeleted: false })),
    bandRole: [{ id: 1, isPublicRole: true, isDeleted: false }, { id: 11, isDeleted: false }, { id: 12, isDeleted: false }],
    globalRole: [{ id: 1, isPublicRole: true, isDeleted: false }, { id: 30, isSysAdminRole: true, isDeleted: false }],
    permission: gPermissionRegistry.map((entry, index) => ({ id: index + 1, name: entry.key, isDeleted: false })),
    bandRolePermission: [{ id: 1, bandRoleId: 11, permissionId: permissionId(Permission.manage_band_localization) }],
    globalRolePermission: [{ id: 1, globalRoleId: 30, permissionId: permissionId(Permission.manage_global_localization) }],
    locale: ["en-US", "fr-BE", "nl-BE"].map((ietfTag, index) => ({ id: index + 1, ietfTag, isDeleted: false })),
    bandLocale: [1, 2].flatMap(bandId => [1, 2, 3].map(localeId => ({ id: bandId * 10 + localeId, bandId, localeId }))),
    staticLocalizedStringValue: [{ id: 1, stringKey: "GlobalWikiPage_Markdown", localeId: 2, indexedValue: null,
        blobValue: "Global **help**", updatedAt: new Date(0) }],
}));

describe("registered static translation ownership", () => {
    it("reads exact overrides without copying inherited display text", async () => {
        const auth = await loadAuthorizationForUser(user, database, bands[0]);
        expect(await loadStaticStringEditor(database, auth, target())).toEqual({ value: null, canSet: true });
        expect((await loadLocalizationCatalog(database, auth, { routeLocale: "fr-BE" })).strings.GlobalWikiPage_Markdown.value).toBe("Global **help**");
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
    });
    it("stores intentional blanks in blob storage and resets only the exact locale", async () => {
        await write(set(""));
        await write(set("Dutch", { localeTag: "nl-BE" }));
        const auth = await loadAuthorizationForUser(user, database, bands[0]);
        expect(await loadStaticStringEditor(database, auth, target())).toEqual({ value: "", canSet: true });
        expect((await loadLocalizationCatalog(database, auth, { routeLocale: "fr-BE" })).strings.GlobalWikiPage_Markdown.value).toBe("");
        await write({ target: target(), operation: { kind: "reset" } });
        expect(await database.bandStaticLocalizedStringValue.findMany()).toMatchObject([{ localeId: 3, indexedValue: null, blobValue: "Dutch" }]);
        expect(await database.staticLocalizedStringValue.count()).toBe(1);
    });
    it("audits inserts/updates/resets with the person and suppresses unchanged writes", async () => {
        await write(set("first"));
        await write(set("first"));
        await write(set("second"));
        await write({ target: target(), operation: { kind: "reset" } });
        await write({ target: target(), operation: { kind: "reset" } });
        const changes = await database.change.findMany();
        expect(changes).toHaveLength(3);
        expect(changes.every(change => change.userId === user.id && change.table === "BandStaticLocalizedStringValue")).toBe(true);
    });
    it("does not transfer first-band grants to a different band", async () => {
        await expect(write(set("wrong", { bandPublicId: bands[1] }), user, bands[1])).rejects.toThrow();
        await expect(write(set("wrong", { bandPublicId: bands[1] }))).rejects.toThrow();
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
    });
    it("keeps platform and band permissions independent", async () => {
        await expect(write(set("global", { scope: "global", bandPublicId: null }))).rejects.toThrow();
        await write(set("Platform", { scope: "global", bandPublicId: null }), admin);
        expect((await database.staticLocalizedStringValue.findMany())[0]?.blobValue).toBe("Platform");
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
    });
    it("rejects unknown keys, missing bands, old numeric identities and malformed locales", () => {
        for (const input of [{ ...target(), key: "WikiPage_arbitrary_Markdown" }, { ...target(), key: "__proto__" },
            { ...target(), bandPublicId: null }, { ...target(), bandId: 1 }, { ...target(), localeTag: "not valid" }]) {
            expect(() => StaticStringTargetSchema.parse(input)).toThrow();
        }
        expect(StaticStringWriteSchema.safeParse({ ...set("text"), operation: { kind: "set", value: false } }).success).toBe(false);
    });
    it("uses registered format/validation and normalizes locale tags", async () => {
        await write(set("Plain", { key: "common.action.ok", localeTag: "FR-be" }));
        expect(await database.bandStaticLocalizedStringValue.findMany()).toMatchObject([{ stringKey: "common.action.ok", localeId: 2, indexedValue: "Plain", blobValue: null }]);
        await expect(write(set("x".repeat(769), { key: "common.action.ok" }))).rejects.toThrow();
        await write(set("x".repeat(2000)));
    });
    it("rejects disabled/deleted locales for sets but can remove their existing overrides", async () => {
        await write(set("French"));
        await database.bandLocale.deleteMany({ where: { bandId: 1, localeId: 2 } });
        const auth = await loadAuthorizationForUser(user, database, bands[0]);
        expect(await loadStaticStringEditor(database, auth, target())).toEqual({ value: "French", canSet: false });
        await expect(write(set("new"))).rejects.toThrow();
        await database.locale.update({ where: { id: 2 }, data: { isDeleted: true } });
        await write({ target: target(), operation: { kind: "reset" } });
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
    });
    it("refreshes read/write authority in RPC transactions after grants are revoked", async () => {
        const ctx = createAuthorizationTestContext(createAuthorizationTestUser("normal", { id: user.id }));
        await invokeResolver(updateStaticString, set("before"), ctx);
        await database.bandRolePermission.deleteMany({ where: { bandRoleId: 11 } });
        await expect(invokeResolver(getStaticStringEditor, target(), ctx)).rejects.toThrow();
        await expect(invokeResolver(updateStaticString, set("after"), ctx)).rejects.toThrow();
        expect((await database.bandStaticLocalizedStringValue.findMany())[0]?.blobValue).toBe("before");
    });
    it("requires a person and explicit band even with stale session grants", async () => {
        const ctx = createAuthorizationTestContext(null);
        await expect(invokeResolver(updateStaticString, set("anon"), ctx)).rejects.toThrow();
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
    });
    it("rolls back the stored translation when auditing fails", async () => {
        const audit = vi.spyOn(authorizationTestDb.getDelegate("change"), "create").mockRejectedValueOnce(new Error("audit failed"));
        await expect(write(set("failed"))).rejects.toThrow("audit failed");
        expect(await database.bandStaticLocalizedStringValue.count()).toBe(0);
        audit.mockRestore();
    });
    it("chooses an enabled edit language independently of text fallback", () => {
        expect(selectStaticStringEditLocale(collectLocalePreferences({ routeLocale: "fr-FR", browserLanguages: ["nl-BE"] }), ["en-US", "fr-BE", "nl-BE"])).toBe("fr-BE");
        expect(selectStaticStringEditLocale(collectLocalePreferences({ routeLocale: "de-DE", browserLanguages: ["nl-BE"] }), ["en-US", "nl-BE"])).toBe("nl-BE");
        expect(selectStaticStringEditLocale(collectLocalePreferences(), [])).toBe("");
    });
});
