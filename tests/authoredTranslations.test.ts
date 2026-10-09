import { describe, expect, it } from "vitest";
import { authoredTranslationContext, homepageDisplayLanguage, resolveAuthoredTranslations } from "src/locale/shared/authoredTranslations";
import { parseAcceptLanguage } from "src/locale/shared/localePreferences";

const enabled = ["en-US", "nl-BE", "fr-BE"];
describe("authored publication translations", () => {
    it("resolves each field using ordered browser preferences after an unsupported route", () => {
        const context = authoredTranslationContext({ routeLocale: "de-DE", browserLanguages: ["fr-CA", "nl-NL"] }, enabled);
        expect(resolveAuthoredTranslations({ en: "English", fr: "French", nl: "Dutch" }, context)).toBe("French");
        expect(resolveAuthoredTranslations({ en: "English", fr: null, nl: "Dutch" }, context)).toBe("Dutch");
    });
    it("keeps deliberate blanks instead of falling back to English", () => {
        const context = authoredTranslationContext({ routeLocale: "fr-BE" }, enabled);
        expect(resolveAuthoredTranslations({ en: "English", fr: "", nl: "Dutch" }, context)).toBe("");
        expect(resolveAuthoredTranslations({ en: "English", fr: null, nl: undefined }, context)).toBe("English");
    });
    it("uses actual enabled regional tags and excludes disabled languages", () => {
        const context = authoredTranslationContext({ routeLocale: "fr-BE", browserLanguages: ["nl-NL"] }, ["nl-NL"]);
        expect(resolveAuthoredTranslations({ en: "English", fr: "French", nl: "Dutch" }, context)).toBe("Dutch");
    });
    it("returns missing when no authored translation is enabled", () => {
        const context = authoredTranslationContext({ routeLocale: "fr-BE" }, ["de-DE"]);
        expect(resolveAuthoredTranslations({ en: "English", fr: "French", nl: "Dutch" }, context)).toBeNull();
    });
    it("keeps HTTP preference weights and ignores forbidden wildcard/zero hints", () => {
        const preferences = parseAcceptLanguage("nl-NL;q=0.7, fr-CA;q=1, en;q=0, *;q=0.8");
        expect(preferences).toEqual(["fr-CA", "nl-NL"]);
        expect(homepageDisplayLanguage({ browserLanguages: preferences })).toBe("fr");
    });
    it("selects original homepage chrome independently of enabled authored content", () => {
        expect(homepageDisplayLanguage({ routeLocale: "nl-NL", browserLanguages: ["fr-BE"] })).toBe("nl");
        expect(homepageDisplayLanguage({ routeLocale: "de-DE" })).toBe("en");
    });
});
