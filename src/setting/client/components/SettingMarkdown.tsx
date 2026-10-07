import React from "react";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedMarkdownKey } from "src/locale/shared/staticLocalizedStringRegistry";

interface LocalizedMarkdownProps {
    setting: LocalizedMarkdownKey;
    fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString";
    fallbackMarkdown?: string | null;
}

// Scoped localized editing replaces the retired Setting writer in phase 6.
export const LocalizedMarkdown = (props: LocalizedMarkdownProps) => {
    const locale = useLocale();
    let text = locale.getStringDetail(props.setting).value;
    const fallbackWhen = props.fallbackWhen ?? "null";
    const missing = text === null;
    const empty = text !== null && text.trim() === "";
    if (props.fallbackMarkdown !== undefined && (fallbackWhen === "null" && missing
        || fallbackWhen === "emptyString" && empty || fallbackWhen === "nullOrEmptyString" && (missing || empty))) {
        text = props.fallbackMarkdown;
    }
    return <div className="settingMarkdownContainer"><Markdown markdown={text} /></div>;
};


// MIGRATION_RESTORE: markdown-editing
// Source: c4002c5f2ee1f79ee5f0501fb8f2382a32f2e8c4:src/core/components/SettingMarkdown.tsx:1-124
// Reason: LocalizedMarkdown preserves rendering but its inline editor was removed.
// Restore: Restore edit, cancel, save, save-and-close, feedback and refresh through explicit localized-string scope and locale.
// Verification: Test edit authorization, locale/band targeting, intentional blanks, cancellation, failed saves and presentation refresh; exercise the inline editor.
// SHA256: 4efd9d025181ba87f60d3cbef6781e08764a94d4ec907b760230f79322bf33a2
// MIGRATION_REFERENCE_BEGIN
// // NB: THis should not reference  "../db3/clientAPI", because it would be a circular dependency.
//
// import { useMutation, useQuery } from "@blitzjs/rpc";
// import React from "react";
// import { Permission } from "shared/permissions";
// import { gQueryOptions } from "shared/utils";
// import updateSettingMutation from "@/src/setting/server/mutations/updateSetting";
// import getSetting from "@/src/setting/server/queries/getSetting";
// import { SnackbarContext } from "src/core/components/SnackbarContext";
// import { CMSmallButton } from "./CMCoreComponents2";
// import { Markdown3Editor } from "./markdown/MarkdownControl3";
// import { Markdown } from "./markdown/Markdown";
// import { SettingKey } from "shared/settingKeys";
// import { useDashboardContext } from "./dashboardContext/DashboardContext";
// //import { API } from "../db3/clientAPI";
//
// export const GenerateDefaultDescriptionSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.DescriptionMarkdown` as SettingKey;
// export const GenerateForeignSingleSelectStyleSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.SelectStyle` as SettingKey;
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// // intended only for admin-editable GUI content (not site content but chrome application content)
// interface SettingMarkdownEditorProps {
//     setting: SettingKey;
//     onClose: () => void;
//     initialValue: string;
//     refetch: () => void;
// };
//
// const SettingMarkdownEditor = (props: SettingMarkdownEditorProps) => {
//     const [updateSetting] = useMutation(updateSettingMutation);
//     const [value, setValue] = React.useState<string>(props.initialValue || "");
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
//
//     const handleSave = async (): Promise<boolean> => {
//         try {
//             await updateSetting({
//                 name: props.setting,
//                 value,
//             });
//             showSnackbar({ severity: "success", children: "Success" });
//             props.refetch();
//             return true;
//         } catch (e) {
//             console.log(e);
//             showSnackbar({ severity: "error", children: "error updating event description" });
//             return false;
//         }
//     };
//
//     const hasEdits = (props.initialValue !== value);
//
//     const handleSaveAndClose = async (): Promise<boolean> => {
//         const r = await handleSave();
//         props.onClose();
//         return r;
//     };
//
//     return <>
//         <Markdown3Editor
//             onChange={(v) => setValue(v)}
//             value={value}
//             nominalHeight={300}
//             showActionButtons={true}
//             hasEdits={hasEdits}
//             handleCancel={props.onClose}
//             handleSave={handleSave}
//             handleSaveAndClose={handleSaveAndClose}
//         />
//     </>;
// };
//
// interface SettingMarkdownProps {
//     setting: SettingKey;
//     fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString"; // default is "null".
//
//     // undefined means no fallback will be applied.
//     fallbackMarkdown?: string | null;
// };
//
// export const SettingMarkdown = (props: SettingMarkdownProps) => {
//     const [editing, setEditing] = React.useState<boolean>(false);
//     const dashboardContext = useDashboardContext();
//     const showAdminControls = dashboardContext.isShowingAdminControls;
//
//     const editable = dashboardContext.isAuthorized(Permission.sysadmin) && showAdminControls;
//
//     let [initialValue, { refetch }] = useQuery(getSetting, { name: props.setting }, gQueryOptions.default);
//
//     const fallbackWhen = props.fallbackWhen || "null";
//     const fallbackMarkdown = props.fallbackMarkdown;
//     if (fallbackMarkdown !== undefined) {
//         if (fallbackWhen === "null") {
//             if (initialValue === null) {
//                 initialValue = fallbackMarkdown || null;
//             }
//         } else if (fallbackWhen === "emptyString") {
//             if (initialValue && initialValue.trim() === "") {
//                 initialValue = fallbackMarkdown || null;
//             }
//         } else if (fallbackWhen === "nullOrEmptyString") {
//             if (initialValue === null || (initialValue && initialValue.trim() === "")) {
//                 initialValue = fallbackMarkdown || null;
//             }
//         }
//     }
//
//     return <div className={`settingMarkdownContainer ${editable && "editable"}`}>
//         {editable && !editing && <CMSmallButton variant="framed" onClick={() => setEditing(true)}>Edit {props.setting}</CMSmallButton>}
//         {editing ? <SettingMarkdownEditor
//             onClose={() => setEditing(false)}
//             setting={props.setting}
//             initialValue={initialValue || ""}
//             refetch={refetch}
//         /> : <Markdown markdown={initialValue} />}
//     </div>;
// };
//
//
//
//
//
//
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: markdown-editing
// Source: 1cdb8299f3f0b373ade44adc44de26e06fd59b6a:src/setting/client/components/SettingMarkdown.tsx:1-130
// Reason: LocalizedMarkdown preserves rendering but its inline editor was removed.
// Restore: Restore edit, cancel, save, save-and-close, feedback and refresh through explicit localized-string scope and locale.
// Verification: Test edit authorization, locale/band targeting, intentional blanks, cancellation, failed saves and presentation refresh; exercise the inline editor.
// SHA256: 96e1c8e7e0f5c6d343f648df9a52e95bcfd9e67b4fbd9c0d8569f9f65d139ccd
// MIGRATION_REFERENCE_BEGIN
// // NB: THis should not reference  "../db3/clientAPI", because it would be a circular dependency.
//
// import { useMutation, useQuery } from "@blitzjs/rpc";
// import React from "react";
// import { Permission } from "shared/permissions";
// import { gQueryOptions } from "shared/utils";
// import updateSettingMutation from "@/src/setting/server/mutations/updateSetting";
// import { SnackbarContext } from "src/core/components/SnackbarContext";
// import { CMSmallButton } from "../../../core/components/CMCoreComponents2";
// import { Markdown3Editor } from "../../../core/components/markdown/MarkdownControl3";
// import { Markdown } from "../../../core/components/markdown/Markdown";
// //import { SettingKey } from "@/src/setting/shared/settingKeys";
// import { useDashboardContext } from "../../../core/components/dashboardContext/DashboardContext";
// import { LocalizedMarkdownKey, StaticLocalizedStringKey } from "@/src/locale/staticLocalizedStringRegistry";
// import { useLocale } from "@/src/locale/useLocale";
// //import { API } from "../db3/clientAPI";
//
// // export const GenerateDefaultDescriptionSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.DescriptionMarkdown` as SettingKey;
// // export const GenerateForeignSingleSelectStyleSettingName = (tableName: string, columnName: string) => `${tableName}.${columnName}.SelectStyle` as SettingKey;
//
//
// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// // intended only for admin-editable GUI content (not site content but chrome application content)
// interface SettingMarkdownEditorProps {
//     setting: StaticLocalizedStringKey;
//     onClose: () => void;
//     initialValue: string;
//     refetch: () => void;
// };
//
// const SettingMarkdownEditor = (props: SettingMarkdownEditorProps) => {
//     const [updateSetting] = useMutation(updateSettingMutation);
//     const [value, setValue] = React.useState<string>(props.initialValue || "");
//     const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
//
//     const handleSave = async (): Promise<boolean> => {
//         try {
//             await updateSetting({
//                 name: props.setting,
//                 value,
//             });
//             showSnackbar({ severity: "success", children: "Success" });
//             props.refetch();
//             return true;
//         } catch (e) {
//             console.log(e);
//             showSnackbar({ severity: "error", children: "error updating event description" });
//             return false;
//         }
//     };
//
//     const hasEdits = (props.initialValue !== value);
//
//     const handleSaveAndClose = async (): Promise<boolean> => {
//         const r = await handleSave();
//         props.onClose();
//         return r;
//     };
//
//     return <>
//         <Markdown3Editor
//             onChange={(v) => setValue(v)}
//             value={value}
//             nominalHeight={300}
//             showActionButtons={true}
//             hasEdits={hasEdits}
//             handleCancel={props.onClose}
//             handleSave={handleSave}
//             handleSaveAndClose={handleSaveAndClose}
//         />
//     </>;
// };
//
// interface LocalizedMarkdownProps {
//     setting: LocalizedMarkdownKey;
//     fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString"; // default is "null".
//
//     // undefined means no fallback will be applied.
//     fallbackMarkdown?: string | null;
// };
//
// // Legacy; settings are being migrated to localized strings.
// export const LocalizedMarkdown = (props: LocalizedMarkdownProps) => {
//     const [editing, setEditing] = React.useState<boolean>(false);
//     const dashboardContext = useDashboardContext();
//     const showAdminControls = dashboardContext.isShowingAdminControls;
//
//     const editable = dashboardContext.isAuthorized(Permission.sysadmin) && showAdminControls;
//
//     const l = useLocale();
//
//     let initialValue: string | null = l.getMarkdownString(props.setting);
//
//     //let [initialValue, { refetch }] = useQuery(getSetting, { name: props.setting }, gQueryOptions.default);
//
//     const fallbackWhen = props.fallbackWhen || "null";
//     const fallbackMarkdown = props.fallbackMarkdown;
//     if (fallbackMarkdown !== undefined) {
//         if (fallbackWhen === "null") {
//             if (initialValue === null) {
//                 initialValue = fallbackMarkdown || null;
//             }
//         } else if (fallbackWhen === "emptyString") {
//             if (initialValue && initialValue.trim() === "") {
//                 initialValue = fallbackMarkdown || null;
//             }
//         } else if (fallbackWhen === "nullOrEmptyString") {
//             if (initialValue === null || (initialValue && initialValue.trim() === "")) {
//                 initialValue = fallbackMarkdown || null;
//             }
//         }
//     }
//
//     return <div className={`settingMarkdownContainer ${editable && "editable"}`}>
//         {editable && !editing && <CMSmallButton variant="framed" onClick={() => setEditing(true)}>Edit {props.setting}</CMSmallButton>}
//         {editing ? <SettingMarkdownEditor
//             onClose={() => setEditing(false)}
//             setting={props.setting}
//             initialValue={initialValue || ""}
//             refetch={l.refetch}
//         /> : <Markdown markdown={initialValue} />}
//     </div>;
// };
//
//
//
//
//
//
//
// MIGRATION_REFERENCE_END
