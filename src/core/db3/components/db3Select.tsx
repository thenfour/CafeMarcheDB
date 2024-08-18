// for immediate & promise options fetching,
// <SingleSelect> + <SingleSelectDialog>
// <MultiSelect> + <MultiSelectDialog>
//
// for db3 query supported options fetching,
// <DB3SingleSelect> + <DB3SingleSelectDialog>
// <DB3MultiSelect> + <DB3MultiSelectDialog>
import React from "react";

import { StandardVariationSpec } from "shared/color";
import { CircularProgress } from "@mui/material";
import * as db3 from "src/core/db3/db3";
import { useDashboardContext } from "src/core/components/DashboardContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMSelectEditStyle, CMSelectValueDisplayStyle } from "src/core/components/CMSelect";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";
import { TAnyModel } from "../shared/apiTypes";
import { DB3MultiSelectDialog, DB3SingleSelectDialog } from "./db3SelectDialog";



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface Db3SingleSelectProps<Toption extends (TAnyModel | null | undefined)> {
    schema: db3.xTable,

    value: Toption;
    onChange: (optionIds: Toption) => void;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: CMSelectValueDisplayStyle;
    editStyle?: CMSelectEditStyle; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;
};


// the other <SingleSelect> operates on immediate, or Promise options.
// Blitz queries require the use of a hook (useQuery), which can't be adapted to that usage.
// - adaptation is not possible because the hook must be called at the function level, while promises would be called from arbitrary locations.
// - hook is required because 1) that's just how blitz is designed, 2) makes sense for query caching etc.
// so here we will use the db3 query system via the hook
export const DB3SingleSelect = <Toption extends (TAnyModel | null | undefined),>(props: Db3SingleSelectProps<Toption>) => {
    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;
    const ctx = useDashboardContext();

    const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState(false);
    const hasSelection = !!props.value;
    const selectedInfo = hasSelection ? props.schema.getRowInfo(props.value!) : undefined;

    //                  hasselection  noselection
    // view all         all             all
    // view selected    selected         none
    const q = DB3Client.fetchUnsuspended<Toption>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        filterModel: valueDisplayStyle === CMSelectValueDisplayStyle.all ? undefined : {
            items: [],
            pks: hasSelection ? [selectedInfo!.pk] : undefined,
        },
        delayMS: 500,
    });

    const renderChips = () => {
        return q.items.map(option => {
            if (!option) {
                return <>(none)</>;
            }
            const valueInfo = props.schema.getRowInfo(option);
            return <CMChip
                key={valueInfo.pk}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={valueInfo.color}
                variation={{ ...StandardVariationSpec.Strong, selected: valueInfo.pk === selectedInfo?.pk }}
                onClick={!props.readonly ? () => props.onChange(option) : undefined}
            >
                {props.renderOption(option)}
            </CMChip>
        });
    };

    const renderSelectedChip = () => {
        if (!props.value) {
            return "<none>";
        }
        const valueInfo = props.schema.getRowInfo(props.value);
        return (
            <CMChip
                key={valueInfo.pk}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={valueInfo.color}
            >
                {props.renderOption(props.value)}
            </CMChip>
        );
    };

    return (
        <div className="CMSingleSelect">
            <CMChipContainer>
                {(valueDisplayStyle === CMSelectValueDisplayStyle.all && editStyle === CMSelectEditStyle.inlineWithDialog) && (
                    <>
                        {renderChips()}
                        {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                    </>
                )}
                {(valueDisplayStyle === CMSelectValueDisplayStyle.selected && editStyle === CMSelectEditStyle.inlineWithDialog) && (
                    <>
                        {renderSelectedChip()}
                        {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                    </>
                )}
                {q.queryResult?.isLoading && <CircularProgress size={16} />}
            </CMChipContainer>
            {singleSelectDialogOpen && (
                <DB3SingleSelectDialog
                    schema={props.schema}
                    renderOption={props.renderOption}
                    onCancel={() => setSingleSelectDialogOpen(false)}
                    onOK={option => {
                        props.onChange(option);
                        setSingleSelectDialogOpen(false);
                    }}
                    value={props.value}
                    title={props.dialogTitle || "Select"}
                    description={props.dialogDescription || ""}
                />
            )}
        </div>
    );
};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// "dialog" style shows the selected options, and a button to open a dialog
// "inline" style shows all options, with selected ones indicated
interface DB3MultiSelectProps<Toption extends TAnyModel> {
    schema: db3.xTable,

    //getOptions: (args: { quickFilter: string | undefined }) => Promise<Toption[]> | Toption[];
    value: Toption[];
    onChange: (optionIds: Toption[]) => void;
    // getOptionInfo: (item: Toption) => ItemInfo;
    // getOptionById: (id: Tid) => Toption | Promise<Toption>;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: CMSelectValueDisplayStyle;
    editStyle?: CMSelectEditStyle; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;
};


export const DB3MultiSelect = <Toption extends TAnyModel,>(props: DB3MultiSelectProps<Toption>) => {
    const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState(false);
    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;
    const ctx = useDashboardContext();

    const getPk = (o: Toption): number => o[props.schema.pkMember] as number;
    const selectedOptionIds = props.value.map(o => getPk(o));
    const isSelected = (x: Toption) => selectedOptionIds.includes(getPk(x));

    const toggleSelection = (option: Toption) => {
        if (isSelected(option)) {
            // remove it.
            const id = getPk(option);
            props.onChange(props.value.filter(selOpt => getPk(selOpt) !== id));
        } else {
            props.onChange([...props.value, option]);
        }
    };

    // view all         all         
    // view selected    selected    
    const q = DB3Client.fetchUnsuspended<Toption>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        filterModel: valueDisplayStyle === CMSelectValueDisplayStyle.all ? undefined : {
            items: [],
            pks: props.value.map(v => getPk(v)),
        },
        delayMS: 500,
    });

    const renderChips = () => q.items.map(option => {
        const info = props.schema.getRowInfo(option);
        return <CMChip
            key={info.pk}
            size={props.chipSize || "small"}
            shape={props.chipShape || "rectangle"}
            color={info.color}
            tooltip={info.tooltip}
            variation={{ ...StandardVariationSpec.Strong, selected: isSelected(option) }}
            onClick={!props.readonly ? () => toggleSelection(option) : undefined}
        >
            {props.renderOption(option)}
        </CMChip>
    });

    const renderSelectedChips = () => props.value.map(option => {
        const info = props.schema.getRowInfo(option);
        return (
            <CMChip
                key={info.pk}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={info.color}
                tooltip={info.tooltip}
                onDelete={!props.readonly ? () => toggleSelection(option) : undefined}
            >
                {props.renderOption(option)}
            </CMChip>
        );
    });

    const handleDialog = () => setMultiEditDialogOpen(!multiEditDialogOpen);

    return (
        <div className="CMMultiSelect">
            <CMChipContainer>
                {(valueDisplayStyle === CMSelectValueDisplayStyle.all) && renderChips()}
                {(valueDisplayStyle === CMSelectValueDisplayStyle.selected) && renderSelectedChips()}
                {!props.readonly && (
                    <CMSmallButton onClick={handleDialog}>
                        {editStyle === CMSelectEditStyle.dialog ? "Change..." : "+ Add"}
                    </CMSmallButton>
                )}
                {q.isLoading && <CircularProgress size={16} />}
            </CMChipContainer>
            {multiEditDialogOpen && (
                <DB3MultiSelectDialog
                    schema={props.schema}
                    renderOption={props.renderOption}
                    onCancel={handleDialog}
                    onOK={options => {
                        props.onChange(options);
                        handleDialog();
                    }}
                    initialValues={props.value}
                    title={props.dialogTitle || "Select"}
                    description={props.dialogDescription || ""}
                />
            )}
        </div>
    );
};

