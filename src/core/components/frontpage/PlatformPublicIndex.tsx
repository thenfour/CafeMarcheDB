// for sites that have no front page content (only backstage), this redirects.

import Head from "next/head";
import React from "react";
import { BandSelection } from "../dashboard/BandSelection";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export type PlatformPublicIndexProps = {

};

export const PlatformPublicIndex: React.FC<PlatformPublicIndexProps> = () => {
    //const router = useCmdbRouter();
    const dashboardContext = useDashboardContext();

    return (
        <>
            <Head>
                <title>cmdb</title>
            </Head>

            <div>
                <div>
                    <h1 style={{ marginBottom: 8 }}>Welcome to cmdb.</h1>
                    <p>todo: login, signup, select band, locale, your avatar showing you have an account and  logged in</p>
                    <p>you are: {dashboardContext.currentUser?.name ?? "not logged in"}</p>
                    {!dashboardContext.currentUser?.name ? <a href="/auth/login">Login</a> : <a href="/auth/logout">Logout</a>}
                    <BandSelection />
                </div>
            </div>
        </>
    );
};

export default PlatformPublicIndex;


