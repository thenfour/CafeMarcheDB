import { CMButton, CMButtonGroup } from "@/src/core/components/CMCoreComponents2";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import updateBulkSettings from "@/src/setting/server/mutations/updateBulkSettings";
import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import React from "react";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";


const SettingsControls = () => {
    const settings = DB3Client.useDb3Query({ view: db3.settingEditorView });

    const [updateBulkSettingsMutation] = useMutation(updateBulkSettings); // { name, value }

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onCopy = async () => {
        const rows = settings.items.map(({ name, value }) => ({ name, value }));
        const txt = JSON.stringify(rows, null, 2);
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `Copied ${rows.length} settings to clipboard (${txt.length} characters)` });
    };

    const onPaste = async () => {
        try {
            console.log(`Logging old values as a last-resort backup...`);
            console.log(settings.items);
            const txt = await navigator.clipboard.readText();
            const obj = JSON.parse(txt);
            // obj should be an array of { name, value }
            if (!Array.isArray(obj)) {
                showSnackbar({ severity: "error", children: `Clipboard text is not an array` });
                return;
            }

            await updateBulkSettingsMutation(obj);
            showSnackbar({ severity: "success", children: `Updated ${obj.length} settings` });
            void settings.refetch();

        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: `Error while pasting; maybe invalid format?...` });
        }
    };

    return (
        <CMButtonGroup>
            <CMButton onClick={onCopy}>Copy to clipboard</CMButton>
            <CMButton onClick={onPaste}>Paste from clipboard</CMButton>
        </CMButtonGroup>
    );
}




const SettingsContent = () => {

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.settingEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),
            name: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.name", columnName, cellWidth: 200 }),
            value: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.value", columnName, cellWidth: 200 }),
        },
    });

    return <>
        <CMSinglePageSurfaceCard>
            <div className="content">
                <LocalizedMarkdown setting="settings_markdown"></LocalizedMarkdown>
                <SettingsControls></SettingsControls>
                <DB3EditGrid tableSpec={tableSpec} view={db3.settingEditorView} />
            </div>
        </CMSinglePageSurfaceCard>
    </>;
};

const SettingsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Settings">
            <SettingsContent />
        </DashboardLayout>
    )
}

export default SettingsPage;
