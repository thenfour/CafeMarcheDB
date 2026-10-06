import type { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAuthorizationForUser } from "src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { loadSettingsSnapshot } from "src/setting/server/settings";
import { readSettingSnapshot } from "src/setting/shared/settingsContract";
import { parsePublicId } from "shared/publicId";
import { authorizationTestDb } from "../authorization/support/inMemoryPrisma";

vi.mock("db", async () => {
    const prisma = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const { authorizationTestDb } = await import("../authorization/support/inMemoryPrisma");
    return { ...prisma, default: authorizationTestDb };
});

// These fake delegates implement the standard Prisma reads used by the service.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;
const row = (bandId: number, value: string) => ({ id: bandId, bandId, name: "dateTime.bandTimeZone", value: JSON.stringify(value) });

describe("server band timezone configuration", () => {
    beforeEach(() => authorizationTestDb.reset({ band: [{ id: 1, publicId: "Band000000000001", isDeleted: false }] }));
    afterEach(() => { vi.unstubAllEnvs(); });

    it("uses Brussels without writing when the selected band has no setting", async () => {
        expect(await loadBandTimeZone(database, 1)).toBe("Europe/Brussels");
        expect(authorizationTestDb.snapshot("bandSetting")).toEqual([]);
    });

    it("reads fresh settings independently for each band", async () => {
        authorizationTestDb.getDelegate("bandSetting").reset([row(1, "Asia/Tokyo"), row(2, "America/Los_Angeles")]);
        expect(await loadBandTimeZone(database, 1)).toBe("Asia/Tokyo");
        expect(await loadBandTimeZone(database, 2)).toBe("America/Los_Angeles");
        await authorizationTestDb.getDelegate("bandSetting").update({ where: { id: 1 }, data: { value: JSON.stringify("UTC") } });
        expect(await loadBandTimeZone(database, 1)).toBe("UTC");
    });

    it("resolves the configured band using the supplied transaction's band delegate", async () => {
        vi.stubEnv("CMDB_DEFAULT_BAND_ID", "1");
        authorizationTestDb.getDelegate("bandSetting").reset([row(1, "Asia/Tokyo")]);
        const findBand = vi.spyOn(authorizationTestDb.getDelegate("band"), "findFirst");
        expect(await loadBandTimeZone(database)).toBe("Asia/Tokyo");
        expect(findBand).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, isDeleted: false } }));
    });

    it.each(["Moon/Base", "", "   "])("fails on invalid stored configuration %j", async value => {
        authorizationTestDb.getDelegate("bandSetting").reset([row(1, value)]);
        await expect(loadBandTimeZone(database, 1)).rejects.toThrow();
    });

    it("delivers the timezone in a public band snapshot without edit grants", async () => {
        authorizationTestDb.getDelegate("bandSetting").reset([row(1, "Asia/Tokyo")]);
        const auth = await loadAuthorizationForUser(null, database, { kind: "band", bandPublicId: parsePublicId<"Band">("Band000000000001") });
        const snapshot = await loadSettingsSnapshot(database, auth);
        expect(readSettingSnapshot(snapshot, "band", "dateTime.bandTimeZone")).toBe("Asia/Tokyo");
        expect(snapshot.band["dateTime.bandTimeZone"]?.capabilities).toEqual({ canView: true, canEdit: false });
    });
});
