import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CardContent, Typography } from "@mui/material";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { ButtonSelectControl, ButtonSelectOption, MutationButtonSelectControl, MutationTextControl } from "src/core/components/CMTextField";
import { useMutation, useQuery } from "@blitzjs/rpc";
import updateName from "../api/user/mutations/updateName";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { gIconOptions } from "shared/utils";
import updateActive from "../api/user/mutations/updateActive";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DebouncedControl } from "src/core/components/RichTextEditor";
import { useDebounce } from "shared/useDebounce";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import React from "react";

export const OwnUserNameControl = () => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateName);

    return currentUser && <MutationTextControl
        initialValue={currentUser.name}
        refetch={refetch}
        onChange={async (value) => {
            await theMutation({ userId: currentUser.id, name: value || "" });
        }}
    />;
};


export const OwnActiveControl = () => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateActive);
    const options: ButtonSelectOption[] = [
        {
            value: false,
            label: "Not an active member",
            iconName: currentUser!.isActive ? undefined : gIconOptions.Check,
            color: "no",
        }, {
            value: true,
            label: "active member",
            iconName: !currentUser!.isActive ? undefined : gIconOptions.Check,
            color: "yes",
        }
    ];
    return <MutationButtonSelectControl
        refetch={refetch}
        options={options}
        initialValue={currentUser!.isActive}
        onChange={async (val) => {
            await theMutation({ userId: currentUser!.id, isActive: val });
        }}
    />;
};


// given a userid, this is a standalone field for editing their instrument list.
// i would love to debounce this field like the others but that would cause problems:
// - the GUI will be gross. either useless or noisy, either way disruptive or error-prone.
// - the debounce API uses useEffect() and when i'm dealing with arrays or association objects no way.
// - others i forgot already.
const OwnInstrumentsControl = () => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [currentUser, { refetch }] = useCurrentUser();
    const tableClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xUser,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
                new DB3Client.TagsFieldClient<db3.UserInstrumentModel>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            ],
        }),
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        tableParams: {
            userId: currentUser!.id,
        }
    });

    const row = tableClient.items[0]!;
    const validationResult = tableClient.schema.ValidateAndComputeDiff(row, row, "update");

    return tableClient.getColumn("instruments").renderForNewDialog!({
        key: row.id,
        row,
        value: tableClient.items[0]!.instruments,
        validationResult,
        api: {
            setFieldValues: (updatedFields) => {
                const updateObj = {
                    id: currentUser!.id,
                    ...updatedFields,
                };
                tableClient.doUpdateMutation(updateObj).then(e => {
                    showSnackbar({ severity: "success", children: "Instruments updated" });
                }).catch(e => {
                    console.log(e);
                    showSnackbar({ severity: "error", children: "error updating instruments" });
                });
            }
        }
    });
};


const MainContent = () => {
    return <>
        <SettingMarkdown settingName="profile_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard>
            <CardContent>
                <Typography gutterBottom variant="h4" component="div">
                    {gIconMap.Person()} Your profile
                </Typography>

                <OwnUserNameControl />
                <OwnActiveControl />
                <OwnInstrumentsControl />

            </CardContent>
        </CMSinglePageSurfaceCard>
    </>;
};



const ProfilePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Your profile">
            <MainContent />
        </DashboardLayout>
    )
}

export default ProfilePage;
