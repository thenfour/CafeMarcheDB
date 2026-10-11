import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePublicId } from "shared/publicId";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import getPresentationData from "src/locale/queries/getPresentationData";
import updateSetting from "src/setting/server/mutations/updateSetting";
import updateBulkSettings from "src/setting/server/mutations/updateBulkSettings";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { readSettingSnapshot, type SettingsKey } from "src/setting/shared/settingsContract";
import { clearBrandCache } from "src/server/brand";
import { authorizationTestDb } from "tests/authorization/support/inMemoryPrisma";
import { invokeResolver } from "tests/authorization/support/resolverHarness";
import {
    firstSettingsBand, secondSettingsBand, otherSettingsUserId, resetSettingsAuthorizationFixture,
    settingsOwnerId, settingsTestContext, settingsTestDatabase, settingsTransactionFixture,
} from "tests/support/settingsAuthorizationFixture";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("../../../tests/authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});
vi.mock("src/server/brand", () => ({ clearBrandCache: vi.fn() }));

beforeEach(() => {
    resetSettingsAuthorizationFixture();
    vi.mocked(clearBrandCache).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

const setPreference = (key: SettingsKey<"user">, value: boolean) => ({
    hive: "user" as const, key, operation: { kind: "set" as const, value },
});
const firstPreference = "calendar.showDeclinedEvents";

describe("own registered user settings", () => {
    it("delivers defaults only to the active owner, without creating rows", async () => {
        const owner = await loadAuthorizationForUser({ id: settingsOwnerId }, settingsTestDatabase);
        const other = await loadAuthorizationForUser({ id: otherSettingsUserId }, settingsTestDatabase);
        const anonymous = await loadAuthorizationForUser(null, settingsTestDatabase);
        expect((await loadSettingsSnapshot(settingsTestDatabase, anonymous)).user).toEqual({});
        expect(readSettingSnapshot(await loadSettingsSnapshot(settingsTestDatabase, owner), "user", firstPreference)).toBe(true);
        expect(readSettingSnapshot(await loadSettingsSnapshot(settingsTestDatabase, other), "user", firstPreference)).toBe(false);
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it.each([null, firstSettingsBand, secondSettingsBand])("derives the preference owner from the session in context %s", async bandPublicId => {
        const ctx = settingsTestContext();
        await invokeResolver(updateSetting, setPreference(firstPreference, false), ctx);
        const data = await invokeResolver(getPresentationData, { bandPublicId, clientRequestId: String(otherSettingsUserId) }, ctx);
        expect(data.authorization.userPublicId).toBe(parsePublicId<"User">("User000000000042"));
        expect(data.settings.user[firstPreference]?.value).toBe(false);
        expect(data.input.clientRequestId).toBe(String(otherSettingsUserId));
        expect(authorizationTestDb.snapshot("userSetting").filter(row => row.userId === otherSettingsUserId))
            .toEqual([{ id: 1, userId: otherSettingsUserId, name: firstPreference, value: false }]);
    });

    it("inserts, updates, skips unchanged values and audits reset without duplicating rows", async () => {
        const ctx = settingsTestContext();
        await invokeResolver(updateSetting, setPreference(firstPreference, false), ctx);
        await invokeResolver(updateSetting, setPreference(firstPreference, true), ctx);
        await invokeResolver(updateSetting, setPreference(firstPreference, true), ctx);
        expect(authorizationTestDb.snapshot("userSetting").filter(row => row.userId === settingsOwnerId)).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change").map(row => row.action)).toEqual(["insert", "update"]);
        await invokeResolver(updateSetting, { hive: "user", key: firstPreference, operation: { kind: "reset" } }, ctx);
        await invokeResolver(updateSetting, { hive: "user", key: firstPreference, operation: { kind: "reset" } }, ctx);
        expect(authorizationTestDb.snapshot("change").map(row => row.action)).toEqual(["insert", "update", "delete"]);
        expect(authorizationTestDb.snapshot("change").every(row => row.table === "UserSetting" && row.userId === settingsOwnerId)).toBe(true);
        expect((await invokeResolver(getPresentationData, {}, ctx)).settings.user[firstPreference]).toMatchObject({ value: true, source: "default" });
    });

    it("saves both calendar preferences independently and preserves unsubmitted or retired rows", async () => {
        await authorizationTestDb.getDelegate("userSetting").create({ data: { userId: settingsOwnerId, name: "future.preference", value: "kept" } });
        const ctx = settingsTestContext();
        await invokeResolver(updateBulkSettings, { commands: [
            setPreference(firstPreference, false), setPreference("calendar.showUninvitedEvents", false),
        ] }, ctx);
        await invokeResolver(updateSetting, setPreference(firstPreference, true), ctx);
        const data = await invokeResolver(getPresentationData, {}, ctx);
        expect(data.settings.user[firstPreference]?.value).toBe(true);
        expect(data.settings.user["calendar.showUninvitedEvents"]?.value).toBe(false);
        expect(data.settings.user["future.preference"]).toBeUndefined();
        expect(authorizationTestDb.snapshot("userSetting")).toContainEqual(expect.objectContaining({
            userId: settingsOwnerId, name: "future.preference", value: "kept",
        }));
    });

    it("fails invalid stored types visibly and repairs them through an explicit reset", async () => {
        // Typed hives deliberately reject corrupt values rather than silently selecting a default.
        await authorizationTestDb.getDelegate("userSetting").create({ data: { userId: settingsOwnerId, name: firstPreference, value: "false" } });
        const auth = await loadAuthorizationForUser({ id: settingsOwnerId }, settingsTestDatabase);
        await expect(loadSettingsSnapshot(settingsTestDatabase, auth)).rejects.toThrow();
        await invokeResolver(updateSetting, { hive: "user", key: firstPreference, operation: { kind: "reset" } }, settingsTestContext());
        expect(readSettingSnapshot(await loadSettingsSnapshot(settingsTestDatabase, auth), "user", firstPreference)).toBe(true);
    });

    it.each(["anonymous", "deleted", "missing", "merged"] as const)("rejects writes for the %s principal", async kind => {
        const ctx = settingsTestContext(kind === "anonymous" ? null : settingsOwnerId);
        if (kind === "deleted") {
            await authorizationTestDb.getDelegate("user").update({ where: { id: settingsOwnerId }, data: { isDeleted: true } });
        } else if (kind === "missing") {
            await authorizationTestDb.getDelegate("user").delete({ where: { id: settingsOwnerId } });
        } else if (kind === "merged") {
            await authorizationTestDb.getDelegate("user").update({ where: { id: settingsOwnerId }, data: { mergedIntoUserId: otherSettingsUserId } });
        }
        await expect(invokeResolver(updateSetting, setPreference(firstPreference, false), ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        expect(clearBrandCache).not.toHaveBeenCalled();
    });

    it("refreshes account status inside the transaction after a cached successful request", async () => {
        const ctx = settingsTestContext();
        await invokeResolver(getPresentationData, {}, ctx);
        const transact = settingsTransactionFixture.transaction.bind(settingsTransactionFixture);
        vi.spyOn(settingsTransactionFixture, "transaction").mockImplementationOnce(async work => {
            await authorizationTestDb.getDelegate("user").update({ where: { id: settingsOwnerId }, data: { isDeleted: true } });
            return transact(work);
        });
        await expect(invokeResolver(updateSetting, setPreference(firstPreference, false), ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        expect(clearBrandCache).not.toHaveBeenCalled();
    });

    it("rejects forged ownership, unknown keys and invalid batches before any writes", async () => {
        const ctx = settingsTestContext();
        for (const command of [
            { ...setPreference(firstPreference, false), userId: otherSettingsUserId },
            { ...setPreference(firstPreference, false), key: "unknown.setting" },
            { ...setPreference(firstPreference, false), operation: { kind: "set" as const, value: "false" } },
        ]) {
            await expect(invokeResolver(updateSetting, command, ctx)).rejects.toThrow();
        }
        await expect(invokeResolver(updateBulkSettings, { commands: [setPreference(firstPreference, false), {
            hive: "user", key: "calendar.showUninvitedEvents", operation: { kind: "set", value: "false" },
        }] }, ctx)).rejects.toThrow();
        const forgedPresentationInput = { userId: otherSettingsUserId };
        // The resolver must reject this intentionally malformed transport payload at runtime.
        await expect(invokeResolver(getPresentationData, forgedPresentationInput as never, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
    });

    it("rolls back preferences and audits without invalidating caches when the audit fails", async () => {
        const failure = new Error("Preference audit failed");
        vi.spyOn(authorizationTestDb.getDelegate("change"), "create").mockRejectedValueOnce(failure);
        await expect(invokeResolver(updateSetting, setPreference(firstPreference, false), settingsTestContext())).rejects.toBe(failure);
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toEqual([]);
        expect(clearBrandCache).not.toHaveBeenCalled();
    });
});
