import type { EnNlFr } from "shared/lang";
import { collectLocalePreferences, type LocalePreferenceInput, type LocalePreferences } from "./localePreferences";
import { resolveString, type LocaleAvailability, type TranslationValue } from "./stringResolution";

export interface AuthoredTranslations {
    readonly en: string | null | undefined;
    readonly nl: string | null | undefined;
    readonly fr: string | null | undefined;
}

export interface AuthoredTranslationContext {
    readonly preferences: LocalePreferences;
    readonly availability: LocaleAvailability;
}

export function authoredTranslationContext(input: LocalePreferenceInput, enabledBandLocales: readonly string[]): AuthoredTranslationContext {
    return { preferences: collectLocalePreferences(input), availability: { global: [], band: enabledBandLocales } };
}

/** The publication columns store languages; enabled locale tags supply their regional identity. */
export function resolveAuthoredTranslations(values: AuthoredTranslations, context: AuthoredTranslationContext): string | null {
    const translations: TranslationValue[] = [];
    for (const localeTag of context.availability.band) {
        const language = new Intl.Locale(localeTag).language;
        if (language !== "en" && language !== "nl" && language !== "fr") {
            continue;
        }
        const value = values[language];
        // Empty text is authored content; only absent text may fall through to another language.
        if (value != null) {
            translations.push({ localeTag, value });
        }
    }
    return resolveString({ ...context, globalValues: [], bandValues: translations }).value;
}

/** The original homepage chrome has three authored languages, independent of content availability. */
export function homepageDisplayLanguage(input: LocalePreferenceInput): EnNlFr {
    for (const tag of collectLocalePreferences(input).orderedTags) {
        const language = new Intl.Locale(tag).language;
        if (language === "en" || language === "nl" || language === "fr") {
            return language;
        }
    }
    return "en";
}
