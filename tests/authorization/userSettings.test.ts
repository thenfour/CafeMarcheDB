import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", async () => {
    const { authorizationTestDb } = await import("./support/inMemoryPrisma");
    return {
        ...await vi.importActual<typeof import("@prisma/client")>("@prisma/client"),
        default: new Proxy(authorizationTestDb, {
            // Dashboard relevance is unrelated to settings ownership.
            get: (database, key) => key === "$queryRaw" ? async () => [] : Reflect.get(database, key),
        }),
    };
});

import updateMyUserSettings from "src/auth/mutations/updateMyUserSettings";
import getDashboardData from "src/auth/queries/getDashboardData";
import { loadUserSettings } from "src/auth/server/userSettings";
import { createAuthorizationPersona, createAuthorizationTestUser } from "./support/authorizationFixtures";
import { authorizationTestDb } from "./support/inMemoryPrisma";
import { invokeResolver } from "./support/resolverHarness";

const owner = createAuthorizationTestUser("normal", { id: 10 });
const other = createAuthorizationTestUser("normal", { id: 20 });
const settingName = "calendar.showDeclinedEvents";

beforeEach(() => authorizationTestDb.reset({
    user: [owner, other],
    userSetting: [{ id: 1, userId: other.id, name: settingName, value: false }],
}));

describe("own user settings", () => {
    it.each(["normal", "public"] as const)("dashboard settings follow the %s session, ignoring the cache discriminator", async persona => {
        const { ctx } = createAuthorizationPersona(persona, { id: owner.id });
        const dashboard = await invokeResolver(getDashboardData, { userId: other.id }, ctx);
        expect(dashboard).toMatchObject({
            userSettings: { [settingName]: true },
        });
    });

    it("loads defaults anonymously and only the specified user's preferences", async () => {
        expect(await loadUserSettings(null)).toEqual({ [settingName]: true, "calendar.showUninvitedEvents": true });
        expect(await loadUserSettings(owner.id)).toEqual({ [settingName]: true, "calendar.showUninvitedEvents": true });
        expect(await loadUserSettings(other.id)).toEqual({ [settingName]: false, "calendar.showUninvitedEvents": true });
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
    });

    it("creates, updates and audits a preference without duplicating the row", async () => {
        const { ctx } = createAuthorizationPersona("normal", { id: owner.id });
        expect(await invokeResolver(updateMyUserSettings, { [settingName]: false }, ctx))
            .toEqual({ [settingName]: false, "calendar.showUninvitedEvents": true });
        expect(await invokeResolver(updateMyUserSettings, { [settingName]: true }, ctx))
            .toEqual({ [settingName]: true, "calendar.showUninvitedEvents": true });
        await invokeResolver(updateMyUserSettings, { [settingName]: true }, ctx);

        expect(authorizationTestDb.snapshot("userSetting")).toEqual([
            { id: 1, userId: other.id, name: settingName, value: false },
            { id: 2, userId: owner.id, name: settingName, value: true },
        ]);
        expect(authorizationTestDb.snapshot("change")).toEqual([
            expect.objectContaining({ table: "UserSetting", userId: owner.id, action: "insert" }),
            expect.objectContaining({ table: "UserSetting", userId: owner.id, action: "update" }),
        ]);
    });

    it("does not overwrite unsubmitted preferences", async () => {
        await authorizationTestDb.userSetting!.create({ data: { userId: owner.id, name: "future.preference", value: "kept" } });
        const { ctx } = createAuthorizationPersona("normal", { id: owner.id });
        await invokeResolver(updateMyUserSettings, { [settingName]: false }, ctx);
        expect(authorizationTestDb.snapshot("userSetting")).toContainEqual(
            expect.objectContaining({ name: "future.preference", value: "kept" }),
        );
    });

    it("saves each calendar preference independently and returns both through the dashboard", async () => {
        const { ctx } = createAuthorizationPersona("normal", { id: owner.id });
        await invokeResolver(updateMyUserSettings, { [settingName]: false }, ctx);
        expect(await invokeResolver(updateMyUserSettings, { "calendar.showUninvitedEvents": false }, ctx))
            .toEqual({ [settingName]: false, "calendar.showUninvitedEvents": false });
        expect(await invokeResolver(updateMyUserSettings, { [settingName]: true }, ctx))
            .toEqual({ [settingName]: true, "calendar.showUninvitedEvents": false });
        expect(await invokeResolver(getDashboardData, {}, ctx)).toMatchObject({
            userSettings: { [settingName]: true, "calendar.showUninvitedEvents": false },
        });
        expect(await loadUserSettings(other.id))
            .toEqual({ [settingName]: false, "calendar.showUninvitedEvents": true });
    });

    it.each(["public", "deactivated", "missing"])("rejects writes for a %s principal", async kind => {
        const { ctx } = createAuthorizationPersona(kind === "public" ? "public" : "normal", { id: owner.id });
        if (kind === "deactivated") await authorizationTestDb.user!.update({ where: { id: owner.id }, data: { isDeleted: true } });
        if (kind === "missing") await authorizationTestDb.user!.delete({ where: { id: owner.id } });
        await expect(invokeResolver(updateMyUserSettings, { [settingName]: false }, ctx)).rejects.toThrow();
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(0);
    });

    it("rejects forged ownership and invalid patches before any writes", async () => {
        const { ctx } = createAuthorizationPersona("normal", { id: owner.id });
        for (const patch of [
            { [settingName]: false, userId: other.id },
            { [settingName]: "false" },
            { [settingName]: false, "unknown.setting": true },
        ]) {
            await expect(invokeResolver(updateMyUserSettings, patch as never, ctx)).rejects.toThrow();
        }
        expect(authorizationTestDb.snapshot("userSetting")).toHaveLength(1);
        expect(authorizationTestDb.snapshot("change")).toHaveLength(0);
    });
});
