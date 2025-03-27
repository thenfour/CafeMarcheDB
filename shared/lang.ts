import { IsNullOrWhitespace } from "./utils";


export type EnNlFr = "en" | "nl" | "fr";

type LangSelectStringWithDetailResult<T extends string | null | undefined> = {
    result: T extends string ? string : string | null | undefined,
    preferredLangWasChosen: boolean;
    chosenLang: EnNlFr | null;
};

export function LangSelectStringWithDetail<
    T extends string | null | undefined
>(
    preferredLang: EnNlFr,
    value_en: T,
    value_nl: T,
    value_fr: T
): LangSelectStringWithDetailResult<T> {
    switch (preferredLang) {
        case "en":
            if (!IsNullOrWhitespace(value_en)) return { chosenLang: preferredLang, preferredLangWasChosen: true, result: value_en! };
            break;
        case "nl":
            if (!IsNullOrWhitespace(value_nl)) return { chosenLang: preferredLang, preferredLangWasChosen: true, result: value_nl! };
            break;
        case "fr":
            if (!IsNullOrWhitespace(value_fr)) return { chosenLang: preferredLang, preferredLangWasChosen: true, result: value_fr! };
            break;
    }

    // Fallback to any available value
    if (!IsNullOrWhitespace(value_en)) return { chosenLang: "en", preferredLangWasChosen: false, result: value_en! };
    if (!IsNullOrWhitespace(value_nl)) return { chosenLang: "nl", preferredLangWasChosen: false, result: value_nl! };
    if (!IsNullOrWhitespace(value_fr)) return { chosenLang: "fr", preferredLangWasChosen: false, result: value_fr! };

    // If all values are nullish, return null
    return { chosenLang: null, preferredLangWasChosen: false, result: "" }; // return an empty string because we dont know if null is allowed.
}

export const SelectEnglishNoun = (quantity: number, singular: string, plural: string) => Math.abs(quantity) === 1 ? singular : plural;

export function LangSelectString<
    T extends string | null | undefined
>(
    preferredLang: EnNlFr,
    value_en: T,
    value_nl: T,
    value_fr: T
): T extends string ? string : string | null | undefined {
    return LangSelectStringWithDetail(preferredLang, value_en, value_nl, value_fr).result;
}

