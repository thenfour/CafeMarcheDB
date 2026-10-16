import type { RouteBandAndLocale } from "src/route/portalRouting";
import { parseAcceptLanguage } from "./localePreferences";
import { PresentationInputSchema, type PresentationInput } from "./presentationInput";

/** Project resolved routing parameters into presentation preferences. */
export function pagePresentationInput(selection: RouteBandAndLocale, acceptLanguage?: string): PresentationInput {
    return PresentationInputSchema.parse({
        bandPublicId: selection.bandPublicId,
        routeLocale: selection.routeLocale,
        browserLanguages: parseAcceptLanguage(acceptLanguage),
    });
}
