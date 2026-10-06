import React from "react";
import { createLocaleApi } from "../shared/localizationCatalog";
import { usePresentation } from "./PresentationProvider";

export const useLocale = () => {
    const presentation = usePresentation();
    return React.useMemo(() => createLocaleApi(
        presentation.data?.localization ?? null,
        () => {
            void presentation.invalidate();
        }
    ), [presentation]);
};
