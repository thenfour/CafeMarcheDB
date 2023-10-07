import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { Button, CardContent, FormControl, FormHelperText, Input, InputLabel, Typography } from "@mui/material";
import { RenderMuiIcon, gIconMap } from "src/core/db3/components/IconSelectDialog";
import { ButtonSelectControl, ButtonSelectOption, MutationButtonSelectControl, MutationTextControl } from "src/core/components/CMTextField";
import { useMutation } from "@blitzjs/rpc";
import updateBasicProfileFields from "../api/user/mutations/updateBasicProfileFields";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { gIconOptions } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DebouncedControl } from "src/core/components/RichTextEditor";
import { useDebounce } from "shared/useDebounce";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import React from "react";
import { API, APIQueryResult } from 'src/core/db3/clientAPI';





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
                    colorVariant: "strong",
                    onDelete: () => {
                        const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                        props.onChange(newValue);
                    }
                })}
                {
                    (value.instrumentId === primary?.id) ? (
                        <>
                            {gIconMap.Check()} Primary
                        </>
                    ) : (
                        <Button onClick={() => handleClickMakePrimary(value.instrumentId)}>make primary</Button>
                    )
                }
            </div>
        ))}

        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.spec.schemaColumn.label}</Button>
        {isOpen && <DB3Client.DB3SelectTagsDialog
            row={props.row}
            value={props.value}
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
        onChange={(value: db3.xUserInstrument[]) => {
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
