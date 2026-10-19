import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { Prisma } from "@prisma/client";
import db from "db";
import { createHash } from "node:crypto";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { Permission } from "shared/permissions";
import { collectLocalePreferences, selectFormattingLocale, type LocalePreferenceInput } from "../shared/localePreferences";
import { kStaticLocalizedStringRegistry, type StaticLocalizedStringKey } from "../shared/staticLocalizedStringRegistry";
import { lookupExactTranslation, resolveString, type LocaleAvailability, type TranslationValue } from "../shared/stringResolution";
import type { LocalizationCatalog } from "../shared/localizationCatalog";

export type LocalizationDatabase = Pick<Prisma.TransactionClient, "locale" | "staticLocalizedStringValue"
    | "bandStaticLocalizedStringValue" | "dynamicLocalizedStringValue" | "bandDynamicLocalizedStringValue">;
// Blitz augments Prisma delegates; this service uses the standard Prisma API.
export const localizationDatabase = db as unknown as LocalizationDatabase;

// returns a list of ietf tags available globally & for band. if band is null, band locales is empty.
export async function loadLocaleAvailability(database: Pick<LocalizationDatabase, "locale">, bandId: number | null): Promise<LocaleAvailability> {
    const locales = await database.locale.findMany({
        where: { isDeleted: false },
        select: {
            ietfTag: true,
            bandLocales: {
                where: {
                    bandId: bandId ?? -1
                },
                select:
                    { id: true }
            }
        },
        orderBy: [{ ietfTag: "asc" }],
    });
    const relevant = (bandId === null ? locales : locales
        .filter(locale => locale.bandLocales.length > 0))
        .map(locale => locale.ietfTag);
    return {
        global: relevant,
        band: bandId === null ? [] : relevant,
    };
}

const valueSelection = Prisma.validator<Prisma.StaticLocalizedStringValueSelect>()({
    indexedValue: true, blobValue: true, locale: { select: { ietfTag: true } }, updatedAt: true,
});
type StoredTranslation = Prisma.StaticLocalizedStringValueGetPayload<{ select: typeof valueSelection }>;

function decodeTranslation(row: StoredTranslation): TranslationValue {
    if ((row.indexedValue === null) === (row.blobValue === null)) throw new Error("A translation needs exactly one value column.");
    return { localeTag: row.locale.ietfTag, value: row.indexedValue ?? row.blobValue! };
}

export async function loadLocalizationCatalog(database: LocalizationDatabase, auth: CMServerAuthorization, input: LocalePreferenceInput = {}): Promise<LocalizationCatalog> {
    const preferences = collectLocalePreferences(input);
    const keys = Object.keys(kStaticLocalizedStringRegistry);
    const [availability, globalRows, bandRows] = await Promise.all([
        loadLocaleAvailability(database, auth.band?.id ?? null),
        database.staticLocalizedStringValue.findMany({
            where: { stringKey: { in: keys } },
            select: { ...valueSelection, stringKey: true },
        }),
        auth.band ? database.bandStaticLocalizedStringValue.findMany({
            where: { bandId: auth.band.id, stringKey: { in: keys } },
            select: { ...valueSelection, stringKey: true }
        }) : Promise.resolve<Array<StoredTranslation & { stringKey: string }>>([]),
    ]);
    const entries = keys.map(key => {
        // Object.keys loses the registry's literal key union; these keys come only from that registry.
        const registeredKey = key as StaticLocalizedStringKey;

        return [registeredKey, resolveString({
            preferences, availability,
            globalValues: globalRows.filter(row => row.stringKey === key).map(decodeTranslation),
            bandValues: bandRows.filter(row => row.stringKey === key).map(decodeTranslation),
            registeredDefault: kStaticLocalizedStringRegistry[registeredKey].defaultValue,
        })] as const;
    });
    // Every registered key has one resolution in entries, including explicit missing results.
    const strings = Object.fromEntries(entries) as LocalizationCatalog["strings"];

    const bandPublicId = auth.band?.publicId ?? null;
    const cacheKey = createHash("sha256").update(JSON.stringify({
        bandPublicId,
        preferences,
        availability,
        authorization: auth.toClientContext(),
        globalRows,
        bandRows,
        strings,
    })).digest("hex");
    const content = {
        bandPublicId,
        preferences,
        availability,
        strings,
        formattingLocale: selectFormattingLocale(preferences),
        cacheKey,
    };
    return {
        ...content,
        payloadBytes: Buffer.byteLength(JSON.stringify(content), "utf8"),
    };
}

// exact locale,
// and does not perform override resolution; a simple lookup.
export async function lookupStaticTranslation(
    database: Pick<LocalizationDatabase, "staticLocalizedStringValue" | "bandStaticLocalizedStringValue">,
    auth: CMServerAuthorization,
    key: StaticLocalizedStringKey,
    localeTag: string,
    scope: "global" | "band"
): Promise<string | null> {
    auth.requirePermission(scope === "global" ? Permission.manage_global_localization : BandPermission.manage_band_localization);
    const rows = scope === "global"
        ? await database.staticLocalizedStringValue.findMany({ where: { stringKey: key }, select: valueSelection })
        : await database.bandStaticLocalizedStringValue.findMany({ where: { stringKey: key, bandId: auth.requireBand().id }, select: valueSelection });
    return lookupExactTranslation(rows.map(decodeTranslation), localeTag);
}

/** Call only with string IDs obtained from an authorized entity read in this transaction. No public arbitrary-ID endpoint. */
export async function resolveAuthorizedDynamicStrings(
    database: LocalizationDatabase,
    // caller performs authorization for entities;
    // string presentation only needs band scope.
    scope: { readonly band: { readonly id: number } | null },
    stringIds: readonly number[],
    input: LocalePreferenceInput = {},
) {
    const preferences = collectLocalePreferences(input);
    const [availability, globalRows, bandRows] = await Promise.all([
        loadLocaleAvailability(database, scope.band?.id ?? null),
        database.dynamicLocalizedStringValue
            .findMany({
                where: { stringId: { in: [...stringIds] } },
                select: { ...valueSelection, stringId: true }
            }),
        scope.band ? database.bandDynamicLocalizedStringValue
            .findMany({
                where: { bandId: scope.band.id, stringId: { in: [...stringIds] } },
                select: { ...valueSelection, stringId: true }
            }) : Promise.resolve<Array<StoredTranslation & { stringId: number }>>([]),
    ]);
    return new Map(stringIds.map(id => [id, resolveString({
        preferences, availability,
        globalValues: globalRows.filter(row => row.stringId === id).map(decodeTranslation),
        bandValues: bandRows.filter(row => row.stringId === id).map(decodeTranslation),
    })]));
}

// this function has no consumers?
// /** Exact dynamic lookup is also internal: IDs must come from an authorized entity/editor read. */
// export async function lookupAuthorizedDynamicTranslation(
//     database: LocalizationDatabase,
//     auth: CMServerAuthorization,
//     stringId: number,
//     localeTag: string,
//     scope: "global" | "band"
// ): Promise<string | null> {
//     auth.requirePermission(scope === "global" ? Permission.manage_global_localization : Permission.manage_band_localization);
//     const rows = scope === "global"
//         ? await database.dynamicLocalizedStringValue.findMany({ where: { stringId }, select: valueSelection })
//         : await database.bandDynamicLocalizedStringValue.findMany({ where: { stringId, bandId: auth.requireBand().id }, select: valueSelection });
//     return lookupExactTranslation(rows.map(decodeTranslation), localeTag);
// }
