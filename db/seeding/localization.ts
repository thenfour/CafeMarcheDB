import { LocalizedStringFormat, type Prisma } from "@prisma/client";
import { generatePublicId } from "../../src/server/publicId";

export type SeedLocale = "en-US" | "fr-BE" | "nl-BE";
export type SeedText = Readonly<{ "en-US": string; "fr-BE"?: string; "nl-BE"?: string }>;

export async function seedLocalizedString(db: Prisma.TransactionClient, locales: ReadonlyMap<SeedLocale, number>,
    text: SeedText, format: LocalizedStringFormat): Promise<number> {
    const values: Prisma.DynamicLocalizedStringValueUncheckedCreateWithoutStringInput[] = [];
    for (const [locale, localeId] of locales) {
        const value = text[locale];
        if (value === undefined) {
            continue;
        }
        values.push({ publicId: generatePublicId<"DynamicLocalizedStringValue">(), localeId,
            ...(format === LocalizedStringFormat.PlainText ? { indexedValue: value } : { blobValue: value }) });
    }
    const row = await db.dynamicLocalizedString.create({ data: {
        publicId: generatePublicId<"DynamicLocalizedString">(), format, values: { create: values },
    } });
    return row.id;
}

export async function seedLabels(db: Prisma.TransactionClient, locales: ReadonlyMap<SeedLocale, number>,
    name: SeedText, description: SeedText): Promise<{ nameId: number; descriptionId: number }> {
    return {
        nameId: await seedLocalizedString(db, locales, name, LocalizedStringFormat.PlainText),
        descriptionId: await seedLocalizedString(db, locales, description, LocalizedStringFormat.Markdown),
    };
}
