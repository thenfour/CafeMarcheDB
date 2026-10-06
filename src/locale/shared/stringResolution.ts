// encapsulate the logic behind negotiating
// locale inputs (route, browser locale, available translations, supported locales, language vs. region, fallbacks...)
// and producing the correct resolved output string

import { SYSTEM_LOCALE, normalizeLocaleTag, type LocalePreferences } from "./localePreferences";

export interface TranslationValue {
    readonly localeTag: string;
    readonly value: string;
}

export interface LocaleAvailability {
    readonly global: readonly string[];
    readonly band: readonly string[];
}

export type StringResolution = {
    readonly value: string | null;
    readonly localeTag: string | null;
    readonly scope: "band" | "global" | null;
    readonly source: "stored" | "registry" | "missing";
    readonly reason: "exact" | "language" | "system" | "any" | "registry-default" | "unavailable-override" | "missing";
    readonly requestedTag: string | null;
};

export interface StringResolutionInput {
    readonly preferences: LocalePreferences;
    readonly availability: LocaleAvailability;
    readonly globalValues: readonly TranslationValue[];
    readonly bandValues: readonly TranslationValue[];
    readonly registeredDefault?: string;
}

function matchTranslation(values: readonly TranslationValue[], preferences: LocalePreferences) {
    // Sort without the host's locale: French region ties always choose the same tag.
    const ordered = [...values].sort((a, b) => a.localeTag < b.localeTag ? -1 : a.localeTag > b.localeTag ? 1 : 0);
    for (const tag of preferences.orderedTags) {
        const exact = ordered.find(value => value.localeTag === tag);
        if (exact) return { translation: exact, requestedTag: tag, reason: tag === SYSTEM_LOCALE ? "system" as const : "exact" as const };
        const language = new Intl.Locale(tag).language;
        const languageMatch = ordered.find(value => new Intl.Locale(value.localeTag).language === language);
        if (languageMatch) return { translation: languageMatch, requestedTag: tag, reason: "language" as const };
    }
    return ordered[0] ? { translation: ordered[0], requestedTag: null, reason: "any" as const } : null;
}

/** Each requested tag tries exact then language, before the next preference. Scope comes first. */
export function resolveString(input: StringResolutionInput): StringResolution {
    const scope = input.bandValues.length > 0 ? "band" : "global";
    const available = new Set(input.availability[scope].map(normalizeLocaleTag));
    const values = (scope === "band" ? input.bandValues : input.globalValues)
        .map(value => ({ ...value, localeTag: normalizeLocaleTag(value.localeTag) }))
        .filter(value => available.has(value.localeTag));
    // Defaults act as an English translation only when no band override exists.
    const hasStoredEnglish = values.some(value => value.localeTag === SYSTEM_LOCALE);
    const useDefault = scope === "global" && input.registeredDefault !== undefined && !hasStoredEnglish;
    if (useDefault) values.push({ localeTag: SYSTEM_LOCALE, value: input.registeredDefault! });
    const match = matchTranslation(values, input.preferences);
    if (!match) return {
        value: null, localeTag: null, scope: scope === "band" ? "band" : null, source: "missing",
        reason: scope === "band" ? "unavailable-override" : "missing", requestedTag: null,
    };
    const fromRegistry = useDefault && match.translation.localeTag === SYSTEM_LOCALE;
    return {
        value: match.translation.value, localeTag: match.translation.localeTag, scope,
        source: fromRegistry ? "registry" : "stored",
        reason: fromRegistry ? "registry-default" : match.reason, requestedTag: match.requestedTag,
    };
}

/** Editors use raw scope/locale values; missing and deliberately empty remain different. */
export function lookupExactTranslation(values: readonly TranslationValue[], localeTag: string): string | null {
    const tag = normalizeLocaleTag(localeTag);
    return values.find(value => normalizeLocaleTag(value.localeTag) === tag)?.value ?? null;
}

export interface InheritedStringField {
    readonly globalValues: readonly TranslationValue[];
    // null inherits; an empty list is custom content with no translations yet.
    readonly bandValues: readonly TranslationValue[] | null;
}

export function resolveInheritedString(field: InheritedStringField, input: Pick<StringResolutionInput, "preferences" | "availability">): StringResolution {
    if (field.bandValues !== null && field.bandValues.length === 0) {
        return { value: null, localeTag: null, scope: "band", source: "missing", reason: "missing", requestedTag: null };
    }
    return resolveString({ ...input, globalValues: field.globalValues, bandValues: field.bandValues ?? [] });
}
