// todo: quick filter + add new
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

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};

export function CMSingleSelectDialog<T>(props: CMSingleSelectDialogProps<T>) {
    const snackbar = useSnackbar();
    const [filterText, setFilterText] = React.useState("");
    const [selectedObjId, setSelectedObjId] = React.useState<Tid | undefined>(() => props.value === undefined ? undefined : props.getOptionInfo(props.value).id);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [items, setItems] = React.useState<T[]>([]);
    const [selectedObj, setSelectedObj] = React.useState<T | undefined>(undefined);

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

        void fetchSelectedObj();
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

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && items.some(item => props.doesItemExactlyMatchText!(item, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            setSelectedObj(newObj);
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        }
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
