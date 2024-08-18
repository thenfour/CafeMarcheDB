// TODO: find a way to clean up / unify somehow all of these different selection dialogs.
// - ChooseItemDialog
// - ChoiceEditCell
// - TagsFieldInput
// - ChipSelector
// - DB3SelectTagsDialog
// - ForeignSingleFieldInput

// - CMSelect

// This component attempts to be a low-dependency (e.g. no DB3 stuff or assumptions that options are sync / async),
// but usable select component with all the options CMDB typically wants, like
// - option to see the options inline (radio), or in a dialog
// - flexible item rendering
// - type to filter (and option to create if not exists)

// options are not paged, but that would be a natural next step

// CMMultiSelectDialog
// CMSingleSelectDialog

import React from "react";

import { CircularProgress } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CMSmallButton } from "./CMCoreComponents2";
import { CMMultiSelectDialog } from "./CMMultiSelectDialog";
import { CMSingleSelectDialog } from "./CMSingleSelectDialog";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMChip";

// ID type
type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};

export enum CMSelectEditStyle {
    dialog = "dialog",
    inlineWithDialog = "inlineWithDialog",
    // another possibility would be inline-autocomplete vs. inline-dialog
};

export enum CMSelectValueDisplayStyle {
    all = "all",
    selected = "selected",
};

/////////////////////////////////////////////////////////////////////////////////////////////
// "dialog" style shows the selected options, and a button to open a dialog
// "inline" style shows all options, with selected ones indicated
interface CMMultiSelectProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Promise<Toption[]> | Toption[];
    value: Toption[];
    onChange: (optionIds: Toption[]) => void;
    getOptionInfo: (item: Toption) => ItemInfo;
    getOptionById: (id: Tid) => Toption | Promise<Toption>;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: CMSelectValueDisplayStyle;
    editStyle?: CMSelectEditStyle; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: Toption, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<Toption>; // similar
};


export const CMMultiSelect = <Toption,>(props: CMMultiSelectProps<Toption>) => {
    const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState(false);
    const [allOptions, setAllOptions] = React.useState<{
        option: Toption;
        info: ItemInfo;
        id: Tid;
        selected: boolean;
    }[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = await Promise.resolve(props.getOptions({ quickFilter: undefined }));
                const newOptions = options.map(option => ({
                    option,
                    info: props.getOptionInfo(option),
                    id: props.getOptionInfo(option).id,
                    selected: props.value.some(val => props.getOptionInfo(val).id === props.getOptionInfo(option).id)
                }));
                setAllOptions(newOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };
        void fetchOptions();
    }, [props.getOptions, props.value, props.getOptionInfo]);

    const toggleSelection = (option: typeof allOptions[0], isSelected: boolean) => {
        if (isSelected) {
            props.onChange([...props.value, option.option]);
        } else {
            props.onChange(props.value.filter(val => props.getOptionInfo(val).id !== option.id));
        }
    };

    const renderChips = () => allOptions.map(option => (
        <CMChip
            key={option.id}
            size={props.chipSize || "small"}
            shape={props.chipShape || "rectangle"}
            color={option.info.color}
            variation={{ ...StandardVariationSpec.Strong, selected: option.selected }}
            onClick={!props.readonly ? () => toggleSelection(option, !option.selected) : undefined}
        >
            {props.renderOption(option.option)}
        </CMChip>
    ));

    const renderSelectedChips = () => props.value.map(val => {
        const info = props.getOptionInfo(val);
        return (
            <CMChip
                key={info.id}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={info.color}
                onDelete={!props.readonly ? () => toggleSelection({ option: val, info, id: info.id, selected: true }, false) : undefined}
            >
                {props.renderOption(val)}
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
                {isLoading && <CircularProgress size={16} />}
            </CMChipContainer>
            {multiEditDialogOpen && (
                <CMMultiSelectDialog
                    renderOption={props.renderOption}
                    onCancel={handleDialog}
                    onOK={options => {
                        props.onChange(options);
                        handleDialog();
                    }}
                    initialValues={props.value}
                    getOptions={props.getOptions}
                    getOptionById={props.getOptionById}
                    getOptionInfo={props.getOptionInfo}
                    title={props.dialogTitle || "Select"}
                    description={props.dialogDescription || ""}

                    allowQuickFilter={props.allowQuickFilter}
                    allowInsertFromString={props.allowInsertFromString}
                    doesItemExactlyMatchText={props.doesItemExactlyMatchText}
                    doInsertFromString={props.doInsertFromString}
                />
            )}
        </div>
    );
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CMSingleSelectProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Promise<Toption[]> | Toption[];
    value: Toption;
    onChange: (optionIds: Toption) => void;
    getOptionInfo: (item: Toption) => ItemInfo;
    getOptionById: (id: Tid) => Toption | Promise<Toption>;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: CMSelectValueDisplayStyle;
    editStyle?: CMSelectEditStyle; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: Toption, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<Toption>; // similar
};



export const CMSingleSelect = <Toption,>(props: CMSingleSelectProps<Toption>) => {
    type TX = {
        option: Toption;
        info: ItemInfo;
        selected: boolean;
    };

    const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState(false);
    const [allOptions, setAllOptions] = React.useState<TX[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = await (props.getOptions({ quickFilter: undefined }) instanceof Promise
                    ? props.getOptions({ quickFilter: undefined })
                    : Promise.resolve(props.getOptions({ quickFilter: undefined })));
                const processedOptions = options.map(option => ({
                    option,
                    info: props.getOptionInfo(option),
                    //id: 
                    selected: props.getOptionInfo(props.value).id === props.getOptionInfo(option).id
                }));
                setAllOptions(processedOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchOptions();
    }, [props.getOptions, props.value, props.getOptionInfo]);

    const renderChips = () => {
        //const condition = props.valueDisplayStyle === CMSelectValueDisplayStyle.all || !props.readonly;
        return allOptions.map(option => (
            <CMChip
                key={option.info.id}
                size={props.chipSize || "small"}
                shape={props.chipShape || "rectangle"}
                color={option.info.color}
                variation={{ ...StandardVariationSpec.Strong, selected: option.selected }}
                onClick={!props.readonly ? () => props.onChange(option.option) : undefined}
            >
                {props.renderOption(option.option)}
            </CMChip>
        ));
    };

    const renderSelectedChip = () => {
        const valueInfo = props.getOptionInfo(props.value);
        return (
            <CMChip
                key={valueInfo.id}
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
                {isLoading && <CircularProgress size={16} />}
            </CMChipContainer>
            {singleSelectDialogOpen && (
                <CMSingleSelectDialog
                    renderOption={props.renderOption}
                    onCancel={() => setSingleSelectDialogOpen(false)}
                    onOK={option => {
                        props.onChange(option);
                        setSingleSelectDialogOpen(false);
                    }}
                    value={props.value}
                    getOptions={props.getOptions}
                    getOptionById={props.getOptionById}
                    getOptionInfo={props.getOptionInfo}
                    title={props.dialogTitle || "Select"}
                    description={props.dialogDescription || ""}

                    allowQuickFilter={props.allowQuickFilter}
                    allowInsertFromString={props.allowInsertFromString}
                    doesItemExactlyMatchText={props.doesItemExactlyMatchText}
                    doInsertFromString={props.doInsertFromString}
                />
            )}
        </div>
    );
};





export const StringArrayOptionsProvider = <T extends (number | string),>(x: T[]) => ({
    getOptions: () => x,
    getOptionById: id => id as T,
    getOptionInfo: (option: T) => ({ id: option as T }),
    renderOption: (option: T): React.ReactNode => option,
});
