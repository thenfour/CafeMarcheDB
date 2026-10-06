import { describe, expect, it } from "vitest";
import { collectLocalePreferences, parseAcceptLanguage, selectFormattingLocale } from "src/locale/shared/localePreferences";
import { lookupExactTranslation, resolveInheritedString, resolveString, type TranslationValue } from "src/locale/shared/stringResolution";
import { createLocaleApi } from "src/locale/shared/localizationCatalog";

const translation = (localeTag: string, value: string): TranslationValue => ({ localeTag, value });
const availability = { global: ["en-US", "fr-BE", "fr-FR", "nl-BE"], band: ["en-US", "fr-BE", "fr-FR", "nl-BE"] };
const preferences = collectLocalePreferences({ browserLanguages: ["nl-NL"] });
const base = { availability, preferences, globalValues: [translation("nl-BE", "Global Dutch")], bandValues: [] };

describe("locale preferences and formatting", () => {
    it("preserves route/browser tags and removes duplicates without throwing on malformed browser hints", () => {
        expect(collectLocalePreferences({ routeLocale: "fR-be", browserLanguages: ["nl-nl", "FR-BE", "bad_locale", "nl-NL"] }))
            .toEqual({ routeLocale: "fr-BE", browserLanguages: ["nl-NL", "fr-BE"], orderedTags: ["fr-BE", "nl-NL", "en-US"] });
        expect(() => collectLocalePreferences({ routeLocale: "fr_BE" })).toThrow(RangeError);
    });
    it("orders HTTP language hints by quality and ignores zero/wildcard/invalid tags centrally", () => {
        const languages = parseAcceptLanguage("nl-NL;q=0.5, fr-FR, en;q=0, *;q=0.8, de-DE;q=2, fr-BE;q=0.5");
        expect(collectLocalePreferences({ browserLanguages: languages }).browserLanguages).toEqual(["fr-FR", "nl-NL", "fr-BE"]);
    });
    it("formats with route preference even without a database-supported translation", () => {
        const requested = collectLocalePreferences({ routeLocale: "de-DE", browserLanguages: ["nl-BE"] });
        expect(selectFormattingLocale(requested)).toBe("de-DE");
        expect(resolveString({ ...base, preferences: requested }).localeTag).toBe("nl-BE");
        expect(selectFormattingLocale(collectLocalePreferences({ routeLocale: "zz-ZZ", browserLanguages: ["fr-BE"] }))).toBe("fr-BE");
    });
});

describe("per-string resolution", () => {
    it("gives a Dutch viewer a French band override while another string stays Dutch", () => {
        expect(resolveString({ ...base, bandValues: [translation("fr-BE", "Band French")] })).toMatchObject({ value: "Band French", scope: "band", reason: "any" });
        expect(resolveString(base)).toMatchObject({ value: "Global Dutch", scope: "global", reason: "language", requestedTag: "nl-NL" });
    });
    it("tries route exact/language before browser exact/language, then English and any", () => {
        const requested = collectLocalePreferences({ routeLocale: "fr-CA", browserLanguages: ["nl-BE", "de-DE"] });
        const values = [translation("nl-BE", "Dutch"), translation("fr-FR", "French"), translation("en-US", "English")];
        expect(resolveString({ ...base, preferences: requested, globalValues: values }).value).toBe("French");
        expect(resolveString({ ...base, preferences: requested, globalValues: values.filter(value => value.localeTag !== "fr-FR") }).value).toBe("Dutch");
        expect(resolveString({ ...base, preferences: requested, globalValues: [translation("en-US", "English")] }).reason).toBe("system");
    });
    it("retains intentional blank overrides and suppresses even registered English defaults", () => {
        expect(resolveString({ ...base, bandValues: [translation("fr-BE", "")], registeredDefault: "English" }))
            .toMatchObject({ value: "", source: "stored", scope: "band" });
    });
    it("excludes unavailable values without restoring global meaning for unavailable overrides", () => {
        expect(resolveString({ ...base, availability: { ...availability, band: ["en-US"] },
            bandValues: [translation("fr-BE", "Disabled")], registeredDefault: "English" }))
            .toMatchObject({ value: null, scope: "band", reason: "unavailable-override" });
        expect(resolveString({ ...base, availability: { ...availability, global: ["en-US"] }, globalValues: base.globalValues }))
            .toMatchObject({ value: null, reason: "missing" });
    });
    it("breaks language and last-resort ties independently of row ordering", () => {
        const values = [translation("fr-FR", "France"), translation("fr-BE", "Belgium")];
        for (const globalValues of [values, [...values].reverse()]) {
            expect(resolveString({ ...base, globalValues }).value).toBe("Belgium");
            expect(resolveString({ ...base, globalValues, preferences: collectLocalePreferences({ routeLocale: "fr-CA" }) }).value).toBe("Belgium");
        }
    });
    it("uses registry defaults as English candidates and preserves blank global values", () => {
        expect(resolveString({ ...base, globalValues: [], registeredDefault: "OK" })).toMatchObject({ value: "OK", source: "registry", reason: "registry-default" });
        expect(resolveString({ ...base, globalValues: [translation("en-US", "")], registeredDefault: "OK" })).toMatchObject({ value: "", source: "stored" });
    });
    it("distinguishes missing exact values, inherited text, and empty custom text", () => {
        expect(lookupExactTranslation([translation("fr-BE", "")], "fr-be")).toBe("");
        expect(lookupExactTranslation([translation("fr-BE", "French")], "fr-FR")).toBeNull();
        expect(resolveInheritedString({ globalValues: base.globalValues, bandValues: null }, base).value).toBe("Global Dutch");
        expect(resolveInheritedString({ globalValues: base.globalValues, bandValues: [] }, base).value).toBeNull();
        expect(resolveInheritedString({ globalValues: base.globalValues, bandValues: [translation("en-US", "")] }, base).value).toBe("");
    });
    it("fails explicitly before catalog delivery", () => {
        expect(() => createLocaleApi(null).getPlainString("common.action.ok")).toThrow("not loaded");
    });
    it("keeps key formats and ICU parameters typed", () => {
        // These compile-time checks never call an unloaded catalog.
        if (false) {
            const locale = createLocaleApi(null);
            // @ts-expect-error Markdown keys cannot be requested as plain text.
            locale.getPlainString("instrumentList_markdown");
            // @ts-expect-error Plain-text keys cannot be requested as Markdown.
            locale.getMarkdownString("common.action.ok");
            // @ts-expect-error Registered parameters are required.
            locale.getPlainString("common.items.count");
            // @ts-expect-error The registered count parameter must be numeric.
            locale.getPlainString("common.items.count", { count: "2" });
            // @ts-expect-error Parameterless keys do not accept interpolation values.
            locale.getPlainString("common.action.ok", { count: 2 });
        }
        expect(true).toBe(true);
    });
});
