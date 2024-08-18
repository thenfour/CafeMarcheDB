// todo: quick filter + add new
import React from "react";

import { Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool, SplitQuickFilter } from "shared/utils";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { CMDialogContentText } from "src/core/components/CMCoreComponents2";
import * as db3 from "src/core/db3/db3";
import { useDashboardContext } from "src/core/components/DashboardContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { TAnyModel } from "../shared/apiTypes";
import { SearchInput } from "src/core/components/CMTextField";
import { gIconMap } from "./IconMap";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { useSnackbar } from "src/core/components/SnackbarContext";

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

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};

export function DB3SingleSelectDialog<T extends (TAnyModel | null | undefined)>(props: DB3SingleSelectDialogProps<T>) {
    const ctx = useDashboardContext();
    const publicData = useAuthenticatedSession();
    const snackbar = useSnackbar();
    const closeOnSelect = CoalesceBool(props.closeOnSelect, true);
    const value = props.value || null;

    // if any of these are missing, allow insert from string will not be available.
    const allowInsertFromString = CoalesceBool(props.allowInsertFromString, true) && props.doesItemExactlyMatchText && props.doInsertFromString;
    const allowQuickFilter = CoalesceBool(props.allowQuickFilter, true);

    const [filterText, setFilterText] = React.useState("");
    const [selectedObj, setSelectedObj] = React.useState<T | null>(value);
    const selectedPk = props.value ? (props.value[props.schema.pkMember] as Tid) : undefined;

    const q = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        delayMS: 500,
        filterModel: {
            quickFilterValues: SplitQuickFilter(filterText),
            items: [],
        },
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

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && q.items.some(item => props.doesItemExactlyMatchText!(item, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            q.refetch();
            setSelectedObj(newObj);
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
            q.refetch();
        }
    };

    const insertAuthorized = props.schema.authorizeRowBeforeInsert({ clientIntention: ctx.userClientIntention, publicData });

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

            {allowQuickFilter &&
                <Box>
                    <SearchInput
                        onChange={(v) => setFilterText(v)}
                        value={filterText}
                        autoFocus={true}
                    />
                </Box>
            }

            {
                !!filterText.length && !filterMatchesAnyItemsExactly && allowInsertFromString && insertAuthorized && (
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

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};


export function DB3MultiSelectDialog<T extends TAnyModel>(props: DB3MultiSelectDialogProps<T>) {
    const ctx = useDashboardContext();
    const publicData = useAuthenticatedSession();
    const getPk = (o: T): number => o[props.schema.pkMember] as number;
    const snackbar = useSnackbar();

    // if any of these are missing, allow insert from string will not be available.
    const allowInsertFromString = CoalesceBool(props.allowInsertFromString, true) && props.doesItemExactlyMatchText && props.doInsertFromString;
    const allowQuickFilter = CoalesceBool(props.allowQuickFilter, true);

    const [filterText, setFilterText] = React.useState("");
    const [selectedOptions, setSelectedOptions] = React.useState<T[]>(props.initialValues || []);
    const selectedOptionIds = selectedOptions.map(o => getPk(o));

    const q = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        delayMS: 500,
        filterModel: {
            quickFilterValues: SplitQuickFilter(filterText),
            items: [],
        },
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

    const isSelected = (x: T) => selectedOptionIds.includes(getPk(x));

    const selectOption = (x: T) => {
        setSelectedOptions([...selectedOptions, x]);
    }

    const deselectOption = (x: T) => {
        const id = getPk(x);
        setSelectedOptions(selectedOptions.filter(selOption => getPk(selOption) != id));
    };

    const toggleSelected = (x: T) => isSelected(x) ? deselectOption(x) : selectOption(x);

    const filterMatchesAnyItemsExactly = props.doesItemExactlyMatchText && q.items.some(item => props.doesItemExactlyMatchText!(item, filterText));

    const onNewClicked = async () => {
        try {
            const newObj = await props.doInsertFromString!(filterText);
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            q.refetch();
            selectOption(newObj);
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
            q.refetch();
        }
    };

    const insertAuthorized = props.schema.authorizeRowBeforeInsert({ clientIntention: ctx.userClientIntention, publicData });

    return (
        <ReactiveInputDialog onCancel={props.onCancel}>
            <DialogTitle>
                {props.title}
                {q.isLoading && <CircularProgress />}
                <Box sx={{ p: 0 }}>
                    Selected: {selectedOptions.length === 0 ? "<none>" : (
                        <CMChipContainer>
                            {selectedOptions.map(option =>
                                renderChip(option, undefined, () => deselectOption(option))
                            )}
                        </CMChipContainer>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    {props.description}
                </CMDialogContentText>

                {allowQuickFilter &&
                    <Box>
                        <SearchInput
                            onChange={(v) => setFilterText(v)}
                            value={filterText}
                            autoFocus={true}
                        />
                    </Box>
                }

                {
                    !!filterText.length && !filterMatchesAnyItemsExactly && allowInsertFromString && insertAuthorized && (
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

                {q.items.length === 0 ? (
                    <Box>Nothing here</Box>
                ) : (
                    <CMChipContainer orientation="vertical">
                        {q.items.map(item =>
                            renderChip(item, () => toggleSelected(item), undefined)
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