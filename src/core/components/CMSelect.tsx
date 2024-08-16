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

import React, { Suspense } from "react";

import { Autocomplete, Select } from "@mui/material";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMCoreComponents";
import { StandardVariationSpec } from "shared/color";
import { CMSmallButton } from "./CMCoreComponents2";
import { ChooseItemDialog } from "./ChooseItemDialog";
import { CMSingleSelectDialog } from "./CMSingleSelectDialog";
import { CMMultiSelectDialog } from "./CMMultiSelectDialog";

// ID type
type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};


/////////////////////////////////////////////////////////////////////////////////////////////
// "dialog" style shows the selected options, and a button to open a dialog
// "inline" style shows all options, with selected ones indicated
interface CMMultiSelectProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Toption[];
    value: Toption[];
    onChange: (optionIds: Toption[]) => void;
    getOptionInfo: (item: Toption) => ItemInfo;
    getOptionById: (id: Tid) => Toption;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: "all" | "selected";
    editStyle?: "dialog" | "inline+dialog"; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
};

export const CMMultiSelect = <Toption,>(props: CMMultiSelectProps<Toption>) => {
    const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState<boolean>(false);
    //const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState<boolean>(false);

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

    const allOptionsX = props.getOptions({ quickFilter: undefined }).map(option => {
        const info = props.getOptionInfo(option);
        return {
            id: info.id,
            info,
            option,
            selected: valuesX.some(x => x.id === info.id),
        };
    });

    return <div className={`CMMultiSelect`}>
        <CMChipContainer>
            {
                // ALL style: show all options and variation indicates selected.
                // INLINE-DIALOG edit style: clicking toggles selected; there's no other edit options. so ALL + INLINE is practical
                (props.valueDisplayStyle === "all") && (props.editStyle === "inline+dialog") && <>{allOptionsX.map(optionX => {
                    //const info = props.getOptionInfo(v);
                    //const selected = valueX.some(x => x.id === info.id);
                    return <CMChip
                        key={optionX.id}
                        size={props.chipSize}
                        color={optionX.info.color}
                        shape={props.chipShape}
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
                (props.valueDisplayStyle === "all") && (props.editStyle === "dialog") && <>
                    {allOptionsX.map(optionX => {
                        //const info = props.getOptionInfo(v);
                        //const selected = props.selectedOptionIds.includes(info.id);
                        return <CMChip
                            key={optionX.id}
                            size={props.chipSize}
                            shape={props.chipShape}
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
                (props.valueDisplayStyle === "selected") && (props.editStyle === "inline+dialog") && <>{valuesX.map(valueX => {
                    //const v = props.getOptionById(id);
                    //const info = props.getOptionInfo(v);
                    //const selected = props.selectedOptionIds.includes(info.id);
                    return <CMChip
                        key={valueX.info.id}
                        size={props.chipSize}
                        shape={props.chipShape}
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
                (props.valueDisplayStyle === "selected") && (props.editStyle === "dialog") && <>{valuesX.map(valueX => {
                    //const v = props.getOptionById(id);
                    //const info = props.getOptionInfo(v);
                    //const selected = props.selectedOptionIds.includes(info.id);
                    return <CMChip
                        key={valueX.info.id}
                        size={props.chipSize}
                        shape={props.chipShape}
                        color={valueX.info.color}
                    >
                        {props.renderOption(valueX.option)}
                    </CMChip>
                })}
                    {!props.readonly && <CMSmallButton onClick={() => setMultiEditDialogOpen(true)}>Edit</CMSmallButton>}
                </>
            }
        </CMChipContainer>
        {multiEditDialogOpen && <CMMultiSelectDialog
            renderOption={props.renderOption}
            //closeOnSelect={false}
            onCancel={() => setMultiEditDialogOpen(false)}
            onOK={options => {
                //props.setOptionSelected(, true);
                props.onChange(options);
                setMultiEditDialogOpen(false);
            }}
            initialValues={props.value}
            getOptions={props.getOptions}
            getOptionById={props.getOptionById}
            getOptionInfo={props.getOptionInfo}
            title={"title"}
            description={"description"}
        />}
    </div>
};



/////////////////////////////////////////////////////////////////////////////////////////////
interface CMSingleSelectProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Toption[];
    value: Toption;
    onChange: (optionIds: Toption) => void;
    getOptionInfo: (item: Toption) => ItemInfo;
    getOptionById: (id: Tid) => Toption;
    renderOption: (item: Toption) => React.ReactNode;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    valueDisplayStyle?: "all" | "selected";
    editStyle?: "dialog" | "inline+dialog"; // another possibility would be inline-autocomplete vs. inline-dialog
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
};

export const CMSingleSelect = <Toption,>(props: CMSingleSelectProps<Toption>) => {
    //const [multiEditDialogOpen, setMultiEditDialogOpen] = React.useState<boolean>(false);
    const [singleSelectDialogOpen, setSingleSelectDialogOpen] = React.useState<boolean>(false);

    type TX = {
        option: Toption,
        info: ItemInfo,
        id: Tid,
        selected: boolean,
    };

    const valueInfo = props.getOptionInfo(props.value);
    const valueX: TX = {
        id: valueInfo.id,
        option: props.value,
        info: valueInfo,
        selected: true,
    };

    // const setSelected = (optionX: TX, selected: boolean) => {
    //     if (selected) {
    //         props.onChange([...props.value, optionX.option]);
    //     } else {
    //         props.onChange(props.value.filter(s => props.getOptionInfo(s).id !== optionX.id));
    //     }
    // };

    const allOptionsX = props.getOptions({ quickFilter: undefined }).map(option => {
        const info = props.getOptionInfo(option);
        return {
            id: info.id,
            info,
            option,
            selected: valueX.id === info.id,
        };
    });

    return <div className={`CMMultiSelect`}>
        <CMChipContainer>
            {
                // ALL style: show all options and variation indicates selected.
                // INLINE-DIALOG edit style: clicking selects the item
                (props.valueDisplayStyle === "all") && (props.editStyle === "inline+dialog") && <>{allOptionsX.map(optionX => {
                    //const info = props.getOptionInfo(v);
                    //const selected = valueX.some(x => x.id === info.id);
                    return <CMChip
                        key={optionX.id}
                        size={props.chipSize}
                        color={optionX.info.color}
                        shape={props.chipShape}
                        variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                        onClick={props.readonly ? undefined : (() => props.onChange(optionX.option))}
                    >
                        {props.renderOption(optionX.option)}
                    </CMChip>
                })}
                    {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                </>
            }
            {
                // ALL style: show all options and variation indicates selected.
                // DIALOG edit style: just a button to edit in a dialog
                (props.valueDisplayStyle === "all") && (props.editStyle === "dialog") && <>
                    {allOptionsX.map(optionX => {
                        //const info = props.getOptionInfo(v);
                        //const selected = props.selectedOptionIds.includes(info.id);
                        return <CMChip
                            key={optionX.id}
                            size={props.chipSize}
                            shape={props.chipShape}
                            color={optionX.info.color}
                            variation={{ ...StandardVariationSpec.Strong, selected: optionX.selected }}
                        >
                            {props.renderOption(optionX.option)}
                        </CMChip>
                    })}
                    {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                </>
            }
            {
                // SELECTED style: show only selected options.
                // INLINE-DIALOG edit style gives them delete buttons and a "+ add" option to select a single item
                (props.valueDisplayStyle === "selected") && (props.editStyle === "inline+dialog") && <><CMChip
                    key={valueX.info.id}
                    size={props.chipSize}
                    shape={props.chipShape}
                    color={valueX.info.color}
                //onDelete={props.readonly ? undefined : (() => setSelected(valueX, false))}
                >
                    {props.renderOption(valueX.option)}
                </CMChip>
                    {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                </>
            }
            {
                // SELECTED style: show only selected options.
                // DIALOG edit style gives them delete buttons and a "+ add" option to select a single item
                (props.valueDisplayStyle === "selected") && (props.editStyle === "dialog") && <><CMChip
                    key={valueX.info.id}
                    size={props.chipSize}
                    shape={props.chipShape}
                    color={valueX.info.color}
                >
                    {props.renderOption(valueX.option)}
                </CMChip>
                    {!props.readonly && <CMSmallButton onClick={() => setSingleSelectDialogOpen(true)}>Select</CMSmallButton>}
                </>
            }
        </CMChipContainer>
        {singleSelectDialogOpen && <CMSingleSelectDialog
            renderOption={props.renderOption}
            onCancel={() => setSingleSelectDialogOpen(false)}
            onOK={option => {
                //props.setOptionSelected(, true);
                props.onChange(option);
                setSingleSelectDialogOpen(false);
            }}
            value={props.value}
            getOptions={props.getOptions}
            getOptionById={props.getOptionById}
            getOptionInfo={props.getOptionInfo}
            title={"title"}
            description={"description"}
        />}
    </div>
};


