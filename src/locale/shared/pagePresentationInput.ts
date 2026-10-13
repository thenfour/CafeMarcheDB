import type { ParsedUrlQuery } from "querystring";
import { parseAcceptLanguage } from "./localePreferences";
import { PresentationInputSchema, type PresentationInput } from "./presentationInput";

/** Middleware supplies URL context; bootstrap and transport servers validate its host and scope. */
export function pagePresentationInput(query: ParsedUrlQuery, acceptLanguage?: string): PresentationInput {
    return PresentationInputSchema.parse({
        bandPublicId: query.bandPublicId, routeLocale: query.routeLocale,
        browserLanguages: parseAcceptLanguage(acceptLanguage),
    });
}
