import { useAuthenticatedSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Button, FormHelperText, TextField, Typography } from "@mui/material";
import React from "react";
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/utils";
import { useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import changePassword from "src/auth/mutations/changePassword";
import * as schemas from "src/auth/schemas";
import { CMChip, CMSinglePageSurfaceCard, CMStandardDBChip, RowInfoChip } from "src/core/components/CMCoreComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { DB3EditObject2Dialog, DB3EditObjectDialog, DB3EditRowButton, DB3EditRowButtonAPI, DB3RowViewer } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { SafeParseReturnType } from "zod";

export const ResetOwnPasswordControl = () => {
    //const router = useRouter();
    //const token = router.query.token?.toString();
    const [changePasswordMutation, { isSuccess }] = useMutation(changePassword);
    //const [currentPassword, setCurrentPassword] = React.useState<string>("");
    const [newPassword, setNewPassword] = React.useState<string>("");
    const [newPasswordConfirmation, setNewPasswordConfirmation] = React.useState<string>("");

    const [newPasswordValidationResult, setNewPasswordValidationResult] = React.useState<SafeParseReturnType<string, string> | null>(null);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onSubmit = () => {
        changePasswordMutation({ currentPassword: "unused", newPassword }).then(() => {
            showSnackbar({ severity: "success", children: "password updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating password" });
        });
    };

    const handleChange = () => {
        const r = schemas.password.safeParse(newPassword);
        console.log(r);
        setNewPasswordValidationResult(r);
    }

    return <div className="resetPasswordControlContainer formFieldContainer">
        <div className="title">Change your password</div>
        {/* <TextField
            className="passwordField currentPassword"
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(v) => setCurrentPassword(v.target.value)}
        /> */}
        <TextField
            label="New Password"
            className="passwordField newPassword"
            type="password"
            error={!newPasswordValidationResult?.success}
            helperText={(newPasswordValidationResult?.success === false) && newPasswordValidationResult.error.flatten().formErrors.toLocaleString()}
            size="small"
            margin="dense"
            value={newPassword}
            onChange={(v) => { setNewPassword(v.target.value); handleChange() }}
        />
        <TextField
            label="Confirm new password"
            className="passwordField newPasswordConfirmation"
            type="password"
            size="small"
            margin="dense"
            error={newPassword !== newPasswordConfirmation}
            value={newPasswordConfirmation}
            onChange={(v) => { setNewPasswordConfirmation(v.target.value); handleChange() }}
        />
        <Button onClick={onSubmit}>Submit</Button>
    </div>;
};

export type UserInstrumentsFieldInputProps = DB3Client.TagsFieldInputProps<db3.UserInstrumentPayload> & {
    refetch: () => void;
};

export const UserInstrumentsFieldInput = (props: UserInstrumentsFieldInputProps) => {
    const updatePrimaryMutationToken = API.users.updateUserPrimaryInstrument.useToken();
    const [currentUser, { refetch }] = useCurrentUser();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<db3.UserInstrumentPayload[]>([]);

    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const primary: (db3.InstrumentPayload | null) = API.users.getPrimaryInstrument(props.row as db3.UserPayload);

    const handleClickMakePrimary = (instrumentId: number) => {
        updatePrimaryMutationToken.invoke({ userId: currentUser!.id, instrumentId }).then(e => {
            showSnackbar({ severity: "success", children: "Primary instrument updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating primary instrument" });
        }).finally(async () => {
            props.refetch();
            await refetch();
        });
    };

    return <div className={props.validationError ? "instrumentListVertical validationError" : "instrumentListVertical validationSuccess"}>
        {props.value.map(value => (
            <div className="instrumentAndPrimaryContainer" key={value[props.spec.associationForeignIDMember]}>
                {props.spec.renderAsChipForCell!({
                    value,
                    colorVariant: StandardVariationSpec.Strong,
                    onDelete: () => {
                        const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                        props.onChange(newValue);
                    }
                })}
                {
                    (value.instrumentId === primary?.id) ? (
                        <>
                            {gIconMap.CheckCircleOutline()} Primary
                        </>
                    ) : (
                        <Button onClick={() => handleClickMakePrimary(value.instrumentId)}>make primary</Button>
                    )
                }
            </div>
        ))}

        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.spec.schemaColumn.member}</Button>
        {isOpen && <DB3Client.DB3SelectTagsDialog
            row={props.row}
            initialValue={props.value}
            spec={props.spec}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(newValue: db3.UserInstrumentPayload[]) => {
                props.onChange(newValue);
            }}
        />}
        {props.validationError && <FormHelperText>{props.validationError}</FormHelperText>}
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
                new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            ],
        }),
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: { intention: "user", mode: 'primary' },
        filterModel: {
            items: [],
            tableParams: {
                userId: currentUser!.id,
            }
        },
    });

    const row = tableClient.items[0]!;
    const validationResult = tableClient.schema.ValidateAndComputeDiff(row, row, "update");

    // can't use tableClient.getColumn("instruments").renderForNewDialog,
    // because it just lists instruments as tag-like-chips. we need the ability to select a primary instrument.

    return <UserInstrumentsFieldInput
        spec={tableClient.getColumn("instruments") as any}
        validationError={validationResult.getErrorForField("instruments")}
        row={row}
        value={row.instruments}
        refetch={tableClient.refetch}
        onChange={(value: db3.UserInstrumentPayload[]) => {
            const updateObj = {
                id: currentUser!.id,
                instruments: value,
            };
            tableClient.doUpdateMutation(updateObj).then(e => {
                showSnackbar({ severity: "success", children: "Instruments updated" });
            }).catch(e => {
                console.log(e);
                showSnackbar({ severity: "error", children: "error updating instruments" });
            }).finally(async () => {
                tableClient.refetch();
                await refetch();
            });
        }}
    />;

};


const MainContent = () => {

    const [currentUser, { refetch }] = useCurrentUser();
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicData = useAuthenticatedSession();

    useAuthorizationOrThrow(`user profile page`, Permission.basic_trust);

    const spec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            //new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 200 }),
            //new DB3Client.BoolColumnClient({ columnName: "isSysAdmin" }),
            //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            //new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "role", cellWidth: 180, clientIntention }),
        ],
    });

    const client = DB3Client.useTableRenderContext({
        tableSpec: spec,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        filterModel: {
            items: [{ field: "id", value: currentUser!.id, operator: "equals" }]
        },
        clientIntention,
    });

    const value = client.items[0]! as db3.UserPayload;


    const handleSave = (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
        client.doUpdateMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating" });
        }).finally(async () => {
            client.refetch();
            await refetch();
            api.closeDialog();
        });
    };

    // const handleSave = (updateObj: db3.UserMinimumPayload, client: DB3Client.xTableRenderClient) => {
    //     client.doUpdateMutation(updateObj).then(e => {
    //         showSnackbar({ severity: "success", children: "updated" });
    //     }).catch(e => {
    //         console.log(e);
    //         showSnackbar({ severity: "error", children: "error updating" });
    //     }).finally(async () => {
    //         client.refetch();
    //         await refetch();
    //         //api.closeDialog();
    //     });
    // };



    return <>
        <SettingMarkdown settingName="profile_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard>
            <div className="content">
                <Typography gutterBottom variant="h4" component="div">
                    {gIconMap.Person()} Your profile
                </Typography>

                <OwnInstrumentsControl />

                {client.items.length === 1 && (
                    <>
                        <DB3EditRowButton row={client.items[0]!} tableRenderClient={client} onSave={handleSave} />
                        {/* <DB3EditObjectDialog table={spec} clientIntention={clientIntention} initialValue={client.items[0]!} onOK={handleOk} onCancel={() => { }} /> */}
                        <DB3RowViewer tableRenderClient={client} row={client.items[0]!} />
                    </>
                )}

                <ResetOwnPasswordControl />

                <div className="permissionSummary">
                    {DB3Client.RenderBasicNameValuePair({
                        name: "role",
                        value: <RowInfoChip item={value.role} tableSpec={db3.xRole} />,
                    })}

                    {DB3Client.RenderBasicNameValuePair({
                        name: "permissions",
                        value: value.role?.permissions.map(p => <CMChip>{p.permissionId}</CMChip>),
                    })}

                    {DB3Client.RenderBasicNameValuePair({
                        name: "publicData permissions",
                        value: publicData.permissions.map(p => <CMChip>{p}</CMChip>),
                    })}

                </div>

            </div>
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
