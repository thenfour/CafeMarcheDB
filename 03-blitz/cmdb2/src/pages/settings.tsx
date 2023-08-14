import { BlitzPage } from "@blitzjs/next";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import updateBulkSettings from "src/auth/mutations/updateBulkSettings";
import getPaginatedSettings from "src/auth/queries/getPaginatedSettings";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const SettingsControls = (props) => {
    if (!useAuthorization("settings page", Permission.admin_settings)) {
        throw new Error(`unauthorized`);
    }

    const [{ items, count }, { refetch }] = usePaginatedQuery(getPaginatedSettings, {
        orderBy: {},
        where: {},
        skip: 0,
        take: 1000,
    });

    const [updateBulkSettingsMutation] = useMutation(updateBulkSettings); // { name, value }

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onCopy = async () => {
        const txt = JSON.stringify(items);
        console.log(items);
        navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `Copied ${items.length} settings to clipboard (${txt.length} characters)` });
    };

    const onPaste = async () => {
        try {
            console.log(`Logging old values as a last-resort backup...`);
            console.log(items);
            const txt = await navigator.clipboard.readText();
            const obj = JSON.parse(txt);
            // obj should be an array of { name, value }
            if (!Array.isArray(obj)) {
                showSnackbar({ severity: "error", children: `Clipboard text is not an array` });
                return;
            }

            await updateBulkSettingsMutation(obj);
            showSnackbar({ severity: "success", children: `Updated ${items.length} settings` });
            refetch();

        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: `Error while pasting; maybe invalid format?...` });
        }
    };

    return (
        <>
            <Button onClick={onCopy}>Copy to clipboard</Button>
            <Button onClick={onPaste}>Paste from clipboard</Button>
        </>
    );
}



const tableSpec = new DB3Client.xTableClientSpec({
    table: db3.xSetting,
    columns: [
        new DB3Client.PKColumnClient({ columnName: "id" }),
        new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
        new DB3Client.GenericStringColumnClient({ columnName: "value", cellWidth: 200 }),
    ],
});


const SettingsContent = () => {
    return <>
        <SettingMarkdown settingName="settings_markdown"></SettingMarkdown>
        <SettingsControls></SettingsControls>
        <DB3EditGrid tableSpec={tableSpec} />
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
