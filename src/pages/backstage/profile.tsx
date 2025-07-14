import { BlitzPage } from "@blitzjs/next";
import { Typography } from "@mui/material";
import React, { Suspense } from "react";
import { Permission } from "shared/permissions";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { CMSmallButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { useDashboardContext, useFeatureRecorder, useRecordFeatureUse } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconMap";
import { DB3EditRowButton, DB3EditRowButtonAPI, DB3RowViewer } from "src/core/db3/components/db3NewObjectDialog";
import * as db3 from "src/core/db3/db3";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { TAnyModel } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { ProfilePageIdentityControl } from "@/src/core/components/user/UserIdentityIndicator";
import { StandardVariationSpec } from "@/src/core/components/color/palette";


type UserInstrumentsFieldInputProps = DB3Client.TagsFieldInputProps<db3.UserInstrumentPayload> & {
    refetch: () => void;
};

const UserInstrumentsFieldInput = (props: UserInstrumentsFieldInputProps) => {
    const dashboardContext = useDashboardContext();
    const updatePrimaryMutationToken = API.users.updateUserPrimaryInstrument.useToken();
    const currentUser = dashboardContext.currentUser;
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();

    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<db3.UserInstrumentPayload[]>([]);

    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const primary: (db3.InstrumentPayload | null) = API.users.getPrimaryInstrument(props.row as db3.UserPayload);

    const handleClickMakePrimary = (instrumentId: number) => {
        if (!currentUser) {
            return null;
        }
        void recordFeature({
            feature: ActivityFeature.profile_change_default_instrument,
        });
        updatePrimaryMutationToken.invoke({ userId: currentUser.id, instrumentId }).then(e => {
            showSnackbar({ severity: "success", children: "Primary instrument updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating primary instrument" });
        }).finally(async () => {
            props.refetch();
            dashboardContext.refetchDashboardData();
        });
    };

    return <div className={"instrumentListVertical"}>
        {props.value.map(value => (
            <div className="instrumentAndPrimaryContainer" key={value[props.spec.associationForeignIDMember]}>
                {props.spec.renderAsChipForCell!({
                    value,
                    colorVariant: { ...StandardVariationSpec.Strong, selected: (value.instrumentId === primary?.id) },
                    onDelete: () => {
                        const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                        props.onChange(newValue);
                    }
                })}
                {
                    (props.value.length > 1) && (
                        (value.instrumentId === primary?.id) ? (
                            <>
                                This is your default instrument
                            </>
                        ) : (
                            <CMSmallButton onClick={() => handleClickMakePrimary(value.instrumentId)}>make default</CMSmallButton>
                        ))
                }
            </div>
        ))}

        <CMSmallButton onClick={() => { setIsOpen(!isOpen) }}>Select instruments...</CMSmallButton>
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
    </div>;
};



// given a userid, this is a standalone field for editing their instrument list.
// i would love to debounce this field like the others but that would cause problems:
// - the GUI will be gross. either useless or noisy, either way disruptive or error-prone.
// - the debounce API uses useEffect() and when i'm dealing with arrays or association objects no way.
// - others i forgot already.
const OwnInstrumentsControl = () => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = useDashboardContext();
    const currentUser = dashboardContext.currentUser;
    if (!currentUser) {
        return null;
    }
    const recordFeature = useFeatureRecorder();
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
                userId: currentUser.id,
            }
        },
    });

    const row = tableClient.items[0]!;

    return <UserInstrumentsFieldInput
        spec={tableClient.getColumn("instruments") as any}
        selectStyle="dialog"
        //validationError={validationResult.getErrorForField("instruments")}
        row={row}
        value={row.instruments}
        refetch={tableClient.refetch}
        onChange={(value: db3.UserInstrumentPayload[]) => {
            void recordFeature({
                feature: ActivityFeature.profile_change_instrument,
            });
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
                dashboardContext.refetchDashboardData();
            });
        }}
    />;

};


const MainContent = () => {
    const dashboardContext = useDashboardContext();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();

    useRecordFeatureUse({
        feature: ActivityFeature.profile_view,
    });

    const spec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });

    const client = DB3Client.useTableRenderContext({
        tableSpec: spec,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        filterModel: {
            items: [{ field: "id", value: dashboardContext.currentUser?.id || -1, operator: "equals" }]
        },
        clientIntention: dashboardContext.userClientIntention,
    });

    const value = client.items[0]! as db3.UserPayload;

    const handleSave = (updateObj: TAnyModel, api: DB3EditRowButtonAPI) => {
        void recordFeature({
            feature: ActivityFeature.profile_edit,
        });
        client.doUpdateMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating" });
        }).finally(async () => {
            client.refetch();
            dashboardContext.refetchDashboardData();
            api.closeDialog();
        });
    };

    return <>
        <SettingMarkdown setting="profile_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard>
            <div className="content yourProfile">
                <Typography gutterBottom variant="h4" component="div">
                    {gIconMap.Person()} Your profile
                </Typography>

                <SettingMarkdown setting="profile_description_markdown" />

                <NameValuePair isReadOnly={false} name="Your instruments" value={<OwnInstrumentsControl />} />

                {client.items.length === 1 && (
                    <>
                        <DB3EditRowButton row={client.items[0]!} tableRenderClient={client} onSave={handleSave} label={"Edit your profile"} />
                        <DB3RowViewer tableRenderClient={client} row={client.items[0]!} />
                    </>
                )}

                <Suspense>
                    {dashboardContext.currentUser?.id && <ProfilePageIdentityControl userId={dashboardContext.currentUser.id} />}
                </Suspense>

            </div>
        </CMSinglePageSurfaceCard>
    </>;
};



const ProfilePage: BlitzPage = () => {
    return (
        <DashboardLayout title="Your profile" basePermission={Permission.basic_trust}>
            <AppContextMarker name="profile page">
                <MainContent />
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default ProfilePage;
