import type { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import { QuickSearchInputSchema, QuickSearchResultsSchema, type QuickSearchPermissionPolicy } from "src/core/db3/shared/quickSearchTypes";
import type { PresentationInput } from "src/locale/shared/presentationInput";

export async function fetchObjectQuery<TItemType extends QuickSearchItemType>(
    keyword: string,
    allowedItemTypes: readonly TItemType[],
    presentation: PresentationInput,
    permissionPolicy: QuickSearchPermissionPolicy,
    signal?: AbortSignal,
): Promise<QuickSearchItemMatch<TItemType>[]> {
    const input = QuickSearchInputSchema.parse({ ...presentation, keyword, allowedItemTypes, permissionPolicy });
    const query = new URLSearchParams({ keyword, allowedItemTypes: JSON.stringify(allowedItemTypes), bandPublicId: input.bandPublicId, permissionPolicy });

    // lsmb todo: this should also be in a centralized routine.
    if (input.routeLocale) {
        query.set("routeLocale", input.routeLocale);
    }
    if (input.browserLanguages) {
        query.set("browserLanguages", JSON.stringify(input.browserLanguages));
    }
    const response = await fetch(`/api/wiki/quickSearch?${query}`, { signal, cache: "no-store" });
    if (!response.ok) {
        throw new Error("Search suggestions could not be loaded.");
    }
    const results = QuickSearchResultsSchema.parse(await response.json());
    if (results.some(result => !allowedItemTypes.some(type => type === result.itemType))) {
        throw new Error("Search returned an unrequested item type.");
    }
    // Runtime validation and membership checks narrow every result to the requested public identity types.
    return results as QuickSearchItemMatch<TItemType>[];
}
