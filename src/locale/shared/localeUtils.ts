


// returns lower-cased lang & upper-cased region.
// does not validate that it's actually a valid locale.
// en-us -> { language: "en", region: "US" }
// FR-be -> { language: "fr", region: "BE" }
// throws if badly formed.
export function parseIetfLocale(ietfTag: string) {
    const [language, region] = ietfTag.split("-");
    if (!language || !region) {
        throw new Error(`Badly formed IETF locale tag: "${ietfTag}"`);
    }
    return {
        language: language.trim().toLowerCase(),
        region: region.trim().toUpperCase(),
        ietfTag: `${language.trim().toLowerCase()}-${region.trim().toUpperCase()}`,
    };
}
