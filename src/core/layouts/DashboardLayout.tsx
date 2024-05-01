import { BlitzLayout } from "@blitzjs/next";
import { Backdrop, CircularProgress } from "@mui/material";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { CoerceToBoolean } from "shared/utils";
import { LoginForm } from "src/auth/components/LoginForm";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import Dashboard2, { NavRealm } from "../components/Dashboard2";
import { Permission } from "shared/permissions";

const LoginSignup = () => {
    const router = useRouter();
    return (
        <div className="signInPageMain">
            <Link href="/api/auth/google" className="signInBlock google link googleSignInLink">
                <div className="title">
                    <img src="/web_light_rd_na.svg" />
                    Click here to sign in via Google
                </div>
                <div className="description">
                    <p>Using this option avoids creating a username & password just for this website.
                        Your private information will not be shared with this website.</p>
                    <p>If you don't have an account on this website yet, one will be created and associated with your Google identity automatically.</p>
                </div>
            </Link>
            <div className="signInBlock login">
                <LoginForm
                    onSuccess={(_user) => {
                        //const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
                        //return router.push(next)
                        void router.push("/backstage");
                    }}
                />
            </div>
            <Link href={"/auth/signup"} className="signInBlock link createNewAccount">
                <div className="title">
                    Create a new account using email & password
                </div>
                <div className="description">
                    Use this option if you don't have a Google account.
                    {/* Anyone can create an account, but you'll have limited access at first. An admin will need to give you elevated access. */}
                </div>
            </Link>
        </div>
    );
};

interface DashboaldLayout2Props {
    disableLoginRedirect?: boolean;
    navRealm?: NavRealm;
    basePermission?: Permission;
}

const DashboardLayout2 = ({ disableLoginRedirect, navRealm, basePermission, children }: React.PropsWithChildren<DashboaldLayout2Props>) => {
    const [currentUser] = useCurrentUser();

    return <Dashboard2 navRealm={navRealm} basePermission={basePermission}>
        {
            (!!currentUser || disableLoginRedirect) ? children : (<LoginSignup></LoginSignup>)
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
                <link rel="icon" type="image/png" href="/favicon.png" />
            </Head>

            <Suspense fallback={fallback}>
                <DashboardLayout2 disableLoginRedirect={CoerceToBoolean(disableLoginRedirect, false)} navRealm={navRealm} basePermission={basePermission}>{children}</DashboardLayout2>
            </Suspense>

        </>
    )
};

export default DashboardLayout
