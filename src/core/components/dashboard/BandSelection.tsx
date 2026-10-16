// Lsmb todo: most of this should be done via the cmdb router api.

import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, FormControl, InputLabel, Select, Stack } from "@mui/material";
import { parsePublicId } from "shared/publicId";
import getAvailableBands from "src/auth/queries/getAvailableBands";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { portalHref } from "src/route/portalRouting";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { AvailableBand } from "@/src/auth/server/availableBands";

function selectLocaleForBand(destinationBand: AvailableBand | undefined, routeLocale: string | null | undefined) {
    if (!destinationBand || !routeLocale) {
        return routeLocale;
    }
    // Another band might not allow the current locale.
    // in which case fall back to "no locale"
    return destinationBand.supportedLocales.some(tag =>
        new Intl.Locale(tag).language === new Intl.Locale(routeLocale).language) ? routeLocale : null;
}

function PlatformBandSelection() {
    const router = useCmdbRouter();
    const presentation = usePresentation();
    const locale = useLocale();
    const { bandPublicId: _selected, ...input } = presentation.data?.input ?? {};
    const [choices] = useQuery(getAvailableBands, input, { keepPreviousData: false, staleTime: 0 });
    const [switching, setSwitching] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const selected = presentation.bandPublicId ?? "";
    const selectedChoice = choices.find(choice => choice.publicId === selected);

    async function selectBand(value: string) {
        setSwitching(true);
        setFailed(false);
        try {
            const destinationBand = choices.find(choice => choice.publicId === value);
            const routeLocale = input.routeLocale;
            const destinationLocale = selectLocaleForBand(destinationBand, routeLocale);

            // lsmb todo: use a strong routing strategy.
            // lsmb todo: preserve current domain (if you're viewing songs in band A, when switching to band B you should see songs as well.)
            const changed = await router.push(portalHref(value ? "/backstage" : "/platform", {
                bandPublicId: value ? parsePublicId<"Band">(value) : null,
                routeLocale: destinationLocale,
            }, router.hosting));
            if (!changed) {
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
            <InputLabel shrink htmlFor="dashboard-band">{locale.getPlainString("dashboard.band.select")}</InputLabel>
            <Select
                native
                inputProps={{ id: "dashboard-band" }}
                value={selected}
                label={locale.getPlainString("dashboard.band.select")}
                notched
                disabled={switching}
                onChange={event => { void selectBand(event.target.value); }}>
                <option value="">{locale.getPlainString("dashboard.band.platform")}</option>
                {selected && !selectedChoice && <option value={selected} disabled>{locale.getPlainString("dashboard.band.unavailable")}</option>}
                {choices.map(choice => <option key={choice.publicId} value={choice.publicId}>
                    {choice.name ?? locale.getPlainString("dashboard.band.unnamed")}
                </option>)}
            </Select>
        </FormControl>
        {choices.length === 0 && <Alert severity="info">{locale.getPlainString("dashboard.band.empty")}</Alert>}
        {failed && <Alert severity="error">{locale.getPlainString("dashboard.band.switchFailed")}</Alert>}
    </Stack>;
}

export function BandSelection() {
    const router = useCmdbRouter();
    return router.hosting.kind === "multiBand" ? <PlatformBandSelection /> : null;
}
