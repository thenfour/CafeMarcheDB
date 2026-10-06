import React from "react";
import { MenuItem, TextField } from "@mui/material";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { LocalizedStringField } from "../shared/columnTypes/localizedString";
import type { xTable } from "../shared/db3core";

/** A localized quick-create must show its writing language before it sends an explicit translation. */
export function useDB3CreateFromString(table: xTable) {
    const locale = useLocale();
    const presentation = usePresentation();
    const localized = table.columns.some(field => field instanceof LocalizedStringField);
    const enabled = presentation.data?.localization.availability.band ?? [];
    const [localeTag, setLocaleTag] = React.useState(enabled[0] ?? "");
    const writingLocale = enabled.includes(localeTag) ? localeTag : enabled[0] ?? "";
    const canCreate = !!table.createInsertModelFromString && (!localized || enabled.includes(writingLocale));
    return {
        canCreate,
        controls: localized ? <TextField select label={locale.getPlainString("catalog.locale")} value={writingLocale}
            onChange={event => setLocaleTag(event.target.value)} sx={{ mb: 1, display: "block" }}>
            {!enabled.includes(writingLocale) && <MenuItem value={writingLocale} disabled>{localeTag}</MenuItem>}
            {enabled.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
        </TextField> : undefined,
        createModel: (input: string) => {
            if (!canCreate || !table.createInsertModelFromString) {
                throw new Error("Creation requires an enabled writing language and a declared DB3 factory.");
            }
            return table.createInsertModelFromString(input, localized ? { localeTag: writingLocale } : undefined);
        },
    };
}
