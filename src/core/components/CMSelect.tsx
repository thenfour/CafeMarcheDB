// TODO: find a way to clean up / unify somehow all of these different selection dialogs.
// - ChooseItemDialog
// - TagsFieldInput
// - ChipSelector
// - DB3SelectTagsDialog
// - CMSelect
// - ForeignSingleFieldInput

// This component attempts to be a low-dependency (e.g. no DB3 stuff or assumptions that options are sync / async),
// but usable select component with all the options CMDB typically wants, like
// - option to see the options inline (radio), or in a dialog
// - flexible item rendering
// - type to filter (and option to create if not exists)

// options are not paged, but that would be a natural next step

// CMMultiSelectDialog
// CMSingleSelectDialog

import React from "react";

import { StandardVariationSpec } from "shared/color";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMCoreComponents";
import { CMSmallButton } from "./CMCoreComponents2";
import { CMMultiSelectDialog } from "./CMMultiSelectDialog";
import { CMSingleSelectDialog } from "./CMSingleSelectDialog";
import { CircularProgress } from "@mui/material";

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
};

export const CMMultiSelect = <Toption,>(props: CMMultiSelectProps<Toption>) => {
    const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState<boolean>(false);
    const [allOptionsX, setAllOptionsX] = React.useState<{
        option: Toption;
        info: ItemInfo;
        id: Tid;
        selected: boolean;
    }[]>([]);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;
    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const chipSize = props.chipSize || "small";
    const chipShape = props.chipShape || "rectangle";
    const dialogTitle = props.dialogTitle || "Select";
    const dialogDescription = props.dialogDescription || "";

    type TX = {
        option: Toption,
        info: ItemInfo,
        id: Tid,
        selected: boolean,
    };

    const valuesX: TX[] = props.value.map(option => {
        const info = props.getOptionInfo(option);
        return {
            id: info.id,
            option,
            info,
            selected: true,
        };
    });

    const setSelected = (optionX: TX, selected: boolean) => {
        if (selected) {
            props.onChange([...props.value, optionX.option]);
        } else {
            props.onChange(props.value.filter(s => props.getOptionInfo(s).id !== optionX.id));
        }
    };

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = props.getOptions({ quickFilter: undefined });
                const resolvedOptions = options instanceof Promise ? await options : options;

                const allOptions = resolvedOptions.map(option => {
                    const info = props.getOptionInfo(option);
                    return {
                        id: info.id,
                        info,
                        option,
                        selected: props.value.some(x => props.getOptionInfo(x).id === info.id),
                    };
                });
                setAllOptionsX(allOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOptions();
    }, [props.getOptions, props.value, props.getOptionInfo]);

    return <div className={`CMMultiSelect`}>
        <CMChipContainer>
            {
                // ALL style: show all options and variation indicates selected.
                // INLINE-DIALOG edit style: clicking toggles selected; there's no other edit options. so ALL + INLINE is practical
                (valueDisplayStyle === CMSelectValueDisplayStyle.all) && (editStyle === CMSelectEditStyle.inlineWithDialog) && <>{allOptionsX.map(optionX => {
                    return <CMChip
                        key={optionX.id}
                        size={chipSize}
                        color={optionX.info.color}
                        shape={chipShape}
                        variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                        onClick={props.readonly ? undefined : (() => setSelected(optionX, !optionX.selected))}
                    >
                        {props.renderOption(optionX.option)}
                    </CMChip>
                })}
                    {!props.readonly && <CMSmallButton onClick={() => setMultiEditDialogOpen(true)}>Select...</CMSmallButton>}
                </>
            }
            {
                // ALL style: show all options and variation indicates selected.
                // DIALOG edit style: just a button to edit in a dialog
                (valueDisplayStyle === CMSelectValueDisplayStyle.all) && (editStyle === CMSelectEditStyle.dialog) && <>
                    {allOptionsX.map(optionX => {
                        return <CMChip
                            key={optionX.id}
                            size={chipSize}
                            shape={chipShape}
                            color={optionX.info.color}
                            variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                        >
                            {props.renderOption(optionX.option)}
                        </CMChip>
                    })}
                    {!props.readonly && <CMSmallButton onClick={() => setMultiEditDialogOpen(true)}>Change...</CMSmallButton>}
                </>
            }
            {
                // SELECTED style: show only selected options.
                // INLINE-DIALOG edit style gives them delete buttons and a "+ add" option to select a single item
                (valueDisplayStyle === CMSelectValueDisplayStyle.selected) && (editStyle === CMSelectEditStyle.inlineWithDialog) && <>{valuesX.map(valueX => {
                    return <CMChip
                        key={valueX.info.id}
                        size={chipSize}
                        shape={chipShape}
                        color={valueX.info.color}
                        onDelete={props.readonly ? undefined : (() => setSelected(valueX, false))}
                    >
                        {props.renderOption(valueX.option)}
                    </CMChip>
                })}
                    {!props.readonly && <CMSmallButton onClick={() => setMultiEditDialogOpen(true)}>+ add</CMSmallButton>}
                </>
            }
            {
                // SELECTED style: show only selected options.
                // DIALOG edit style gives them delete buttons and a "+ add" option to select a single item
                (valueDisplayStyle === CMSelectValueDisplayStyle.selected) && (editStyle === CMSelectEditStyle.dialog) && <>{valuesX.map(valueX => {
                    return <CMChip
                        key={valueX.info.id}
                        size={chipSize}
                        shape={chipShape}
                        color={valueX.info.color}
                    >
                        {props.renderOption(valueX.option)}
                    </CMChip>
                })}
                    {!props.readonly && <CMSmallButton onClick={() => setMultiEditDialogOpen(true)}>Edit</CMSmallButton>}
                </>
            }
            {isLoading && <CircularProgress size={16} />}
        </CMChipContainer>
        {multiEditDialogOpen && <CMMultiSelectDialog
            renderOption={props.renderOption}
            onCancel={() => setMultiEditDialogOpen(false)}
            onOK={options => {
                props.onChange(options);
                setMultiEditDialogOpen(false);
            }}
            initialValues={props.value}
            getOptions={props.getOptions}
            getOptionById={props.getOptionById}
            getOptionInfo={props.getOptionInfo}
            title={dialogTitle}
            description={dialogDescription}
        />}
    </div>
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
};


export const CMSingleSelect = <Toption,>(props: CMSingleSelectProps<Toption>) => {
    const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState<boolean>(false);
    const [allOptionsX, setAllOptionsX] = React.useState<{
        option: Toption;
        info: ItemInfo;
        id: Tid;
        selected: boolean;
    }[]>([]);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    const editStyle = props.editStyle || CMSelectEditStyle.inlineWithDialog;
    const valueDisplayStyle = props.valueDisplayStyle || CMSelectValueDisplayStyle.all;
    const chipSize = props.chipSize || "small";
    const chipShape = props.chipShape || "rectangle";
    const dialogTitle = props.dialogTitle || "Select";
    const dialogDescription = props.dialogDescription || "";

    type TX = {
        option: Toption;
        info: ItemInfo;
        id: Tid;
        selected: boolean;
    };

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = props.getOptions({ quickFilter: undefined });
                const resolvedOptions = options instanceof Promise ? await options : options;

                const allOptions = resolvedOptions.map(option => {
                    const info = props.getOptionInfo(option);
                    return {
                        id: info.id,
                        info,
                        option,
                        selected: props.getOptionInfo(props.value).id === info.id,
                    };
                });
                setAllOptionsX(allOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOptions();
    }, [props.getOptions, props.value, props.getOptionInfo]);

    const valueInfo = props.getOptionInfo(props.value);
    const valueX: TX = {
        id: valueInfo.id,
        option: props.value,
        info: valueInfo,
        selected: true,
    };

    return (
        <div className={`CMSingleSelect`}>
            <CMChipContainer>

                {(valueDisplayStyle === CMSelectValueDisplayStyle.all) && (editStyle === CMSelectEditStyle.inlineWithDialog) && (
                    <>
                        {allOptionsX.map(optionX => (
                            <CMChip
                                key={optionX.id}
                                size={chipSize}
                                color={optionX.info.color}
                                shape={chipShape}
                                variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                                onClick={props.readonly ? undefined : (() => props.onChange(optionX.option))}
                            >
                                {props.renderOption(optionX.option)}
                            </CMChip>
                        ))}
                        {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                    </>
                )}
                {(valueDisplayStyle === CMSelectValueDisplayStyle.all) && (editStyle === CMSelectEditStyle.dialog) && (
                    <>
                        {allOptionsX.map(optionX => (
                            <CMChip
                                key={optionX.id}
                                size={chipSize}
                                shape={chipShape}
                                color={optionX.info.color}
                                variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                            >
                                {props.renderOption(optionX.option)}
                            </CMChip>
                        ))}
                        {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                    </>
                )}
                {(valueDisplayStyle === CMSelectValueDisplayStyle.selected) && (editStyle === CMSelectEditStyle.inlineWithDialog) && (
                    <>
                        <CMChip
                            key={valueX.info.id}
                            size={chipSize}
                            shape={chipShape}
                            color={valueX.info.color}
                        >
                            {props.renderOption(valueX.option)}
                        </CMChip>
                        {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                    </>
                )}
                {(valueDisplayStyle === CMSelectValueDisplayStyle.selected) && (editStyle === CMSelectEditStyle.dialog) && (
                    <>
                        <CMChip
                            key={valueX.info.id}
                            size={chipSize}
                            shape={chipShape}
                            color={valueX.info.color}
                        >
                            {props.renderOption(valueX.option)}
                        </CMChip>
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
                    title={dialogTitle}
                    description={dialogDescription}
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
