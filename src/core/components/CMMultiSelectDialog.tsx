import React, { Suspense } from "react";

import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItemButton, Select } from "@mui/material";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "./CMCoreComponents";
import { StandardVariationSpec } from "shared/color";
import { CMDialogContentText, CMSmallButton } from "./CMCoreComponents2";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
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

    getOptions: (args: { quickFilter: string | undefined }) => T[];
    getOptionInfo: (item: T) => ItemInfo;
    getOptionById: (id: Tid) => T;
    renderOption: (value: T) => React.ReactNode;

    initialValues?: T[] | undefined;

    allowQuickFilter?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;
};

export function CMMultiSelectDialog<T>(props: CMMultiSelectDialogProps<T>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObjIds, setSelectedObjIds] = React.useState<Tid[]>(() => (props.initialValues || []).map(option => props.getOptionInfo(option).id));

    const items = props.getOptions({ quickFilter: undefined });
    const itemsWithInfo = items.map(v => ({
        option: v,
        info: props.getOptionInfo(v),
    }));

    const selectedOptionsWithInfo = selectedObjIds.map(id => {
        const option = props.getOptionById(id);
        return {
            id,
            option,
            info: props.getOptionInfo(option),
        }
    });

    const renderChip = (key: Tid, option: T, info: ItemInfo, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        return <CMChip
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
        </CMChip>;
    };

    return (
        <Dialog
            open={true}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
            className={`ReactiveInputDialog ${fullScreen ? "smallScreen" : "bigScreen"}`}
            disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
        >
            <DialogTitle>
                {props.title}
                <Box sx={{ p: 0 }}>
                    Selected: {selectedObjIds.length === 0 ? "<none>" : <CMChipContainer>
                        {selectedOptionsWithInfo.map(optionx => renderChip(optionx.id, optionx.option, optionx.info, undefined, () => setSelectedObjIds(selectedObjIds.filter(id => id !== optionx.id))))}
                    </CMChipContainer>}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    {props.description}
                </CMDialogContentText>
                {
                    (items.length == 0) ?
                        <Box>Nothing here</Box>
                        :
                        <CMChipContainer orientation="vertical">
                            {itemsWithInfo.map(item => renderChip(item.info.id, item.option, item.info,
                                () => {
                                    // toggle selection of this item.
                                    const selectedAlready = selectedObjIds.includes(item.info.id);
                                    if (selectedAlready) {
                                        setSelectedObjIds(selectedObjIds.filter(id => id !== item.info.id)); // remove
                                    } else {
                                        setSelectedObjIds([...selectedObjIds, item.info.id]); // add
                                    }
                                }, undefined))}
                        </CMChipContainer>
                }
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={() => { props.onOK(selectedOptionsWithInfo.map(ox => ox.option)); }}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}
