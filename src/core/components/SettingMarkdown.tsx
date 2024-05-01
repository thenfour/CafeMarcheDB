// NB: THis should not reference  "../db3/clientAPI", because it would be a circular dependency.

import { useAuthenticatedSession } from "@blitzjs/auth";
import { useMutation, useQuery } from "@blitzjs/rpc";
import React from "react";
import { Permission } from "shared/permissions";
import { SettingKey, gQueryOptions } from "shared/utils";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { CompactMarkdownControl, MarkdownControl } from "./RichTextEditor";
import { DashboardContext } from "./DashboardContext";
//import { API } from "../db3/clientAPI";

export const GenerateDefaultDescriptionSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.DescriptionMarkdown` as SettingKey;
export const GenerateForeignSingleSelectStyleSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.SelectStyle` as SettingKey;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MutationMarkdownControlProps {
    initialValue: string | null,
    refetch: () => void,
    onChange: (value: string | null) => Promise<any>,
    successMessage?: string,
    errorMessage?: string,
    debounceMilliseconds?: number,
    editButtonText?: string,
    helpText?: React.ReactNode,
    readonly?: boolean,
    className?: string;
    closeButtonText?: string,
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

    return <MarkdownControl
        initialValue={props.initialValue || ""}
        className={props.className}
        isSaving={isSaving}
        readonly={props.readonly}
        onValueChanged={onValueChanged}
        debounceMilliseconds={props.debounceMilliseconds || 1200}
        editButtonText={props.editButtonText}
        helpText={props.helpText}
        closeButtonText={props.closeButtonText}
    />;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// same but compact single-line version
interface CompactMutationMarkdownControlProps {
    initialValue: string | null,
    refetch: () => void,
    className?: string;
    onChange: (value: string | null) => Promise<any>,
    successMessage?: string,
    errorMessage?: string,
    editButtonVariant?: "framed" | "default";
    cancelButtonMessage?: string,
    saveButtonMessage?: string,
    readonly?: boolean,
    editButtonMessage?: string,
};

export const CompactMutationMarkdownControl = (props: CompactMutationMarkdownControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onValueChanged = async (newValue: string | null): Promise<void> => {
        try {
            await props.onChange(newValue);
            showSnackbar({ severity: "success", children: props.successMessage || "Updated" });
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: props.errorMessage || "Error" });
        } finally {
            props.refetch();
        }
    };
    return <CompactMarkdownControl
        initialValue={props.initialValue}
        onValueChanged={onValueChanged}
        className={props.className}
        readonly={props.readonly}
        cancelButtonMessage={props.cancelButtonMessage}
        saveButtonMessage={props.saveButtonMessage}
        editButtonMessage={props.editButtonMessage}
        editButtonVariant={props.editButtonVariant}
    />;
};







////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// intended only for admin-editable GUI content (not site content but chrome application content)
interface SettingMarkdownProps {
    //settingName: string;
    setting: SettingKey;
};

export const SettingMarkdown = (props: SettingMarkdownProps) => {
    const [updateSetting] = useMutation(updateSettingMutation);
    const dashboardContext = React.useContext(DashboardContext);
    const showAdminControls = dashboardContext.isShowingAdminControls;

    const editable = dashboardContext.isAuthorized(Permission.sysadmin) && showAdminControls;

    let [initialValue, { refetch }] = useQuery(getSetting, { name: props.setting }, gQueryOptions.default);
    return <MutationMarkdownControl
        initialValue={initialValue}
        refetch={refetch}
        helpText={`Setting: ${props.setting}`}
        readonly={!editable}
        onChange={(newValue) => {
            return updateSetting({ name: props.setting, value: newValue });
        }}
    />;
};



