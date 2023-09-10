import { useMutation, useQuery } from "@blitzjs/rpc";
import React, { Suspense } from "react";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CompactMarkdownControl, MarkdownControl } from "./RichTextEditor";

/*

let's take event attendance response as an example;
the snackbar, the debouncing, and markdown control i kinda want to be encapsulated

*/

interface MutationMarkdownControlProps {
    initialValue: string | null,
    refetch: () => void,
    onChange: (value: string | null) => Promise<any>,
    successMessage?: string,
    errorMessage?: string,
    debounceMilliseconds?: number,
};

export const MutationMarkdownControl = (props: MutationMarkdownControlProps) => {
    const [isSaving, setIsSaving] = React.useState(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string | null) => {
        setIsSaving(true);
        props.onChange(newValue).then(x => {
            showSnackbar({ severity: "success", children: props.successMessage || "Updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: props.errorMessage || "Error" });
        }).finally(() => {
            setIsSaving(false);
            props.refetch();
        });
    };

    return <MarkdownControl initialValue={props.initialValue || ""} isSaving={isSaving} onValueChanged={onValueChanged} debounceMilliseconds={props.debounceMilliseconds || 1200} />;
};


// same but compact single-line version
interface CompactMutationMarkdownControlProps {
    initialValue: string | null,
    refetch: () => void,
    onChange: (value: string | null) => Promise<any>,
    successMessage?: string,
    errorMessage?: string,
    debounceMilliseconds?: number,
};

export const CompactMutationMarkdownControl = (props: CompactMutationMarkdownControlProps) => {
    const [isSaving, setIsSaving] = React.useState(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = (newValue: string | null) => {
        setIsSaving(true);
        props.onChange(newValue).then(x => {
            showSnackbar({ severity: "success", children: props.successMessage || "Updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: props.errorMessage || "Error" });
        }).finally(() => {
            setIsSaving(false);
            props.refetch();
        });
    };

    return <CompactMarkdownControl initialValue={props.initialValue || ""} isSaving={isSaving} onValueChanged={onValueChanged} debounceMilliseconds={props.debounceMilliseconds || 1200} />;
};







interface SettingMarkdownProps {
    settingName: string,
};

export const SettingMarkdown = (props: SettingMarkdownProps) => {
    const [updateSetting] = useMutation(updateSettingMutation);
    let [initialValue, { refetch }] = useQuery(getSetting, props.settingName);
    return <MutationMarkdownControl
        initialValue={initialValue}
        refetch={refetch}
        onChange={async (newValue) => {
            await updateSetting({ name: props.settingName, value: newValue });
        }}
    />;
};



