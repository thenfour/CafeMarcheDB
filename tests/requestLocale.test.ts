import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveRequestLocale } from "src/locale/server/requestLocale";
import { authorizationTestDb } from "./authorization/support/inMemoryPrisma";

// The in-memory delegates implement the standard queries exercised here.
const database = authorizationTestDb as unknown as Prisma.TransactionClient;

beforeEach(() => authorizationTestDb.reset({
    locale: ["en-US", "fr-BE", "nl-BE", "fr-FR"].map((ietfTag, index) => ({
        id: index + 1, publicId: `Locale000000000${index + 1}`, ietfTag, isDeleted: false, sortOrder: index,
    })),
    bandLocale: [1, 2, 3].map(localeId => ({ id: localeId, bandId: 1, localeId })),
}));

describe("request locale resolution", () => {
    it.each([
        ["fR-be", "fr-BE"], ["fr-FR", "fr-BE"], ["nl-NL", "nl-BE"],
        ["de-DE", "en-US"], [undefined, "en-US"],
    ])("matches %s against enabled locales as %s", async (requested, expected) => {
        expect((await resolveRequestLocale(database, 1, requested)).ietfTag).toBe(expected);
    });

    it("uses the platform's active locales without requiring band opt-ins", async () => {
        expect((await resolveRequestLocale(database, null, "fr-FR")).ietfTag).toBe("fr-FR");
    });

    it("excludes deleted locales and another band's enabled locales", async () => {
        await authorizationTestDb.getDelegate("locale").update({ where: { id: 2 }, data: { isDeleted: true } });
        await authorizationTestDb.getDelegate("bandLocale").create({ data: { bandId: 2, localeId: 4 } });
        expect((await resolveRequestLocale(database, 1, "fr-FR")).ietfTag).toBe("en-US");
        expect((await resolveRequestLocale(database, 2, "fr-FR")).ietfTag).toBe("fr-FR");
    });

    it("uses stable locale ordering when English and a language match are unavailable", async () => {
        await authorizationTestDb.getDelegate("bandLocale").deleteMany({ where: { localeId: 1 } });
        await authorizationTestDb.getDelegate("locale").update({ where: { id: 2 }, data: { sortOrder: 2 } });
        expect((await resolveRequestLocale(database, 1, "de-DE")).ietfTag).toBe("fr-BE");
    });

    it.each([1, null])("rejects presentation requests without an active locale (band %s)", async bandId => {
        await authorizationTestDb.getDelegate("locale").deleteMany();
        await expect(resolveRequestLocale(database, bandId)).rejects.toThrow("No active locale");
    });

    it("rejects malformed locale hints", async () => {
        await expect(resolveRequestLocale(database, 1, "fr_BE")).rejects.toBeInstanceOf(RangeError);
    });
});
