// todo: add new item, quick filter

import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CMDialogContentText } from "./CMCoreComponents2";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMChip";
import { ReactiveInputDialog } from "./CMCoreComponents";
import { SearchInput } from "./CMTextField";
import { gIconMap } from "../db3/components/IconMap";
import { useSnackbar } from "./SnackbarContext";
import { CoalesceBool } from "shared/utils";

type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};

export interface CMMultiSelectDialogProps<T> {
    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
    getOptionById: (id: Tid) => T | Promise<T>;
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
    const [selectedObjIds, setSelectedObjIds] = React.useState<Tid[]>(() => (props.initialValues || []).map(option => props.getOptionInfo(option).id));
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [items, setItems] = React.useState<T[]>([]);
    const [selectedOptions, setSelectedOptions] = React.useState<T[]>([]);

    // if any of these are missing, allow insert from string will not be available.
    const allowInsertFromString = CoalesceBool(props.allowInsertFromString, true) && props.doesItemExactlyMatchText && props.doInsertFromString;

    React.useEffect(() => {
        const fetchItems = async () => {
            setIsLoading(true);
            try {
                const options = props.getOptions({ quickFilter: undefined });
                const resolvedOptions = options instanceof Promise ? await options : options;
                setItems(resolvedOptions);
            } catch (error) {
                console.error("Error fetching options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchItems();
    }, [props.getOptions]);

    React.useEffect(() => {
        const fetchSelectedOptions = async () => {
            setIsLoading(true);
            try {
                const resolvedOptions = await Promise.all(
                    selectedObjIds.map(async id => {
                        const option = props.getOptionById(id);
                        return option instanceof Promise ? await option : option;
                    })
                );
                setSelectedOptions(resolvedOptions);
            } catch (error) {
                console.error("Error fetching selected options:", error);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchSelectedOptions();
    }, [selectedObjIds, props.getOptionById]);

    const itemsWithInfo = items.map(v => ({
        option: v,
        info: props.getOptionInfo(v),
    }));

    const selectedOptionsWithInfo = selectedOptions.map(option => ({
        id: props.getOptionInfo(option).id,
        option,
        info: props.getOptionInfo(option),
    }));

    const renderChip = (key: Tid, option: T, info: ItemInfo, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        return (
            <CMChip
                key={key}
                onClick={onClick}
                onDelete={onDelete}
                color={info.color}
                tooltip={info.tooltip}
                shape={props.chipShape}
                size={props.chipSize}
                variation={{ ...StandardVariationSpec.Strong, selected: selectedObjIds.includes(info.id) }}
            >
                {props.renderOption(option)}
            </CMChip>
        );
    };

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && items.some(item => props.doesItemExactlyMatchText!(item, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            const newInfo = props.getOptionInfo(newObj);
            setSelectedObjIds([...selectedObjIds, newInfo.id]); // add
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        }
    };

    return (
        <ReactiveInputDialog onCancel={props.onCancel}>
            <DialogTitle>
                {props.title}
                {isLoading && <CircularProgress />}
                <Box sx={{ p: 0 }}>
                    Selected: {selectedObjIds.length === 0 ? "<none>" : (
                        <CMChipContainer>
                            {selectedOptionsWithInfo.map(optionx =>
                                renderChip(optionx.id, optionx.option, optionx.info, undefined, () =>
                                    setSelectedObjIds(selectedObjIds.filter(id => id !== optionx.id))
                                )
                            )}
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
                        autoFocus={true}
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

                {items.length === 0 ? (
                    <Box>Nothing here</Box>
                ) : (
                    <CMChipContainer orientation="vertical">
                        {itemsWithInfo.map(item =>
                            renderChip(item.info.id, item.option, item.info, () => {
                                const selectedAlready = selectedObjIds.includes(item.info.id);
                                if (selectedAlready) {
                                    setSelectedObjIds(selectedObjIds.filter(id => id !== item.info.id)); // remove
                                } else {
                                    setSelectedObjIds([...selectedObjIds, item.info.id]); // add
                                }
                            }, undefined)
                        )}
                    </CMChipContainer>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={() => { props.onOK(selectedOptionsWithInfo.map(ox => ox.option)); }}>OK</Button>
            </DialogActions>
        </ReactiveInputDialog>
    );
}