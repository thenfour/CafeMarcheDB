'use client'

import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyContent = () => {

    useAuthorizationOrThrow("info page", Permission.basic_trust);

    // this page is for like, general Café Marché info. but ideally we have a full wiki. we're not far off but ya....

    return <div>
        <SettingMarkdown setting="info_text" />
    </div>;
};



const Info9Page: BlitzPage = () => {

    return (
        <DashboardLayout title="Info">
            <Suspense fallback="Loading...">
                <MyContent />
            </Suspense>
        </DashboardLayout>
    );
}

export default Info9Page;
