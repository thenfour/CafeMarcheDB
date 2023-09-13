import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CardContent, FormControl, FormHelperText, Input, InputLabel, Typography } from "@mui/material";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { ButtonSelectControl, ButtonSelectOption, MutationButtonSelectControl, MutationTextControl } from "src/core/components/CMTextField";
import { useMutation, useQuery } from "@blitzjs/rpc";
import updateBasicProfileFields from "../api/user/mutations/updateBasicProfileFields";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { gIconOptions } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DebouncedControl } from "src/core/components/RichTextEditor";
import { useDebounce } from "shared/useDebounce";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import React from "react";






export const OwnProfileBasicFieldControl = (props: { member: string, label: string, helperText: string }) => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateBasicProfileFields);

    return currentUser && <div className="formFieldContainer">
        <div className="fieldLabel">{props.label}</div>
        <MutationTextControl
            initialValue={currentUser[props.member]}
            refetch={refetch}
            onChange={async (value) => {
                await theMutation({ userId: currentUser.id, [props.member]: value });
            }}
        />
        <FormHelperText>{props.helperText}</FormHelperText>
    </div>;
};

export const OwnActiveControl = () => {
    const [currentUser, { refetch }] = useCurrentUser();
    const [theMutation] = useMutation(updateBasicProfileFields);
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
    return <div className="formFieldContainer">
        <div className="fieldLabel">Active member?</div>
        <MutationButtonSelectControl
            refetch={refetch}
            options={options}
            initialValue={currentUser!.isActive}
            onChange={async (val) => {
                await theMutation({ userId: currentUser!.id, isActive: val });
            }}
        />
        <FormHelperText>Being an active member means being invited to events</FormHelperText>
    </div>;
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

                <FormControl>
                    <OwnProfileBasicFieldControl member="name" label="Name" helperText="Your full name" />
                    <OwnProfileBasicFieldControl member="compactName" label="Compact name" helperText="Shorter name (typically just your first name) that can be used in reduced-space page elements" />
                    <OwnProfileBasicFieldControl member="phone" label="Phone" helperText="Provide your phone number in case we need to reach you" />
                    <OwnProfileBasicFieldControl member="email" label="Email" helperText="" />
                    <OwnActiveControl />
                    <OwnInstrumentsControl />
                </FormControl>

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
