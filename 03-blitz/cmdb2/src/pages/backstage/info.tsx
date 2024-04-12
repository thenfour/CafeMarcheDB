'use client'

import { BlitzPage } from "@blitzjs/next";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { MarkdownControl } from "src/core/components/RichTextEditor";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyContent = () => {

    // todo: what is this page
    useAuthorizationOrThrow("info page", Permission.basic_trust);


    return <div>
        <SettingMarkdown setting="info_text" />
        <input />
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
