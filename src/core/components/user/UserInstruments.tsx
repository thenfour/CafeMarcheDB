import { useDashboardContext, useFeatureRecorder } from "@/src/core/components/dashboardContext/DashboardContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { Box, Typography } from "@mui/material";
import React from "react";
import { InstrumentPublicId } from "shared/publicId";
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


type UserEditorInstrumentAssociation = NonNullable<
    db3.ClientOf<typeof db3.userEditorView>["instruments"]
>[number];

type UserInstrumentsFieldInputProps = DB3Client.TagsFieldInputProps<UserEditorInstrumentAssociation> & {
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

    // this calls for something like,
    // db3.xUserInstrument.instrument.getForeignIdentity(value)
    const getInstrumentId = (value: UserEditorInstrumentAssociation): InstrumentPublicId => (
        db3.xInstrument.parseIdentity(props.spec.typedSchemaColumn.getForeignIdentity(value))
    );
    const primaryAssociation = props.value.find(value => value.isPrimary) ?? props.value[0];

    const primaryInstrumentId = primaryAssociation == null
        ? undefined
        : getInstrumentId(primaryAssociation);

    const handleClickMakePrimary = (instrumentId: InstrumentPublicId) => {
        if (!currentUser) {
            return null;
        }
        void recordFeature({
            feature: ActivityFeature.profile_change_default_instrument,
        });
        updatePrimaryMutationToken.invoke({ instrumentId }).then(e => {
            showSnackbar({ severity: "success", children: "Primary instrument updated" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating primary instrument" });
        }).finally(async () => {
            props.refetch();
            dashboardContext.refetchDashboardData();
        });
    };

    const renderInstrument = (value: UserEditorInstrumentAssociation) => (
        <InstrumentChip value={getInstrumentId(value)} size="big" />
    );
    const primaryValue = props.value.find(value => getInstrumentId(value) === primaryInstrumentId);

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
            getKey={getInstrumentId}
            getLabel={props.spec.getSelectionLabel}
            renderValue={value => {
                const isPrimary = getInstrumentId(value) === primaryInstrumentId;
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
                getKey: getInstrumentId,
                getLabel: props.spec.getSelectionLabel,
                renderValue: renderInstrument
            })}
            value={primaryValue ? [primaryValue] : []}
            title="Default instrument" description="When responding to events, this is the instrument that is selected by default."
            onCancel={() => setIsDefaultOpen(false)}
            onAccept={values => {
                setIsDefaultOpen(false);
                const selectedValue = values[0];
                if (selectedValue != null) {
                    const selectedInstrumentId = getInstrumentId(selectedValue);
                    if (selectedInstrumentId !== primaryInstrumentId) {
                        handleClickMakePrimary(selectedInstrumentId);
                    }
                }
            }}
        />}
        {isOpen && <DB3Client.DB3SelectTagsDialog
            row={props.row}
            initialValue={props.value}
            spec={props.spec}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(newValue: UserEditorInstrumentAssociation[]) => {
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
    const tableClient = DB3Client.useCrudTableRenderContext({
        view: db3.userEditorView,
        tableSpec: DB3Client.defineTableClientSpec({
            view: db3.userEditorView,
            columns: {
                publicId: DB3Client.publicIdFieldGen(),
                instruments: columnName => new DB3Client.TagsFieldClient<UserEditorInstrumentAssociation>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            },
        }),
        filterModel: {
            tableParams: {
                userId: currentUser.publicId,
            }
        },
    });
    const editCommands = DB3Client.useCrudViewCommands({
        view: db3.userEditorView,
        tableClient,
    });

    const row = tableClient.items[0];
    if (!row?.instruments) {
        return null;
    }
    const instrumentsColumn = tableClient.getColumn("instruments");
    if (!(instrumentsColumn instanceof DB3Client.TagsFieldClient)) {
        throw new Error("Expected User.instruments to use a tags-field client.");
    }

    return <UserInstrumentsFieldInput
        spec={instrumentsColumn}
        selectStyle="dialog"
        //validationError={validationResult.getErrorForField("instruments")}
        row={row}
        value={row.instruments}
        refetch={tableClient.refetch}
        onChange={(value: UserEditorInstrumentAssociation[]) => {
            void recordFeature({
                feature: ActivityFeature.profile_change_instrument,
            });
            const updateObj = {
                ...row,
                instruments: value,
            };
            editCommands.update(updateObj, row).then(() => {
                showSnackbar({ severity: "success", children: "Instruments updated" });
            }).catch(e => {
                console.log(e);
                showSnackbar({ severity: "error", children: "error updating instruments" });
            }).finally(async () => {
                dashboardContext.refetchDashboardData();
            });
        }}
    />;

};
