
export const SYSTEM_LOCALE = "en-US";

// this is what the client supplies
export interface LocalePreferenceInput {
    readonly routeLocale?: string | null;
    readonly browserLanguages?: readonly string[];
}

// this is the processed  version of the client supplied prefs
// convert from LocalePreferenceInput to this in collectLocalePreferences()
export interface LocalePreferences {
    readonly routeLocale: string | null;
    readonly browserLanguages: readonly string[];
    readonly orderedTags: readonly string[];
}

export function normalizeLocaleTag(tag: string): string {
    const normalized = Intl.getCanonicalLocales(tag.trim())[0];
    if (!normalized) throw new RangeError("A locale tag is required.");
    return normalized;
}

export function collectLocalePreferences(input: LocalePreferenceInput = {}): LocalePreferences {
    const routeLocale = input.routeLocale ? normalizeLocaleTag(input.routeLocale) : null;
    const browserLanguages: string[] = [];
    for (const tag of input.browserLanguages ?? []) {
        try {
            const normalized = normalizeLocaleTag(tag);
            if (!browserLanguages.includes(normalized)) {
                browserLanguages.push(normalized);
            }
        } catch {
            // Browser and HTTP language lists may contain unsupported or malformed hints.
        }
    }
    return {
        routeLocale,
        browserLanguages,
        orderedTags: [...new Set([...(routeLocale ? [routeLocale] : []), ...browserLanguages, SYSTEM_LOCALE])],
    };
}

export function parseAcceptLanguage(header: string | undefined): string[] {
    return (header ?? "").split(",").map((entry, index) => {
        const [tag, ...parameters] = entry.trim().split(";");
        const qualityParameter = parameters.find(parameter => parameter.trim().startsWith("q="));
        const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
        return { tag: tag ?? "", quality, index };
    }).filter(entry => entry.tag !== "*" && entry.quality > 0 && entry.quality <= 1)
        .sort((a, b) => b.quality - a.quality || a.index - b.index)
        .map(entry => entry.tag);
}

export function selectFormattingLocale(preferences: LocalePreferences): string {
    return preferences.orderedTags.find(tag =>
        Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0
        && Intl.NumberFormat.supportedLocalesOf([tag]).length > 0,
    ) ?? SYSTEM_LOCALE;
}
