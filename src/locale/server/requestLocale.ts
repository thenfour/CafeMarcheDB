import { Prisma } from "@prisma/client";
import db from "db";

export type LocaleDatabase = Pick<Prisma.TransactionClient, "locale">;

// Blitz enhances the delegate's types; these reads use the standard Prisma API.
export const localeDatabase = db as unknown as LocaleDatabase;

const localeSelection = Prisma.validator<Prisma.LocaleSelect>()({
    id: true,
    publicId: true,
    ietfTag: true,
});

export type RequestLocale = Prisma.LocaleGetPayload<{
    select: typeof localeSelection
}>;

function selectLocale(locales: readonly RequestLocale[], requested?: string): RequestLocale {
    const normalized = requested ? Intl.getCanonicalLocales(requested)[0] : "en-US";
    const exact = locales.find(locale => locale.ietfTag.toLowerCase() === normalized?.toLowerCase());
    const language = normalized?.split("-")[0]?.toLowerCase();
    const sameLanguage = locales.find(locale => locale.ietfTag.split("-")[0]?.toLowerCase() === language);
    const selected = exact ?? sameLanguage ?? locales.find(locale => locale.ietfTag === "en-US") ?? locales[0];
    if (!selected) throw new Error("No active locale is available for this scope.");
    return selected;
}

// see comments in dashboardContext.tsx; this single server-side  chosen locale is not actually
// that meaningful and should be avoided in favor of the actual documented rules.
export async function resolveRequestLocale(
    database: LocaleDatabase,
    bandId: number | null,
    requested?: string,
): Promise<RequestLocale> {
    const locales = await database.locale.findMany({
        where: {
            isDeleted: false,
            ...(bandId === null ? {} : { bandLocales: { some: { bandId } } }),
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: localeSelection,
    });
    return selectLocale(locales, requested);
}
