import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { initializeAccessControl } from "src/setup/accessControl";
import { generatePublicId } from "src/server/publicId";
import { matchesDB3Where } from "src/core/db3/shared/core/db3MemoryQuery";
import { settingsMysqlTestUrl, withSettingsMysqlFixture } from "./support/settingsMysqlFixture";

describe.skipIf(!settingsMysqlTestUrl)("DB3 string predicate parity with MariaDB", () => {
    const database = new PrismaClient(settingsMysqlTestUrl ? { datasources: { db: { url: settingsMysqlTestUrl } } } : undefined);
    beforeAll(() => initializeAccessControl(database), 30_000);
    afterAll(() => database.$disconnect());
    it("matches ordinary Prisma strings for case, accents, patterns, padding and SQL nulls", () => withSettingsMysqlFixture(database, async (tx, fixture) => {
        const samples = ["Flute", "FLUTE", "Fl\u00fbte", "Flute ", "Flute\t", "", null, "A%_B", "coeur", "c\u0153ur", "Stra\u00dfe", "Strasse", "e\u0301", "\u00e9", "A_B", "A\\B", "I", "i", "\u0130", "\u0131"];
        const stringIds: number[] = [];
        for (const indexedValue of samples) {
            const identity = await tx.dynamicLocalizedString.create({ data: { publicId: generatePublicId(), values: { create: {
                publicId: generatePublicId(), localeId: fixture.englishId, indexedValue,
            } } } });
            stringIds.push(identity.id);
        }
        const conditions: Prisma.StringNullableFilter[] = [
            ...["flut", "FLUT", "fl\u00fb", "f_u", "%", "\\%", "\\_", "coeu", "c\u0153u", "\u00e9", "ss", "\\\\", "_", "i"].map(contains => ({ contains })),
            { startsWith: "fl%" }, { endsWith: "\u00e9" }, { equals: "I" }, { endsWith: "TE" }, { equals: "Flute" }, { equals: "" }, { equals: null },
            { not: "Flute" }, { not: { contains: "flut" } }, { in: ["flute", "coeur"] }, { notIn: ["flute", "coeur"] },
        ];
        for (const condition of conditions) {
            const ordinary = await tx.dynamicLocalizedStringValue.findMany({ where: { stringId: { in: stringIds }, indexedValue: condition }, select: { stringId: true } });
            const expected = stringIds.filter(id => ordinary.some(row => row.stringId === id));
            const actual = stringIds.filter((_id, index) => matchesDB3Where({ name: samples[index] }, { name: condition }));
            expect(actual, JSON.stringify(condition)).toEqual(expected);
        }
        const nested: Prisma.DynamicLocalizedStringValueWhereInput[] = [
            { NOT: { indexedValue: { contains: "flut" } } },
            { NOT: { indexedValue: { equals: null } } },
            { NOT: { OR: [{ indexedValue: "Flute" }, { indexedValue: "coeur" }] } },
            { OR: [{ indexedValue: null }, { indexedValue: { contains: "flut" } }] },
        ];
        for (const where of nested) {
            const ordinary = await tx.dynamicLocalizedStringValue.findMany({ where: { AND: [{ stringId: { in: stringIds } }, where] }, select: { stringId: true } });
            const expected = stringIds.filter(id => ordinary.some(row => row.stringId === id));
            const actual = stringIds.filter((_id, index) => matchesDB3Where({ indexedValue: samples[index] }, where));
            expect(actual, JSON.stringify(where)).toEqual(expected);
        }
    }));
});
