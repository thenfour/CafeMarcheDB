import Head from "next/head"
import React, { FC, Suspense } from "react"
import { BlitzLayout } from "@blitzjs/next"
import Dashboard2, { NavRealm } from "../components/Dashboard2";
import { Backdrop, CircularProgress } from "@mui/material";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { useRouter } from "next/router";
import { BlitzPage, Routes } from "@blitzjs/next";
import Link from "next/link";
import { LoginForm } from "src/auth/components/LoginForm";
import { useTheme } from "@mui/material/styles";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";

const LoginSignup = () => {
    const router = useRouter()
    return (
        <div className="signInPageMain">
            <div className="signInBlock google">
                <Link href="/api/auth/google" className="link googleSignInLink">
                    Sign in via Google
                </Link>
                <div className="description">
                    <ul>
                        <li>Sign in</li>
                        <li>Or create an account associated with your Google account.</li>
                    </ul>

                    This way you don't need to create a password just for this site; it will be associated with your Google account. Note: your Google account will remain separate from this website; no private details will be shared. We will just use Google to verify your identity.
                </div>
            </div>
            <div className="signInBlock">
                <Link href={Routes.SignupPage()} className="link createNewAccount">
                    <strong>Create a new account</strong>
                </Link>
                Anyone can create an account, but you won't have permission to see everything right away.
            </div>
            <div className="signInBlock google">
                <LoginForm
                    onSuccess={(_user) => {
                        const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
                        return router.push(next)
                    }}
                />
            </div>
        </div>
    );
};

interface DashboaldLayout2Props {
    disableLoginRedirect?: boolean;
    navRealm?: NavRealm;
}

const DashboardLayout2 = ({ disableLoginRedirect, navRealm, children }: React.PropsWithChildren<DashboaldLayout2Props>) => {
    const [currentUser] = useCurrentUser();

    return <Dashboard2 navRealm={navRealm}>
        {
            (!!currentUser || disableLoginRedirect) ? children : (<LoginSignup></LoginSignup>)
        }
    </Dashboard2>
        ;
};

const DashboardLayout: BlitzLayout<{ title?: string; children?: React.ReactNode, disableLoginRedirect?: boolean, navRealm?: NavRealm }> = ({
    title,
    children,
    disableLoginRedirect,
    navRealm,
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
                <DashboardLayout2 disableLoginRedirect={disableLoginRedirect} navRealm={navRealm}>{children}</DashboardLayout2>
            </Suspense>

        </>
    )
};

export default DashboardLayout
