import { useQuery } from "@blitzjs/rpc";
import { Alert, MenuItem } from "@mui/material";
import Link from "next/link";
import React from "react";
import getAvailableBands from "src/auth/queries/getAvailableBands";
import type { AvailableBand } from "src/auth/shared/availableBands";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { Localized } from "src/locale/components/Localized";
import { useCmdbRouter } from "src/route/useCmdbRouter";
import { BandBadge } from "../BandBadge";

function destinationLocale(band: AvailableBand, routeLocale: string | null | undefined) {
    if (!routeLocale) {
        return routeLocale;
    }
    // An unsupported destination language returns to the browser's preference order.
    return band.supportedLocales.some(tag =>
        new Intl.Locale(tag).language === new Intl.Locale(routeLocale).language) ? routeLocale : null;
}

function useBandMenuNavigation(onNavigate: (() => void) | undefined) {
    const router = useCmdbRouter();
    const [switching, setSwitching] = React.useState(false);
    const switchingRef = React.useRef(false);
    const [failed, setFailed] = React.useState(false);

    async function navigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        event.preventDefault();
        if (switchingRef.current) {
            return;
        }
        switchingRef.current = true;
        setSwitching(true);
        setFailed(false);
        try {
            const changed = await router.push(href);
            if (changed) {
                onNavigate?.();
            } else {
                setFailed(true);
            }
        } catch {
            setFailed(true);
        } finally {
            switchingRef.current = false;
            setSwitching(false);
        }
    }

    return { switching, failed, navigate };
}

function PlatformBandMenuItems({ onNavigate }: { onNavigate?: () => void }) {
    const router = useCmdbRouter();
    const presentation = usePresentation();
    const { bandPublicId: _selected, ...input } = presentation.data?.input ?? {};
    const [bands] = useQuery(getAvailableBands, input, { keepPreviousData: false, staleTime: 0 });
    const { switching, failed, navigate } = useBandMenuNavigation(onNavigate);
    const selected = presentation.bandPublicId;

    const platformHref = router.href("/platform", { bandPublicId: null });
    return <>
        <MenuItem component={Link} href={platformHref} disabled={switching}
            selected={!selected} aria-current={!selected ? "page" : undefined}
            onClick={event => { void navigate(event, platformHref); }}>
            <Localized id="dashboard.band.platform" />
        </MenuItem>
        {bands.map(band => {
            const href = router.href("/backstage", {
                bandPublicId: band.publicId,
                routeLocale: destinationLocale(band, input.routeLocale),
            });
            const isSelected = selected === band.publicId;
            return <MenuItem key={band.publicId} component={Link} href={href}
                disabled={switching} selected={isSelected} aria-current={isSelected ? "page" : undefined}
                onClick={event => { void navigate(event, href); }}
                sx={{
                    mx: 1, my: 0.75, p: 0, minWidth: 240, maxWidth: 360, borderRadius: 1,
                    "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: "transparent" },
                    "&:hover .BandBadge, &.Mui-focusVisible .BandBadge": {
                        outline: `2px solid ${band.theme.secondaryMain}`, outlineOffset: 2,
                    },
                }}>
                <BandBadge band={band} selected={isSelected} />
            </MenuItem>;
        })}
        {failed && <li><Alert severity="error"><Localized id="dashboard.band.switchFailed" /></Alert></li>}
    </>;
}

/** Menu entries shared by the account menu and platform landing pages. */
export function BandMenuItems({ onNavigate }: { onNavigate?: () => void }) {
    const router = useCmdbRouter();
    if (router.hosting.kind !== "multiBand") {
        return null;
    }
    return <React.Suspense fallback={<MenuItem disabled><Localized id="dashboard.band.loading" /></MenuItem>}>
        <PlatformBandMenuItems onNavigate={onNavigate} />
    </React.Suspense>;
}
