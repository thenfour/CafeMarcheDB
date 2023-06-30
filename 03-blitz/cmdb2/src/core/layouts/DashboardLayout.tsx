import Head from "next/head"
import React, { FC, Suspense } from "react"
import { BlitzLayout } from "@blitzjs/next"
import Dashboard2 from "../components/Dashboard2";
import { Backdrop, CircularProgress } from "@mui/material";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import { useRouter } from "next/router";
import { BlitzPage, Routes } from "@blitzjs/next";
import Link from "next/link";
import { LoginForm } from "src/auth/components/LoginForm";
import { useTheme } from "@mui/material/styles";

const LoginSignup = () => {
    const router = useRouter()
    return (
        <>
            <Link href={Routes.SignupPage()}>
                <strong>Sign Up</strong>
            </Link>
            <Link href="/api/auth/google">
                <strong>Google</strong>
            </Link>
            <LoginForm
                onSuccess={(_user) => {
                    const next = router.query.next ? decodeURIComponent(router.query.next as string) : "/"
                    return router.push(next)
                }}
            />

        </>
    );
};

const DashboardLayout2 = ({ children }) => {
    const currentUser = useCurrentUser();
    return <Dashboard2>
        {
            !!currentUser ? children : (<LoginSignup></LoginSignup>)
        }
    </Dashboard2>
        ;
};

const DashboardLayout: BlitzLayout<{ title?: string; children?: React.ReactNode }> = ({
    title,
    children,
}) => {

    const fallback =
        <Backdrop open={true} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <CircularProgress color="inherit" />
        </Backdrop>
        ;

    return (
        <>
            <Head>
                <title>CM: {title}</title>
            </Head>

            <Suspense fallback={fallback}>
                <DashboardLayout2 children={children}></DashboardLayout2>
            </Suspense>

        </>
    )
}

export default DashboardLayout
