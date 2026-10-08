import { LocalizedStringFormat, type Prisma } from "@prisma/client";
import { demoId, type DemoConfig, type DemoLocale } from "./config";

export type DemoText = Readonly<{ "en-US": string; "fr-BE"?: string; "nl-BE"?: string }>;
export interface DemoContext {
    db: Prisma.TransactionClient;
    config: DemoConfig;
    locales: ReadonlyMap<DemoLocale, number>;
    id: (key: string) => string;
}

export function createDemoContext(db: Prisma.TransactionClient, config: DemoConfig,
    locales: ReadonlyMap<DemoLocale, number>): DemoContext {
    return { db, config, locales, id: key => demoId(config, key) };
}

export async function createDemoString(context: DemoContext, key: string, text: DemoText,
    format: LocalizedStringFormat = LocalizedStringFormat.PlainText): Promise<number> {
    const values: Prisma.DynamicLocalizedStringValueCreateWithoutStringInput[] = [];
    for (const [tag, localeId] of context.locales) {
        const value = text[tag];
        if (value !== undefined) {
            values.push({ publicId: context.id(`${key}:${tag}`), locale: { connect: { id: localeId } },
                ...(format === LocalizedStringFormat.PlainText ? { indexedValue: value } : { blobValue: value }) });
        }
    }
    const row = await context.db.dynamicLocalizedString.create({ data: { publicId: context.id(key), format, values: { create: values } } });
    return row.id;
}

export async function createDemoLabels(context: DemoContext, key: string, name: DemoText, description: DemoText) {
    const nameId = await createDemoString(context, `${key}:name`, name);
    const descriptionId = await createDemoString(context, `${key}:description`, description, LocalizedStringFormat.Markdown);
    return { nameId, descriptionId };
}
