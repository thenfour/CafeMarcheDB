// shared (no react!)

import { IntlMessageFormat } from "intl-messageformat";
import {
    kStaticLocalizedStringRegistry,
    type LocalizedMarkdownKey, type LocalizedPlainStringKey, type StaticLocalizedStringKey,
    type StaticLocalizedStringKeysWithoutParameters, type StaticLocalizedStringKeysWithParameters,
    type StaticStringArguments, type StaticStringParameterProps,
} from "./staticLocalizedStringRegistry";
import type { LocalePreferences } from "./localePreferences";
import type { LocaleAvailability, StringResolution } from "./stringResolution";

// Group parameterless keys so forwarding a key union avoids TypeScript's 25-combination limit.
export type LocalizedStringIdAndParams<K extends StaticLocalizedStringKey = StaticLocalizedStringKey> =
    // put strings without parameters in its own union branch, otherwise
    // the union of types with parameters includes all keys and TS fails to match types. Without
    // this branch, the type becomes something like,
    // { id: "firstKey"; parameters?: never }
    // | { id: "key2"; parameters?: never }
    // | { id: "menu.profile"; parameters: { bandName: string } }
    // | ...
    // so when passing a key without parameters, TS stops after 25 keys and fails to match the correct type.
    // this groups them into 1 check.
    { id: Extract<K, StaticLocalizedStringKeysWithoutParameters>; parameters?: never }
    // the following branch handles all keys with parameters
    | {
        [P in Extract<K, StaticLocalizedStringKeysWithParameters>]: { id: P } & StaticStringParameterProps<P>;
    }[Extract<K, StaticLocalizedStringKeysWithParameters>];

export interface LocalizationCatalog {
    readonly bandPublicId: string | null;
    readonly preferences: LocalePreferences;
    readonly formattingLocale: string;
    readonly availability: LocaleAvailability;
    readonly cacheKey: string;
    readonly payloadBytes: number;
    readonly strings: Readonly<Record<StaticLocalizedStringKey, StringResolution>>;
}

export function createLocaleApi(catalog: LocalizationCatalog | null, refetch: () => void = () => { }) {
    function getStringDetail(key: StaticLocalizedStringKey): StringResolution {
        if (!catalog) {
            throw new Error("Localization catalog is not loaded.");
        }
        const value = catalog.strings[key];
        if (!value) {
            throw new Error(`Localization key is not loaded: ${key}`);
        }
        return value;
    }
    function requireText(key: StaticLocalizedStringKey): StringResolution & { value: string } {
        const detail = getStringDetail(key);
        if (detail.value === null) {
            throw new Error(`No eligible translation for ${key}: ${detail.reason}`);
        }
        return {
            ...detail,
            value: detail.value,
        };
    }

    function formatPlainString(detail: StringResolution & { value: string }, parameters: Parameters<IntlMessageFormat["format"]>[0]): string {
        if (!catalog) {
            throw new Error("Localization catalog is not loaded.");
        }
        const message = new IntlMessageFormat(detail.value, detail.localeTag ?? "en-US", undefined, {
            ignoreTag: true,
            formatters: {
                getNumberFormat: (_locale, options) => new Intl.NumberFormat(catalog.formattingLocale, options),
                getDateTimeFormat: (_locale, options) => new Intl.DateTimeFormat(catalog.formattingLocale, options),
                // Plural grammar follows the translation's language; numbers/dates follow formatting preferences.
                getPluralRules: (locale, options) => new Intl.PluralRules(locale, options),
            },
        });
        const result = message.format(parameters);
        if (typeof result !== "string") {
            throw new Error("Expected a plain-text localization result.");
        }
        return result;
    }
    return {
        getStringDetail,

        // Use <Localized> for rendered content; use this helper where an API requires a string.
        getPlainString<K extends LocalizedPlainStringKey>(key: K, ...args: StaticStringArguments<K>): string {
            if (kStaticLocalizedStringRegistry[key].format !== "plain") {
                throw new Error(`Expected a plain-text key: ${key}`);
            }
            return formatPlainString(requireText(key), args[0]);
        },
        getMarkdownString(key: LocalizedMarkdownKey): string {
            if (kStaticLocalizedStringRegistry[key].format !== "markdown") {
                throw new Error(`Expected a Markdown key: ${key}`);
            }
            return requireText(key).value;
        },

        // Compose display text while keeping the original translation and its provenance.
        getString(input: LocalizedStringIdAndParams) {
            const detail = requireText(input.id);
            const entry = kStaticLocalizedStringRegistry[input.id];
            return {
                value: entry.format === "plain" ? formatPlainString(detail, input.parameters) : detail.value,
                detail,
                format: entry.format,
                entry,
            };
        },
        getRegistryEntry<K extends StaticLocalizedStringKey>(key: K) {
            return kStaticLocalizedStringRegistry[key];
        },
        formattingLocale: catalog?.formattingLocale ?? null,
        preferences: catalog?.preferences ?? null,
        refetch,
    };
}
