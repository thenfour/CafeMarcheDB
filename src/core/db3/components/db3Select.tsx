// todo: generic rendering (not all chip)

// for immediate & promise options fetching,
// <SingleSelect> + <SingleSelectDialog>
// <MultiSelect> + <MultiSelectDialog>
//
// for db3 query supported options fetching,
// <DB3SingleSelect> + <DB3SingleSelectDialog>
// <DB3MultiSelect> + <DB3MultiSelectDialog>
import React from "react";

import { CircularProgress } from "@mui/material";
import { CoalesceBool } from "shared/utils";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";
import { CMSelectDisplayStyle } from "src/core/components/select/CMSelect";
import { CMSelectNullBehavior } from "src/core/components/select/CMSingleSelectDialog";
import * as db3 from "src/core/db3/db3";
import { TAnyModel } from "../shared/apiTypes";
import { DB3MultiSelectDialog, DB3SingleSelectDialog, useDB3MultiSelectLogic, useDB3SingleSelectLogic } from "./db3SelectDialog";
import { StandardVariationSpec } from "../../components/color/palette";

type Tnull = undefined | null;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface Db3SingleSelectBaseProps<Toption extends TAnyModel> {
    schema: db3.xTable,

    value: Toption | Tnull;
    onChange: (optionIds: Toption | Tnull) => void;

    renderOption?: ((item: Toption) => React.ReactNode) | undefined;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    readonly?: boolean;
    displayStyle?: CMSelectDisplayStyle | undefined;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: Toption) => void);
};

interface Db3SingleSelectPropsNotAllowingNull<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    value: Toption;
    onChange: (option: Toption) => void;
}

interface Db3SingleSelectPropsAllowingNull<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    value: Toption | null;
    onChange: (option: Toption | null) => void;
}

interface Db3SingleSelectPropsAllowingUndefined<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    value: Toption | undefined;
    onChange: (option: Toption | undefined) => void;
}

type Db3SingleSelectProps<Toption extends TAnyModel> =
    | Db3SingleSelectPropsNotAllowingNull<Toption>
    | Db3SingleSelectPropsAllowingNull<Toption>
    | Db3SingleSelectPropsAllowingUndefined<Toption>;

// the other <SingleSelect> operates on immediate, or Promise options.
// Blitz queries require the use of a hook (useQuery), which can't be adapted to that usage.
// - adaptation is not possible because the hook must be called at the function level, while promises would be called from arbitrary locations.
// - hook is required because 1) that's just how blitz is designed, 2) makes sense for query caching etc.
// so here we will use the db3 query system via the hook
export const DB3SingleSelect = <Toption extends TAnyModel,>(props: Db3SingleSelectProps<Toption>) => {
    const displayStyle = props.displayStyle || CMSelectDisplayStyle.AllWithInlineEditing;
    const allowQuickFilter = CoalesceBool(props.allowQuickFilter, true);
    const nullBehavior = CoalesceBool(props.nullBehavior, CMSelectNullBehavior.NonNullable);

    const ssl = useDB3SingleSelectLogic(props, props.value, "", displayStyle === CMSelectDisplayStyle.SelectedWithDialog ? "selected" : "all");
    type TX = typeof ssl.allOptionsX[0];

    const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState(false);

    const editable = !props.readonly;
    const openDialog = () => (editable ? () => setSingleSelectDialogOpen(true) : undefined);
    const toggleSelect = (optionX: TX) => {
        if (!editable) return undefined;
        if (ssl.isSelected(optionX.info) && ssl.allowNull) {
            return () => props.onChange(ssl.nullValue as any);
        }
        return () => props.onChange(optionX.option);
    };

    const renderOption = (x: TX) => {
        if (props.renderOption) {
            return props.renderOption(x.option);
        }
        return x.info.name;
    };

    const renderChips = (chips: TX[],
        onClick: (optionX: TX) => (() => void) | undefined) => {
        return chips.map(optionx => (
            <CMChip
                key={optionx.info.pk}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={optionx.info.color}
                variation={{ ...StandardVariationSpec.Strong, selected: ssl.isSelected(optionx.info) }}
                onClick={onClick(optionx)}
            >
                {renderOption(optionx)}
            </CMChip>
        ));
    };

    const renderNull = (onClick: () => (() => void) | undefined) => {
        return <CMChip
            size={props.chipSize || "small"}
            shape={props.chipShape || "rectangle"}
            variation={{ ...StandardVariationSpec.Strong, selected: ssl.isNullSelected }}
            onClick={onClick()}
        >
            {"<null>"}
        </CMChip>
    };

    return (
        <div className="CMSingleSelect">
            {displayStyle === CMSelectDisplayStyle.CustomButtonWithDialog ? props.customRender!(() => setSingleSelectDialogOpen(true)) :
                <CMChipContainer>
                    {(displayStyle === CMSelectDisplayStyle.AllWithInlineEditing) && (
                        <>
                            {renderChips(ssl.allOptionsX, toggleSelect)}
                            {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                        </>
                    )}
                    {(displayStyle === CMSelectDisplayStyle.AllWithDialog) && (
                        <>
                            {renderChips(ssl.allOptionsX, openDialog)}
                        </>
                    )}
                    {(displayStyle === CMSelectDisplayStyle.SelectedWithDialog) && (
                        <>
                            {ssl.isNullSelected ? renderNull(openDialog) : renderChips([ssl.selectedOptionX!], openDialog)}
                        </>
                    )}
                    {ssl.isLoading && <CircularProgress size={16} />}

                </CMChipContainer>}
            {singleSelectDialogOpen && (
                <DB3SingleSelectDialog
                    nullBehavior={nullBehavior}
                    schema={props.schema}
                    renderOption={props.renderOption}
                    onCancel={() => setSingleSelectDialogOpen(false)}
                    onOK={(option) => {
                        props.onChange(option);
                        setSingleSelectDialogOpen(false);
                    }}
                    value={props.value}
                    title={props.dialogTitle || "Select"}
                    description={props.dialogDescription || ""}

                    allowQuickFilter={allowQuickFilter}
                    allowInsertFromString={props.allowInsertFromString}
                    onInsert={(obj: Toption) => {
                        ssl.queryStatus.refetch();
                        props.onInsert && props.onInsert(obj);
                    }}
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

    value: Toption[];
    onChange: (optionIds: Toption[]) => void;
    renderOption?: ((item: Toption) => React.ReactNode) | undefined;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    readonly?: boolean;
    displayStyle?: CMSelectDisplayStyle | undefined;

    editButtonChildren?: React.ReactNode | undefined;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: Toption) => void);
};


export const DB3MultiSelect = <Toption extends TAnyModel,>(props: DB3MultiSelectProps<Toption>) => {
    const displayStyle = props.displayStyle || CMSelectDisplayStyle.AllWithInlineEditing;
    const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState(false);
    const editButtonChildren = props.editButtonChildren || "Select";

    const msl = useDB3MultiSelectLogic(props, props.value, "", displayStyle === CMSelectDisplayStyle.SelectedWithDialog ? "selected" : "all");
    type TX = typeof msl.allOptionsX[0];

    const renderOption = (x: TX) => {
        if (props.renderOption) {
            return props.renderOption(x.option);
        }
        return x.info.name;
    };

    const selectedIndicator = displayStyle !== CMSelectDisplayStyle.SelectedWithDialog;

    const renderChips = (optionsX: TX[]) => optionsX.map(optionX => {
        let clickHandler: any = undefined;
        if (!props.readonly) {
            if (displayStyle === CMSelectDisplayStyle.AllWithInlineEditing) {
                clickHandler = () => props.onChange(msl.toggleSelection(optionX));
            } else {
                clickHandler = () => setMultiEditDialogOpen(true);
            }
        }

        // only display the selection border if we're displaying ALL

        return <CMChip
            key={optionX.info.pk}
            size={props.chipSize || "small"}
            shape={props.chipShape || "rectangle"}
            color={optionX.info.color}
            variation={{ ...StandardVariationSpec.Strong, selected: selectedIndicator && msl.isSelected(optionX.info) }}
            onClick={clickHandler}
        >
            {renderOption(optionX)}
        </CMChip>
    });

    const handleDialog = () => setMultiEditDialogOpen(!multiEditDialogOpen);
    const noneSelected = msl.selectedOptionsX.length === 0;

    return (
        <div className="CMMultiSelect">
            {displayStyle === CMSelectDisplayStyle.CustomButtonWithDialog ? props.customRender!(handleDialog) :
                <CMChipContainer>

                    {displayStyle === CMSelectDisplayStyle.SelectedWithDialog && <>
                        {renderChips(msl.selectedOptionsX)}
                        {!props.readonly && noneSelected && <CMSmallButton onClick={handleDialog}>{editButtonChildren}</CMSmallButton>}
                    </>}
                    {displayStyle === CMSelectDisplayStyle.AllWithDialog && <>
                        {renderChips(msl.allOptionsX)}
                        {!props.readonly && <CMSmallButton onClick={handleDialog}>{editButtonChildren}</CMSmallButton>}
                    </>}
                    {displayStyle === CMSelectDisplayStyle.AllWithInlineEditing && <>
                        {renderChips(msl.allOptionsX)}
                        {!props.readonly && <CMSmallButton onClick={handleDialog}>{editButtonChildren}</CMSmallButton>}
                    </>}
                    {msl.isLoading && <CircularProgress size={16} />}
                </CMChipContainer>}
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

                    allowQuickFilter={props.allowQuickFilter}
                    allowInsertFromString={props.allowInsertFromString}
                    onInsert={(obj: Toption) => {
                        msl.queryStatus.refetch();
                        props.onInsert && props.onInsert(obj);
                    }}
                />
            )}
        </div>
    );
};
