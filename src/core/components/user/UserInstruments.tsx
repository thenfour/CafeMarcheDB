import { StandardVariationSpec } from "@/src/core/components/color/palette";
import { useDashboardContext, useFeatureRecorder } from "@/src/core/components/dashboardContext/DashboardContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { Box, Typography } from "@mui/material";
import React from "react";
import { SelectionEditButton } from "src/core/components/select/SelectionField";
import { SelectionPicker } from "src/core/components/select/SelectionPicker";
import { SelectionValueList } from "src/core/components/select/SelectionOptions";
import { makeLocalSelectionSource } from "src/core/components/select/selectionSource";
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import { CMChipContainer } from "../CMChip";
import { InstrumentChip } from "../CMCoreComponents";


type UserInstrumentsFieldInputProps = DB3Client.TagsFieldInputProps<db3.UserInstrumentPayload> & {
    refetch: () => void;
};

const UserInstrumentsFieldInput = (props: UserInstrumentsFieldInputProps) => {
    const dashboardContext = useDashboardContext();
    const { showMessage: showSnackbar } = useSnackbar();
    const recordFeature = useFeatureRecorder();

    const updatePrimaryMutationToken = API.users.updateUserPrimaryInstrument.useToken();
    const currentUser = dashboardContext.currentUser;

    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [isDefaultOpen, setIsDefaultOpen] = React.useState(false);

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

    const renderInstrument = (value: db3.UserInstrumentPayload) => //props.spec.renderAsChipForCell({ value, colorVariant: StandardVariationSpec.Strong });
        <InstrumentChip value={value.instrument} size="big" />;
    const primaryValue = props.value.find(value => value.instrumentId === primary?.id);

    const defaultChip = (<Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{
            //bgcolor: "action.hover",
            borderRadius: 0.5,
            px: 0.75,
            flexShrink: 0
        }}
    >
        Default
    </Typography>);

    return <Box sx={{ minWidth: 0, py: 0.5 }}>
        <SelectionValueList
            value={props.value}
            getKey={value => value.instrumentId}
            getLabel={props.spec.getSelectionLabel}
            renderValue={value => {
                const isPrimary = value.instrumentId === primary?.id;
                return <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minWidth: 0, maxWidth: "100%" }}>
                    {renderInstrument(value)}
                    {props.value.length > 1 && isPrimary && defaultChip}
                </Box>
            }}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
            }}
        >
        </SelectionValueList>

        <CMChipContainer style={{
            gap: "12px",
            marginTop: "12px",
        }}>
            <SelectionEditButton onClick={() => setIsOpen(true)} label="Edit your instruments">{props.value.length ? "Edit" : "Select instruments"}</SelectionEditButton>
            {props.value.length > 1 && <SelectionEditButton onClick={() => setIsDefaultOpen(true)} label="Change default instrument">Change default</SelectionEditButton>}
        </CMChipContainer>

        {isDefaultOpen && <SelectionPicker
            source={makeLocalSelectionSource({
                items: props.value,
                getKey: value => value.instrumentId,
                getLabel: props.spec.getSelectionLabel,
                renderValue: renderInstrument
            })}
            value={primaryValue ? [primaryValue] : []}
            title="Default instrument" description="When responding to events, this is the instrument that is selected by default."
            onCancel={() => setIsDefaultOpen(false)}
            onAccept={values => {
                setIsDefaultOpen(false);
                if (values[0] && values[0].instrumentId !== primary?.id) handleClickMakePrimary(values[0].instrumentId);
            }}
        />}
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
    </Box>;
};



// given a userid, this is a standalone field for editing their instrument list.
// i would love to debounce this field like the others but that would cause problems:
// - the GUI will be gross. either useless or noisy, either way disruptive or error-prone.
// - the debounce API uses useEffect() and when i'm dealing with arrays or association objects no way.
// - others i forgot already.
export const OwnInstrumentsControl = () => {
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
