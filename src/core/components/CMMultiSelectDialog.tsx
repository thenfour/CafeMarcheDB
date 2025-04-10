import React from "react";

import { Box, Button, CircularProgress, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool } from "shared/utils";
import { gIconMap } from "../db3/components/IconMap";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMChip";
import { CMDialogContentText, DialogActionsCM } from "./CMCoreComponents2";
import { SearchInput } from "./CMTextField";
import { ReactiveInputDialog } from "./ReactiveInputDialog";
import { useSnackbar } from "./SnackbarContext";

type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};

export const useMultiSelectLogic = <T,>(
    props: {
        getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
        getOptionInfo: (item: T) => ItemInfo;
    },
    selectedOptions: T[],
    filterText: string | undefined,
) => {

    type TX = {
        option: T;
        info: ItemInfo;
    };

    const [allOptionsX, setAllOptionsX] = React.useState<TX[]>([]);
    const [selectedOptionsX, setSelectedOptionsX] = React.useState<TX[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const isSelected = (info: ItemInfo) => {
        return selectedOptionsX.some(x => x.info.id === info.id);
    }

    const makeTX = (option: T): TX => {
        const info = props.getOptionInfo(option);
        return {
            info,
            option,
        };
    };

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const options = await Promise.resolve(props.getOptions({ quickFilter: filterText }));
                setAllOptionsX(options.map(o => makeTX(o)));
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };
        void fetchOptions();
    }, [props.getOptions, selectedOptions, props.getOptionInfo, filterText]);

    React.useEffect(() => {
        setSelectedOptionsX(selectedOptions.map(o => makeTX(o)));
    }, [props.getOptions, props.getOptionInfo, allOptionsX]);

    React.useEffect(() => {
        setSelectedOptionsX(selectedOptions.map(o => makeTX(o)));
    }, [selectedOptions]);

    const toggleSelection = (x: TX): T[] => {
        if (isSelected(x.info)) {
            const ret = selectedOptions.filter(alreadySelected => props.getOptionInfo(alreadySelected).id !== x.info.id);
            return ret;
        }
        const ret = [...selectedOptions, x.option];
        return ret;
    };

    return {
        isLoading,
        allOptionsX,
        selectedOptionsX,
        makeTX,
        isSelected,
        toggleSelection,
    };
};




export interface CMMultiSelectDialogProps<T> {
    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
    renderOption: (value: T) => React.ReactNode;

    initialValues?: T[] | undefined;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};


export function CMMultiSelectDialog<T>(props: CMMultiSelectDialogProps<T>) {
    const snackbar = useSnackbar();
    const [filterText, setFilterText] = React.useState("");
    const [selectedOptions, setSelectedOptions] = React.useState<T[]>([]);

    // if any of these are missing, allow insert from string will not be available.
    const allowInsertFromString = CoalesceBool(props.allowInsertFromString, true) && props.doesItemExactlyMatchText && props.doInsertFromString;

    React.useEffect(() => {
        setSelectedOptions(props.initialValues || []);
    }, [...props.initialValues || []]);

    const msl = useMultiSelectLogic(props, selectedOptions, filterText);
    type TX = typeof msl.allOptionsX[0];

    const renderChip = (x: TX) => {
        return (
            <CMChip
                key={x.info.id}
                onClick={() => setSelectedOptions(msl.toggleSelection(x))}
                color={x.info.color}
                tooltip={x.info.tooltip}
                shape={props.chipShape}
                size={props.chipSize}
                variation={{ ...StandardVariationSpec.Strong, selected: msl.isSelected(x.info) }}
            >
                {props.renderOption(x.option)}
            </CMChip>
        );
    };

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && msl.allOptionsX.some(item => props.doesItemExactlyMatchText!(item.option, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            setSelectedOptions([...selectedOptions, newObj]); // add
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        }
    };

    return (
        <ReactiveInputDialog onCancel={props.onCancel}>
            <DialogTitle>
                {props.title}
                {msl.isLoading && <CircularProgress />}
                <Box sx={{ p: 0 }}>
                    Selected: {msl.selectedOptionsX.length === 0 ? "<none>" : (
                        <CMChipContainer>
                            {msl.selectedOptionsX.map(optionx => renderChip(optionx))}
                        </CMChipContainer>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    {props.description}
                </CMDialogContentText>

                <Box>
                    <SearchInput
                        onChange={(v) => setFilterText(v)}
                        value={filterText}
                    //autoFocus={true} // see #408
                    />
                </Box>
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

                {msl.allOptionsX.length === 0 ? (
                    <Box>Nothing here</Box>
                ) : (
                    <CMChipContainer orientation="vertical">
                        {msl.allOptionsX.map(x => renderChip(x))}
                    </CMChipContainer>
                )}
                <DialogActionsCM>
                    <Button onClick={() => { props.onOK(selectedOptions); }}>OK</Button>
                    <Button onClick={props.onCancel}>Cancel</Button>
                </DialogActionsCM>
            </DialogContent>
        </ReactiveInputDialog>
    );
}