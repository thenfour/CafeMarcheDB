import { usePresentation } from "src/locale/components/PresentationProvider";
import type { PresentationInput } from "src/locale/shared/presentationInput";

export type DB3QueryContextInput = Pick<PresentationInput, "bandPublicId" | "routeLocale" | "browserLanguages" | "clientRequestId">;

/** Native grids, autocomplete and pickers use the complete presentation input, including its refresh key. */
export function useDB3QueryContext(): DB3QueryContextInput {
    const presentation = usePresentation();
    return {
        bandPublicId: presentation.bandPublicId,
        routeLocale: presentation.data?.input.routeLocale,
        browserLanguages: [...(presentation.data?.input.browserLanguages ?? [])],
        clientRequestId: presentation.data?.input.clientRequestId
    };
}
