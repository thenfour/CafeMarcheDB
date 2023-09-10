'use client'

import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import React, { Suspense } from "react";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { MarkdownControl } from "src/core/components/RichTextEditor";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyContent = () => {
    return <div>
        <SettingMarkdown settingName="info_text" />
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
