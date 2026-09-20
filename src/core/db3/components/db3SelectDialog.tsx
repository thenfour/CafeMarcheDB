import React from "react";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { SelectionPicker } from "src/core/components/select/SelectionPicker";
import { CMSelectNullBehavior, singleSelectionValue, withNullSelection } from "src/core/components/select/selectionSource";
import { TAnyModel } from "@/shared/rootroot";
import * as db3 from "../db3";
import { useDB3SelectionSource } from "./useDB3SelectionSource";
type Tnull = null | undefined;

export interface DB3SingleSelectDialogBaseProps<T extends TAnyModel> {
    //    nullBehavior?: CMSelectNullBehavior | undefined;
    schema: db3.xTable,
    view?: db3.AnyDB3CrudView;

    value?: T | null | undefined;
    onOK: (value: T | Tnull) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode;

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
    const source = withNullSelection(useDB3SelectionSource(props), props.nullBehavior);
    const onOK = props.onOK as (value: T | Tnull) => void;
    return <SelectionPicker {...props} source={source} value={singleSelectionValue(props.value, props.nullBehavior)} onAccept={values => onOK(values[0])} />;
}

export interface DB3MultiSelectDialogProps<T extends TAnyModel> {
    schema: db3.xTable,
    view?: db3.AnyDB3CrudView;

    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode;

    renderOption?: ((value: T) => React.ReactNode) | undefined;

    initialValues?: T[] | undefined;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: T) => void);
};


export function DB3MultiSelectDialog<T extends TAnyModel>(props: DB3MultiSelectDialogProps<T>) {
    return <SelectionPicker {...props} multiple source={useDB3SelectionSource(props)} value={props.initialValues || []} onAccept={props.onOK} />;
}
