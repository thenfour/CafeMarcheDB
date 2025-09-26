import type { BlitzLayout } from "@blitzjs/next";
import { Backdrop, CircularProgress } from "@mui/material";
import Head from "next/head";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { CoerceToBoolean } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { LoginSignup } from "../LoginSignupForm";
import Dashboard2 from "./Dashboard2";
import { NavRealm } from "./StaticMenuItems";
import { useQuery } from "@blitzjs/rpc";
import getDashboardSettings from "@/src/auth/queries/getDashboardSettings";

interface DashboaldLayout2Props {
    disableLoginRedirect?: boolean;
    navRealm?: NavRealm;
    basePermission?: Permission;
}

const DashboardLayout2 = ({ disableLoginRedirect, navRealm, basePermission, children }: React.PropsWithChildren<DashboaldLayout2Props>) => {
    const [currentUser] = useCurrentUser();

    return <Dashboard2 navRealm={navRealm} basePermission={basePermission}>
        {
            (!!currentUser || disableLoginRedirect) ? children : (<LoginSignup />)
        }
    </Dashboard2>
        ;
};

const DashboardLayout: BlitzLayout<{ title?: string; children?: React.ReactNode, disableLoginRedirect?: boolean, navRealm?: NavRealm, basePermission?: Permission }> = ({
    title,
    children,
    disableLoginRedirect,
    navRealm,
    basePermission,
}) => {

    const fallback =
        <Backdrop open={true} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <CircularProgress color="inherit" />
        </Backdrop>
        ;

    // TODO: find a way to access this from dashboard context...
    const [settings] = useQuery(getDashboardSettings, {}, { suspense: false });

    const titleText = `${settings?.Dashboard_SiteTitlePrefix ?? "CM: "}${title}`;
    const faviconUrl = settings?.Dashboard_SiteFaviconUrl ?? "/favicon.png";

    return (
        <>
            <Head>
                <title>{titleText}</title>
                <meta charSet="utf-8" /> { /* needed for Draft.js */}

                {/* for mobile, this sets the initial zoom for the page, so
                basically this should be the width of your page for mobile in project/local coords.
                about 400px is comfortable, 500px would be fine for this site, but we're not ready
                for that yet.
                */}
                <meta name="viewport" content="width=750" />
                <link rel="icon" type="image/png" href={faviconUrl} />
            </Head>
            <Suspense fallback={fallback}>
                <DashboardLayout2 disableLoginRedirect={CoerceToBoolean(disableLoginRedirect, false)} navRealm={navRealm} basePermission={basePermission}>
                    {children}
                </DashboardLayout2>
            </Suspense>
        </>
    )
};

export default DashboardLayout
