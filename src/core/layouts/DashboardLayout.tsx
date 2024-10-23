import { BlitzLayout } from "@blitzjs/next";
import { Backdrop, CircularProgress } from "@mui/material";
import Head from "next/head";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { CoerceToBoolean } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import Dashboard2, { NavRealm } from "../components/Dashboard2";
import GoogleAnalytics from "../components/GoogleAnalytics";
import { LoginSignup } from "../components/LoginSignupForm";
import { useSession } from "@blitzjs/auth";

interface DashboaldLayout2Props {
    disableLoginRedirect?: boolean;
    navRealm?: NavRealm;
    basePermission?: Permission;
}

const DashboardLayout2 = ({ disableLoginRedirect, navRealm, basePermission, children }: React.PropsWithChildren<DashboaldLayout2Props>) => {
    const sess = useSession();
    const [currentUser] = useCurrentUser();

    // React.useEffect(() => {
    //     console.log(`ok installing gtag with userid=${currentUser?.id || "<none>"}`);
    //     // Initialize Google Analytics
    //     window.dataLayer = window.dataLayer || [];
    //     window.gtag = window.gtag || function () {
    //         window.dataLayer.push(arguments);
    //     };

    //     // Configure Google Analytics with your tracking ID and user_id
    //     window.gtag("js", new Date());
    //     window.gtag("config", "G-NFRZM0JQL3", {
    //         user_id: currentUser?.id || undefined, // If session.userId exists, pass it
    //     });
    // }, [currentUser?.id]);

    return <Dashboard2 navRealm={navRealm} basePermission={basePermission}>
        <GoogleAnalytics trackingId={sess.GOOGLE_ANALYTICS_ID_BACKSTAGE} />
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

    return (
        <>
            <Head>
                <title>{`CM: ${title}`}</title>
                <meta charSet="utf-8" /> { /* needed for Draft.js */}
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
