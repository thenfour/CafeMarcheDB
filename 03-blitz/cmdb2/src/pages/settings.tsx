import { BlitzPage } from "@blitzjs/next";
import { useMutation, usePaginatedQuery } from "@blitzjs/rpc";
import { Button } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import updateBulkSettings from "src/auth/mutations/updateBulkSettings";
import getPaginatedSettings from "src/auth/queries/getPaginatedSettings";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Prisma } from "db";
import deleteSetting from "src/auth/mutations/deleteSetting";
import insertSetting from "src/auth/mutations/insertSetting";
import updateSettingById from "src/auth/mutations/updateSettingById";
import { CreateSettingSchema, SettingNameSchema, SettingValueSchema, UpdateSettingByIdSchema } from "src/auth/schemas";
import {
    CMTableSpec,
    PKIDField,
    SimpleTextField
} from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";

type DBSetting = Prisma.SettingGetPayload<{
    //includes?
}>;

export const SettingTableSpec = new CMTableSpec<DBSetting>({
    devName: "setting",
    CreateMutation: insertSetting,
    CreateSchema: CreateSettingSchema,
    GetPaginatedItemsQuery: getPaginatedSettings,
    UpdateMutation: updateSettingById,
    UpdateSchema: UpdateSettingByIdSchema,
    DeleteMutation: deleteSetting,
    GetNameOfRow: (row: DBSetting) => { return row.name; },
    // renderForListItemChild: ({ obj }) => {
    //     return <>an item?</>;
    // },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ label: "name", member: "name", initialNewItemValue: "", zodSchema: SettingNameSchema, cellWidth: 220 }),
        new SimpleTextField({ label: "value", member: "value", initialNewItemValue: "", zodSchema: SettingValueSchema, cellWidth: 550 }),
    ],
});






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

const SettingsContent = () => {
    return <>
        <SettingMarkdown settingName="settings_markdown"></SettingMarkdown>
        <SettingsControls></SettingsControls>
        <CMEditGrid2 spec={SettingTableSpec} />
    </>;
};

const SettingsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Settings">
            <SettingsContent />
            {/* <CMEditGrid spec={SettingsEditGridSpec} /> */}
        </DashboardLayout>
    )
}

export default SettingsPage;
