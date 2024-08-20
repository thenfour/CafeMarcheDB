import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool } from "shared/utils";
import { CMDialogContentText } from "./CMCoreComponents2";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMChip";
import { ReactiveInputDialog } from "./CMCoreComponents";
import { SearchInput } from "./CMTextField";
import { useSnackbar } from "./SnackbarContext";
import { gIconMap } from "../db3/components/IconMap";

export enum CMSelectNullBehavior {
    NonNullable = "NonNullable",
    AllowNull = "AllowNull",
    AllowUndefined = "AllowUndefined",
};

type Tnull = undefined | null;

type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};

/////////////////////////////////////////////////////////////////////////////////////////////
export const useSingleSelectLogic = <T,>(
    props: {
        nullBehavior?: CMSelectNullBehavior | undefined,
        getOptionInfo: (item: T) => ItemInfo,
        getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    },
    selectedValue: T | undefined | null,
    filterText: string | undefined,
) => {

    type TX = {
        option: T;
        info: ItemInfo;
    };

    const [allOptions, setAllOptions] = React.useState<TX[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const { allowNull, nullValue } = {
        [CMSelectNullBehavior.NonNullable]: {
            allowNull: false,
            nullValue: undefined,
        },
        [CMSelectNullBehavior.AllowNull]: {
            allowNull: true,
            nullValue: null,
        },
        [CMSelectNullBehavior.AllowUndefined]: {
            allowNull: true,
            nullValue: undefined,
        }
    }[props.nullBehavior || CMSelectNullBehavior.NonNullable];

    const isNullSelected = (allowNull && !selectedValue); // not necessary to strictly check null vs undefined. allow it.
    const selectedItemInfo = isNullSelected ? undefined : props.getOptionInfo(selectedValue!);

    const isSelected = (optionInfo: ItemInfo): boolean => {
        return !isNullSelected && optionInfo.id === selectedItemInfo!.id;
    };

    const makeTX = (option: T): TX => {
        const info = props.getOptionInfo(option);
        return {
            option,
            info,
            //selected: isSelected(info),
        };
    };

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = await (props.getOptions({ quickFilter: filterText }) instanceof Promise
                    ? props.getOptions({ quickFilter: undefined })
                    : Promise.resolve(props.getOptions({ quickFilter: undefined })));
                const processedOptions: TX[] = options.map(option => makeTX(option));
                setAllOptions(processedOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchOptions();
    }, [props.getOptions, selectedValue, props.getOptionInfo, filterText]); // selectedValue here because it changes the `selected` property of TX

    return {
        allowNull,
        nullValue,
        isNullSelected,
        selectedItemInfo,
        isSelected,
        makeTX,
        isLoading,
        allOptions,
        selectedOptionX: isNullSelected ? undefined : {
            option: selectedValue!,
            info: selectedItemInfo!,
        },
    };
};



/////////////////////////////////////////////////////////////////////////////////////////////
export interface CMSingleSelectDialogBaseProps<T> {
    value?: T | Tnull;
    onOK: (value: T | Tnull) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
    renderOption: (value: T) => React.ReactNode;

    closeOnSelect?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};

interface CMSingleSelectDialogBasePropsNotAllowingNull<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    value?: Toption;
    onOK: (value: Toption) => void;
}

interface CMSingleSelectDialogBasePropsAllowingNull<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    value?: Toption | null;
    onOK: (value: Toption | null) => void;
}

interface CMSingleSelectDialogBasePropsAllowingUndefined<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    value?: Toption | undefined;
    onOK: (value: Toption | undefined) => void;
}

type CMSingleSelectDialogProps<Toption> =
    | CMSingleSelectDialogBasePropsNotAllowingNull<Toption>
    | CMSingleSelectDialogBasePropsAllowingNull<Toption>
    | CMSingleSelectDialogBasePropsAllowingUndefined<Toption>;

export function CMSingleSelectDialog<T>(props: CMSingleSelectDialogProps<T>) {
    const snackbar = useSnackbar();
    const [filterText, setFilterText] = React.useState("");
    const [selectedOption, setSelectedOption] = React.useState<T | Tnull>(props.value); // this is a modal dialog to select an item so on first open, even without nullable behavior, nulls can be specified.

    // if any of these are missing, allow insert from string will not be available.
    const allowInsertFromString = CoalesceBool(props.allowInsertFromString, true) && props.doesItemExactlyMatchText && props.doInsertFromString;

    const closeOnSelect = CoalesceBool(props.closeOnSelect, true);

    const ssl = useSingleSelectLogic(props, selectedOption, filterText);

    const renderChip = (key: Tid, option: T, info: ItemInfo, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        return <CMChip
            key={key}
            onClick={onClick}
            onDelete={onDelete}

            color={info.color}
            tooltip={info.tooltip}
            shape={props.chipShape}
            size={props.chipSize}
            variation={{ ...StandardVariationSpec.Strong, selected: ssl.isSelected(info) }}
        >
            {props.renderOption(option)}
        </CMChip>;
    };

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && ssl.allOptions.some(item => props.doesItemExactlyMatchText!(item.option, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            setSelectedOption(newObj);
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        }
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>
        <DialogTitle>
            {props.title}
            {ssl.isLoading && <CircularProgress />}
            <Box sx={{ p: 0 }}>
                Selected: {ssl.isNullSelected ? "<none>" : renderChip(0, selectedOption!, ssl.selectedItemInfo!, undefined, () => setSelectedOption(ssl.nullValue))}
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {props.description}
            </CMDialogContentText>

            {props.allowQuickFilter && <Box>
                <SearchInput
                    onChange={(v) => setFilterText(v)}
                    value={filterText}
                    autoFocus={true}
                />
            </Box>}

            {
                !!filterText.length && !filterMatchesAnyItemsExactly && allowInsertFromString && (
                    <Box><Button
                        size="small"
                        startIcon={gIconMap.Add()}
                        onClick={onNewClicked}
                    >
                        add {filterText}
                    </Button>
                    </Box>
                )
            }

            {ssl.allOptions.length === 0 ? (
                <Box>Nothing here</Box>
            ) : (
                <CMChipContainer orientation="vertical">
                    {ssl.allOptions.map(item =>
                        renderChip(item.info.id, item.option, item.info, () => {
                            setSelectedOption(item.option);
                            closeOnSelect && props.onOK(item.option);
                        }, undefined)
                    )}
                </CMChipContainer>
            )}

        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(selectedOption as any); }} disabled={!ssl.allowNull && !selectedOption}>OK</Button>
        </DialogActions>

    </ReactiveInputDialog>
}
