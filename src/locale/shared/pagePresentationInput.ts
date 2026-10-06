import type { ParsedUrlQuery } from "querystring";
import { parseAcceptLanguage } from "./localePreferences";
import { PresentationInputSchema, type PresentationInput } from "./presentationInput";

/** Explicit selection during recovery. Full host/path portal resolution follows in phase 5. */
export function pagePresentationInput(query: ParsedUrlQuery, acceptLanguage?: string): PresentationInput {
    return PresentationInputSchema.parse({
        bandPublicId: query.bandPublicId, routeLocale: query.routeLocale,
        browserLanguages: parseAcceptLanguage(acceptLanguage),
    });
}
