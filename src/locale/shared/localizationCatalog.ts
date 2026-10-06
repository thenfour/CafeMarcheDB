import { IntlMessageFormat } from "intl-messageformat";
import { kStaticLocalizedStringRegistry, type LocalizedMarkdownKey, type LocalizedPlainStringKey,
    type StaticLocalizedStringKey, type StaticStringArguments } from "./staticLocalizedStringRegistry";
import type { LocalePreferences } from "./localePreferences";
import type { LocaleAvailability, StringResolution } from "./stringResolution";

export interface LocalizationCatalog {
    readonly bandPublicId: string | null;
    readonly preferences: LocalePreferences;
    readonly formattingLocale: string;
    readonly availability: LocaleAvailability;
    readonly cacheKey: string;
    readonly payloadBytes: number;
    readonly strings: Readonly<Record<StaticLocalizedStringKey, StringResolution>>;
}

export function createLocaleApi(catalog: LocalizationCatalog | null, refetch: () => void = () => {}) {
    function getStringDetail(key: StaticLocalizedStringKey): StringResolution {
        if (!catalog) throw new Error("Localization catalog is not loaded.");
        const value = catalog.strings[key];
        if (!value) throw new Error(`Localization key is not loaded: ${key}`);
        return value;
    }
    function requireText(key: StaticLocalizedStringKey): StringResolution & { value: string } {
        const detail = getStringDetail(key);
        if (detail.value === null) throw new Error(`No eligible translation for ${key}: ${detail.reason}`);
        return { ...detail, value: detail.value };
    }
    return {
        getStringDetail,
        getPlainString<K extends LocalizedPlainStringKey>(key: K, ...args: StaticStringArguments<K>): string {
            if (kStaticLocalizedStringRegistry[key].format !== "plain") throw new Error(`Expected a plain-text key: ${key}`);
            const detail = requireText(key);
            const message = new IntlMessageFormat(detail.value, detail.localeTag ?? "en-US", undefined, {
                ignoreTag: true,
                formatters: {
                    getNumberFormat: (_locale, options) => new Intl.NumberFormat(catalog!.formattingLocale, options),
                    getDateTimeFormat: (_locale, options) => new Intl.DateTimeFormat(catalog!.formattingLocale, options),
                    // Plural grammar follows the translation's language; numbers/dates follow formatting preferences.
                    getPluralRules: (locale, options) => new Intl.PluralRules(locale, options),
                },
            });
            const result = message.format(args[0]);
            if (typeof result !== "string") throw new Error(`Expected plain text from ${key}`);
            return result;
        },
        getMarkdownString(key: LocalizedMarkdownKey): string {
            if (kStaticLocalizedStringRegistry[key].format !== "markdown") throw new Error(`Expected a Markdown key: ${key}`);
            return requireText(key).value;
        },
        formattingLocale: catalog?.formattingLocale ?? null,
        preferences: catalog?.preferences ?? null,
        refetch,
    };
}
