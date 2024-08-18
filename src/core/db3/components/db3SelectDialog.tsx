// todo: quick filter + add new
// todo: async fetching with suspense
import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool } from "shared/utils";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { CMDialogContentText } from "src/core/components/CMCoreComponents2";
import * as db3 from "src/core/db3/db3";
import { useDashboardContext } from "src/core/components/DashboardContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { TAnyModel } from "../shared/apiTypes";

type Tid = number;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DB3SingleSelectDialogProps<T extends (TAnyModel | null | undefined)> {
    schema: db3.xTable,

    value?: T | null;
    onOK: (value: T) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    renderOption: (value: T) => React.ReactNode;

    closeOnSelect?: boolean;
    allowQuickFilter?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;
};

export function DB3SingleSelectDialog<T extends (TAnyModel | null | undefined)>(props: DB3SingleSelectDialogProps<T>) {
    const ctx = useDashboardContext();
    const closeOnSelect = CoalesceBool(props.closeOnSelect, true);
    const value = props.value || null;

    const [selectedObj, setSelectedObj] = React.useState<T | null>(value);
    const selectedPk = props.value ? (props.value[props.schema.pkMember] as Tid) : undefined;

    const q = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        delayMS: 500,
    });

    const renderChip = (option: T | null, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        if (!option) {
            return <div key={-1}>(none)</div>;
        }
        const info = props.schema.getRowInfo(option);

        return <CMChip
            key={info.pk}
            onClick={onClick}
            onDelete={onDelete}

            color={info.color}
            shape={props.chipShape}
            size={props.chipSize}
            variation={{ ...StandardVariationSpec.Strong, selected: selectedPk === info.pk }}
        >
            {props.renderOption(option)}
        </CMChip>;
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>
        <DialogTitle>
            {props.title}
            {q.isLoading && <CircularProgress />}
            <Box sx={{ p: 0 }}>
                Selected: {selectedObj === undefined ? "<none>" : renderChip(selectedObj, undefined, () => setSelectedObj(null))}
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {props.description}
            </CMDialogContentText>

            {q.items.length === 0 ? (
                <Box>Nothing here</Box>
            ) : (
                <CMChipContainer orientation="vertical">
                    {q.items.map(item => renderChip(item, () => {
                        setSelectedObj(item);
                        closeOnSelect && props.onOK(item);
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



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface DB3MultiSelectDialogProps<T extends TAnyModel> {
    schema: db3.xTable,

    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    renderOption: (value: T) => React.ReactNode;

    initialValues?: T[] | undefined;

    allowQuickFilter?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;
};


export function DB3MultiSelectDialog<T extends TAnyModel>(props: DB3MultiSelectDialogProps<T>) {
    const ctx = useDashboardContext();
    const getPk = (o: T): number => o[props.schema.pkMember] as number;

    const [selectedOptions, setSelectedOptions] = React.useState<T[]>(props.initialValues || []);
    const selectedOptionIds = selectedOptions.map(o => getPk(o));

    const isSelected = (x: T) => selectedOptionIds.includes(getPk(x));

    const q = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        delayMS: 500,
    });

    const renderChip = (option: T, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        const info = props.schema.getRowInfo(option);
        return (
            <CMChip
                key={info.pk}
                onClick={onClick}
                onDelete={onDelete}
                color={info.color}
                tooltip={info.tooltip}
                shape={props.chipShape}
                size={props.chipSize}
                variation={{ ...StandardVariationSpec.Strong, selected: selectedOptionIds.includes(info.pk) }}
            >
                {props.renderOption(option)}
            </CMChip>
        );
    };

    const removeSelectedItemId = (x: T) => {
        const id = getPk(x);
        setSelectedOptions(selectedOptions.filter(selOption => getPk(selOption) != id));
    };

    return (
        <ReactiveInputDialog onCancel={props.onCancel}>
            <DialogTitle>
                {props.title}
                {q.isLoading && <CircularProgress />}
                <Box sx={{ p: 0 }}>
                    Selected: {selectedOptions.length === 0 ? "<none>" : (
                        <CMChipContainer>
                            {selectedOptions.map(option =>
                                renderChip(option, undefined, () => removeSelectedItemId(option))
                            )}
                        </CMChipContainer>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    {props.description}
                </CMDialogContentText>
                {q.items.length === 0 ? (
                    <Box>Nothing here</Box>
                ) : (
                    <CMChipContainer orientation="vertical">
                        {q.items.map(item =>
                            renderChip(item, () => {
                                if (isSelected(item)) {
                                    removeSelectedItemId(item);
                                } else {
                                    setSelectedOptions([...selectedOptions, item]); // add
                                }
                            }, undefined)
                        )}
                    </CMChipContainer>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={() => { props.onOK(selectedOptions); }}>OK</Button>
            </DialogActions>
        </ReactiveInputDialog>
    );
}