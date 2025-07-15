import type { BlitzLayout } from "@blitzjs/next";
import { Backdrop, CircularProgress } from "@mui/material";
import Head from "next/head";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { CoerceToBoolean } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { LoginSignup } from "../LoginSignupForm";
import { NavRealm } from "./MenuStructure";
import Dashboard2 from "./Dashboard2";

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

    const titleText = `CM: ${title}`;

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
                <link rel="icon" type="image/png" href="/favicon.png" />
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
