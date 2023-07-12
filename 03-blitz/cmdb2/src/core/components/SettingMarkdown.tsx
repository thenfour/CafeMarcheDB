import { useMutation, useQuery } from "@blitzjs/rpc";
import React, { Suspense } from "react";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import RichTextEditor from "src/core/components/RichTextEditor";
import { SnackbarContext } from "src/core/components/SnackbarContext";

//const settingName = "profile_markdown";


interface SettingMarkdownProps {
    settingName: string,
};

export const SettingMarkdown = (props: SettingMarkdownProps) => {
    let [initialValue, { refetch }] = useQuery(getSetting, props.settingName);
    const [updateSetting] = useMutation(updateSettingMutation);
    const [isSaving, setIsSaving] = React.useState(true);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string) => {
        //console.log(`set "info_text" to ${newValue}`);
        setIsSaving(true);
        updateSetting({ name: props.settingName, value: newValue }).then(x => {
            showSnackbar({ severity: "success", children: `should be saved...` });
            setIsSaving(false);
            refetch();
        }).catch(e => {
            showSnackbar({ severity: "error", children: `error when updating setting` });
        });
    };

    return <RichTextEditor initialValue={initialValue || ""} isSaving={isSaving} onValueChanged={onValueChanged} debounceMilliseconds={1000}></RichTextEditor>;
};



