import React from "react";

import { Box, Button, CircularProgress, DialogContent, DialogTitle } from "@mui/material";
import { StandardVariationSpec } from "shared/color";
import { CoalesceBool } from "shared/utils";
import { CMChip, CMChipContainer, CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMDialogContentText, DialogActionsCM } from "src/core/components/CMCoreComponents2";
import * as db3 from "src/core/db3/db3";
import { useDashboardContext } from "src/core/components/DashboardContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { CMDBTableFilterModel, TAnyModel } from "../shared/apiTypes";
import { SearchInput } from "src/core/components/CMTextField";
import { gIconMap } from "./IconMap";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { CMSelectNullBehavior } from "src/core/components/CMSingleSelectDialog";
import { ReactiveInputDialog } from "src/core/components/ReactiveInputDialog";
import { SplitQuickFilter } from "shared/quickFilter";

type Tnull = undefined | null;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const useDB3SingleSelectLogic = <T extends TAnyModel,>(
    props: {
        nullBehavior?: CMSelectNullBehavior | undefined,
        schema: db3.xTable,
        allowInsertFromString?: boolean | undefined;
        onInsert?: undefined | ((newObj: T) => void);
    },
    selectedValue: T | Tnull, // support null no matter what
    filterText: string,
    fetchSet: "all" | "selected",
) => {

    type TX = {
        option: T;
        info: db3.RowInfo;
    };

    const ctx = useDashboardContext();
    const snackbar = useSnackbar();
    const publicData = useAuthenticatedSession();

    const [allOptionsX, setAllOptionsX] = React.useState<TX[]>([]);

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
    const selectedItemInfo = isNullSelected ? undefined : props.schema.getRowInfo(selectedValue!);

    const isSelected = (optionInfo: db3.RowInfo): boolean => {
        return !isNullSelected && optionInfo.pk === selectedItemInfo!.pk;
    };

    const makeTX = (option: T): TX => {
        const info = props.schema.getRowInfo(option);
        return {
            option,
            info,
        };
    };

    const filterModel: CMDBTableFilterModel = {
        items: [],
        quickFilterValues: SplitQuickFilter(filterText || ""),
    };

    const selectedInfo = selectedValue ? props.schema.getRowInfo(selectedValue) : undefined;

    if (fetchSet === "selected" && selectedValue) {
        filterModel.pks = [selectedInfo!.pk];
    }

    const queryStatus = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        filterModel,
        delayMS: 500, // TODO: remove.
    });

    React.useEffect(() => {
        setAllOptionsX(queryStatus.items.map(option => makeTX(option))); // this line causes an infinite refresh
    }, [queryStatus.queryResult?.dataUpdatedAt]);

    const insMutation = DB3Client.useInsertMutationClient(props.schema);
    const insertAuthorized = props.schema.authorizeRowBeforeInsert({ clientIntention: ctx.userClientIntention, publicData });
    let allowInsertFromString = CoalesceBool(props.allowInsertFromString, true);
    if (allowInsertFromString) {
        if (!insertAuthorized) {
            allowInsertFromString = false;
            //console.warn(`You want to insert from string, but not authorized to do so.`);
        }
        if (!props.schema.createInsertModelFromString) {
            allowInsertFromString = false;
            //console.warn(`You want to insert from string, but the schema '${props.schema.tableID}' does not implement createInsertModelFromString.`);
        }
    }

    const doInsert = async () => {
        try {
            const model = props.schema.createInsertModelFromString!(filterText || "") as T;
            if (!model) throw new Error(`model couldn't be created`);
            const newObj = await insMutation.doInsertMutation(model) as T;
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            props.onInsert && props.onInsert(newObj);
            return newObj;
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        } finally {
            queryStatus.refetch();
        }
    };

    const filterMatchesAnyItemsExactly = allOptionsX.some(item => props.schema.doesItemExactlyMatchText(item.option, filterText));

    return {
        allowNull,
        nullValue,
        isNullSelected,
        selectedItemInfo,

        isSelected,
        makeTX,
        isLoading: queryStatus.isLoading,

        allOptionsX,
        selectedOptionX: isNullSelected ? undefined : {
            option: selectedValue!,
            info: selectedInfo!,
        },
        queryStatus,
        doInsert,
        allowInsertFromString,
        filterMatchesAnyItemsExactly,
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DB3SingleSelectDialogBaseProps<T extends TAnyModel> {
    //    nullBehavior?: CMSelectNullBehavior | undefined;
    schema: db3.xTable,

    value?: T | null | undefined;
    onOK: (value: T | Tnull) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    renderOption?: ((value: T) => React.ReactNode) | undefined;

    closeOnSelect?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: T) => void);
};

interface Db3SingleSelectDialogPropsNotAllowingNull<Toption extends TAnyModel> extends DB3SingleSelectDialogBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    onOK: (option: Toption) => void;
}

interface Db3SingleSelectDialogPropsAllowingNull<Toption extends TAnyModel> extends DB3SingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    onOK: (option: Toption | null) => void;
}

interface Db3SingleSelectDialogPropsAllowingUndefined<Toption extends TAnyModel> extends DB3SingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    onOK: (option: Toption | undefined) => void;
}

type Db3SingleSelectDialogProps<Toption extends TAnyModel> =
    | Db3SingleSelectDialogPropsNotAllowingNull<Toption>
    | Db3SingleSelectDialogPropsAllowingNull<Toption>
    | Db3SingleSelectDialogPropsAllowingUndefined<Toption>;

export function DB3SingleSelectDialog<T extends TAnyModel>(props: Db3SingleSelectDialogProps<T>) {
    const closeOnSelect = CoalesceBool(props.closeOnSelect, true);
    const [selectedOption, setSelectedOption] = React.useState<T | Tnull>(props.value); // this is a modal dialog to select an item so on first open, even without nullable behavior, nulls can be specified.

    const [filterText, setFilterText] = React.useState("");
    const ssl = useDB3SingleSelectLogic({
        ...props, onInsert: (newObj) => {
            setSelectedOption(newObj);
            props.onInsert && props.onInsert(newObj);
        }
    }, selectedOption, filterText, "all");
    type TX = typeof ssl.allOptionsX[0];

    const allowQuickFilter = CoalesceBool(props.allowQuickFilter, true);

    const renderOption = (x: TX) => {
        if (props.renderOption) {
            return props.renderOption(x.option);
        }
        return x.info.name;
    };

    const renderChip = (x: TX, onClick: (() => void) | undefined, onDelete: (() => void) | undefined) => {
        return <CMChip
            key={x.info.pk}
            onClick={onClick}
            onDelete={onDelete}

            color={x.info.color}
            shape={props.chipShape}
            size={props.chipSize}
            variation={{ ...StandardVariationSpec.Strong, selected: ssl.isSelected(x.info) }}
        >
            {renderOption(x)}
        </CMChip>;
    };

    return <ReactiveInputDialog onCancel={props.onCancel}>
        <DialogTitle>
            {props.title}
            {ssl.isLoading && <CircularProgress />}
            <Box sx={{ p: 0 }}>
                Selected: {ssl.isNullSelected ? "<none>" : renderChip(ssl.selectedOptionX!, undefined, () => setSelectedOption(ssl.nullValue))}
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {props.description}
            </CMDialogContentText>

            {allowQuickFilter && <Box>
                <SearchInput
                    onChange={(v) => setFilterText(v)}
                    value={filterText}
                //autoFocus={true} // see #408
                />
            </Box>}

            {
                !!filterText.length && !ssl.filterMatchesAnyItemsExactly && ssl.allowInsertFromString && (
                    <Box><Button
                        size="small"
                        startIcon={gIconMap.Add()}
                        onClick={ssl.doInsert}
                    >
                        add {filterText}
                    </Button>
                    </Box>
                )
            }

            {ssl.allOptionsX.length === 0 ? (
                <Box>Nothing here</Box>
            ) : (
                <CMChipContainer orientation="vertical">
                    {ssl.allOptionsX.map(item =>
                        renderChip(item, () => {
                            setSelectedOption(item.option);
                            closeOnSelect && props.onOK(item.option);
                        }, undefined)
                    )}
                </CMChipContainer>
            )}

            <DialogActionsCM>
                <Button onClick={props.onCancel}>Cancel</Button>
                <Button onClick={() => { props.onOK(selectedOption as any); }} disabled={!ssl.allowNull && !selectedOption}>OK</Button>
            </DialogActionsCM>
        </DialogContent>

    </ReactiveInputDialog>
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const useDB3MultiSelectLogic = <T extends TAnyModel,>(
    props: {
        schema: db3.xTable,
        onInsert?: undefined | ((newObj: T) => void),
        allowInsertFromString?: boolean | undefined;
    },
    selectedOptions: T[],
    filterText: string,
    fetchSet: "all" | "selected",
) => {

    type TX = {
        option: T;
        info: db3.RowInfo;
    };

    const ctx = useDashboardContext();
    const snackbar = useSnackbar();
    const publicData = useAuthenticatedSession();

    const [allOptionsX, setAllOptionsX] = React.useState<TX[]>([]);

    const makeTX = (option: T): TX => {
        const info = props.schema.getRowInfo(option);
        return {
            option,
            info,
        };
    };

    const filterModel: CMDBTableFilterModel = {
        items: [],
        quickFilterValues: SplitQuickFilter(filterText || ""),
    };

    if (fetchSet === "selected") {
        filterModel.pks = selectedOptions.map(o => o[props.schema.pkMember]);
    }

    const queryStatus = DB3Client.fetchUnsuspended<T>({
        clientIntention: ctx.userClientIntention,
        schema: props.schema,
        filterModel,
        delayMS: 500, // TODO: remove.
    });

    const [selectedOptionsX, setSelectedOptionsX] = React.useState<TX[]>([]);

    React.useEffect(() => {
        setAllOptionsX(queryStatus.items.map(option => makeTX(option)));
        setSelectedOptionsX(selectedOptions.map(s => makeTX(s)));
    }, [queryStatus.queryResult?.dataUpdatedAt, selectedOptions]);

    const isSelected = (optionInfo: db3.RowInfo): boolean => {
        return selectedOptionsX.some(sx => sx.info.pk === optionInfo.pk);
    };

    const toggleSelection = (x: TX): T[] => {
        if (isSelected(x.info)) {
            const ret = selectedOptionsX.filter(alreadySelected => alreadySelected.info.pk !== x.info.pk);
            return ret.map(o => o.option);
        }
        const ret = [...selectedOptions, x.option];
        return ret;
    };

    const insMutation = DB3Client.useInsertMutationClient(props.schema);
    const insertAuthorized = props.schema.authorizeRowBeforeInsert({ clientIntention: ctx.userClientIntention, publicData });
    let allowInsertFromString = CoalesceBool(props.allowInsertFromString, true);
    if (allowInsertFromString) {
        if (!insertAuthorized) {
            allowInsertFromString = false;
            //console.warn(`You want to insert from string, but not authorized to do so.`);
        }
        if (!props.schema.createInsertModelFromString) {
            allowInsertFromString = false;
            //console.warn(`You want to insert from string, but the schema '${props.schema.tableID}' does not implement createInsertModelFromString.`);
        }
    }
    const filterMatchesAnyItemsExactly = allOptionsX.some(item => props.schema.doesItemExactlyMatchText(item.option, filterText));

    const doInsert = async () => {
        try {
            const model = props.schema.createInsertModelFromString!(filterText || "") as T;
            if (!model) throw new Error(`model couldn't be created`);
            const newObj = await insMutation.doInsertMutation(model) as T;
            snackbar.showMessage({ children: "created new success", severity: 'success' });
            props.onInsert && props.onInsert(newObj);
            return newObj;
        } catch (err) {
            console.log(err);
            snackbar.showMessage({ children: "create error", severity: 'error' });
        } finally {
            queryStatus.refetch();
        }
    };

    return {
        isSelected,
        makeTX,
        isLoading: queryStatus.isLoading,

        allOptionsX,
        selectedOptionsX,
        queryStatus,
        toggleSelection,
        allowInsertFromString,
        filterMatchesAnyItemsExactly,
        doInsert,
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface DB3MultiSelectDialogProps<T extends TAnyModel> {
    schema: db3.xTable,

    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    renderOption?: ((value: T) => React.ReactNode) | undefined;

    initialValues?: T[] | undefined;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: T) => void);
};


export function DB3MultiSelectDialog<T extends TAnyModel>(props: DB3MultiSelectDialogProps<T>) {

    const [filterText, setFilterText] = React.useState("");
    const [selectedOptions, setSelectedOptions] = React.useState<T[]>(props.initialValues || []);

    const msl = useDB3MultiSelectLogic({
        ...props, onInsert: (newObj) => {
            setSelectedOptions([...selectedOptions, newObj]);
            props.onInsert && props.onInsert(newObj);
        }
    }, selectedOptions, filterText, "all");
    type TX = typeof msl.allOptionsX[0];

    const renderOption = (x: TX) => {
        if (props.renderOption) {
            return props.renderOption(x.option);
        }
        return x.info.name;
    };

    const renderChip = (x: TX) => {
        return (
            <CMChip
                key={x.info.pk}
                onClick={() => setSelectedOptions(msl.toggleSelection(x))}
                color={x.info.color}
                tooltip={x.info.tooltip}
                shape={props.chipShape}
                size={props.chipSize}
                variation={{ ...StandardVariationSpec.Strong, selected: msl.isSelected(x.info) }}
            >
                {renderOption(x)}
            </CMChip>
        );
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
                    !!filterText.length && !msl.filterMatchesAnyItemsExactly && msl.allowInsertFromString && (
                        <Box><Button
                            size="small"
                            startIcon={gIconMap.Add()}
                            onClick={msl.doInsert}
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
                    <Button onClick={props.onCancel}>Cancel</Button>
                    <Button onClick={() => { props.onOK(selectedOptions); }}>OK</Button>
                </DialogActionsCM>
            </DialogContent>
        </ReactiveInputDialog>
    );
}
