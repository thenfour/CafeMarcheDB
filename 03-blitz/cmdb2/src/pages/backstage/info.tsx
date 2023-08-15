'use client'

import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import React, { Suspense } from "react";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import RichTextEditor from "src/core/components/RichTextEditor";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const MyContent = () => {
    let [initialValue, { refetch }] = useQuery(getSetting, "info_text");
    const [updateSetting] = useMutation(updateSettingMutation);
    const [isSaving, setIsSaving] = React.useState(true);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string) => {
        //console.log(`set "info_text" to ${newValue}`);
        setIsSaving(true);
        updateSetting({ name: "info_text", value: newValue }).then(x => {
            showSnackbar({ severity: "success", children: `should be saved...` });
            setIsSaving(false);
            refetch();
        }).catch(e => {
            showSnackbar({ severity: "error", children: `error when updating setting` });
        });
    };

    return <RichTextEditor initialValue={initialValue || ""} isSaving={isSaving} onValueChanged={onValueChanged} debounceMilliseconds={1000}></RichTextEditor>;
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
