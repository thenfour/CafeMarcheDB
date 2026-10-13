import React from "react";
import { Alert, FormControl, InputLabel, Select, Stack } from "@mui/material";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useCmdbRouter } from "./useCmdbRouter";

export function PortalLanguageSelection() {
    const presentation = usePresentation();
    const locale = useLocale();
    const router = useCmdbRouter();
    const [switching, setSwitching] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const data = presentation.data;
    const selected = data?.input.routeLocale ?? "";
    const available = data?.localization.availability;
    const choices = (presentation.bandPublicId ? available?.band : available?.global) ?? [];
    const names = new Intl.DisplayNames([locale.formattingLocale ?? "en-US"], { type: "language" });

    async function selectLanguage(value: string) {
        setSwitching(true);
        setFailed(false);
        try {
            if (!await router.switchLanguage(value || null)) {
                setFailed(true);
            }
        } catch {
            setFailed(true);
        } finally {
            setSwitching(false);
        }
    }

    return <Stack spacing={1} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ maxWidth: 480 }}>
            <InputLabel shrink htmlFor="portal-language">{locale.getPlainString("dashboard.language.select")}</InputLabel>
            <Select native inputProps={{ id: "portal-language" }} value={selected} notched disabled={switching}
                label={locale.getPlainString("dashboard.language.select")}
                onChange={event => { void selectLanguage(event.target.value); }}>
                <option value="">{locale.getPlainString("dashboard.language.browser")}</option>
                {selected && !choices.includes(selected) && <option value={selected}>{names.of(selected) ?? selected}</option>}
                {choices.map(tag => <option key={tag} value={tag}>{names.of(tag) ?? tag}</option>)}
            </Select>
        </FormControl>
        {failed && <Alert severity="error">{locale.getPlainString("dashboard.language.failed")}</Alert>}
    </Stack>;
}
