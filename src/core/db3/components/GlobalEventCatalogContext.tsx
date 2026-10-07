import { Alert } from "@mui/material";
import type { PropsWithChildren } from "react";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";

/** Platform mode shows global defaults without a selected band's translation overrides. */
export function GlobalEventCatalogContext({ children }: PropsWithChildren) {
    const presentation = usePresentation();
    const locale = useLocale();
    if (presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("eventCatalog.platformMode")}</Alert>;
    }
    return <>{children}</>;
}
