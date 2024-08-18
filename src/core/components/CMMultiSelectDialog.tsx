import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions, ReactiveInputDialog } from "./CMCoreComponents";
import { CMDialogContentText } from "./CMCoreComponents2";

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

    allowQuickFilter?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;
};


export function CMMultiSelectDialog<T>(props: CMMultiSelectDialogProps<T>) {
    const [selectedObjIds, setSelectedObjIds] = React.useState<Tid[]>(() => (props.initialValues || []).map(option => props.getOptionInfo(option).id));
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [items, setItems] = React.useState<T[]>([]);
    const [selectedOptions, setSelectedOptions] = React.useState<T[]>([]);

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

        fetchItems();
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

        fetchSelectedOptions();
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