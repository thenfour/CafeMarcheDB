// todo: quick filter + add new
// todo: async fetching with suspense
import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool } from "shared/utils";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions, ReactiveInputDialog } from "./CMCoreComponents";
import { CMDialogContentText } from "./CMCoreComponents2";

type Tid = number | string;

interface ItemInfo {
    id: Tid;
    color?: string | null;
    tooltip?: string | undefined;
};

export interface CMSingleSelectDialogProps<T> {
    onOK: (value: T) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
    getOptionById: (id: Tid) => T | Promise<T>;
    renderOption: (value: T) => React.ReactNode;

    value?: T | undefined;

    closeOnSelect?: boolean;
    allowQuickFilter?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;
};

export function CMSingleSelectDialog<T>(props: CMSingleSelectDialogProps<T>) {
    const [selectedObjId, setSelectedObjId] = React.useState<Tid | undefined>(() => props.value === undefined ? undefined : props.getOptionInfo(props.value).id);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [items, setItems] = React.useState<T[]>([]);
    const [selectedObj, setSelectedObj] = React.useState<T | undefined>(undefined);

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

    const itemsWithInfo = items.map(v => ({
        option: v,
        info: props.getOptionInfo(v),
    }));

    React.useEffect(() => {
        const fetchSelectedObj = async () => {
            if (selectedObjId === undefined) {
                setSelectedObj(undefined);
                return;
            }

            setIsLoading(true);
            try {
                const result = props.getOptionById(selectedObjId);
                const resolvedResult = result instanceof Promise ? await result : result;
                setSelectedObj(resolvedResult);
            } catch (error) {
                console.error("Error fetching selected option:", error);
                setSelectedObj(undefined);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSelectedObj();
    }, [selectedObjId, props.getOptionById]);

    const closeOnSelect = CoalesceBool(props.closeOnSelect, true);

    const selectedObjInfo = selectedObj === undefined ? undefined : props.getOptionInfo(selectedObj);

    const renderChip = (key: Tid, option: T, info: ItemInfo, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        return <CMChip
            key={key}
            onClick={onClick}
            onDelete={onDelete}

            color={info.color}
            tooltip={info.tooltip}
            shape={props.chipShape}
            size={props.chipSize}
            variation={{ ...StandardVariationSpec.Strong, selected: selectedObjId === info.id }}
        >
            {props.renderOption(option)}
        </CMChip>;
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>
        <DialogTitle>
            {props.title}
            {isLoading && <CircularProgress />}
            <Box sx={{ p: 0 }}>
                Selected: {selectedObj === undefined ? "<none>" : renderChip(0, selectedObj, selectedObjInfo!, undefined, () => setSelectedObjId(undefined))}
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
                            setSelectedObjId(item.info.id);
                            closeOnSelect && props.onOK(item.option);
                        }, undefined)
                    )}
                </CMChipContainer>
            )}

        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(selectedObj!); }} disabled={selectedObj === undefined}>OK</Button>
        </DialogActions>

    </ReactiveInputDialog>
}
