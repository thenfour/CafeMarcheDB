import React from "react";
import { CMChipShapeOptions, CMChipSizeOptions } from "../CMChip";
import { SelectionPicker } from "./SelectionPicker";
import { CMSelectNullBehavior, SelectionItemInfo, makeAsyncSelectionSource, singleSelectionValue, withNullSelection } from "./selectionSource";
export { CMSelectNullBehavior } from "./selectionSource";
type Tnull = null | undefined;
type ItemInfo = SelectionItemInfo;

export interface CMSingleSelectDialogBaseProps<T> {
    value?: T | Tnull;
    onOK: (value: T | Tnull) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode;

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
    renderOption: (value: T) => React.ReactNode;
    renderNullOption?: () => React.ReactNode;

    closeOnSelect?: boolean;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: T, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<T>; // similar
};

interface CMSingleSelectDialogBasePropsNotAllowingNull<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    value?: Toption;
    onOK: (value: Toption) => void;
}

interface CMSingleSelectDialogBasePropsAllowingNull<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    value?: Toption | null;
    onOK: (value: Toption | null) => void;
}

interface CMSingleSelectDialogBasePropsAllowingUndefined<Toption> extends CMSingleSelectDialogBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    value?: Toption | undefined;
    onOK: (value: Toption | undefined) => void;
}

type CMSingleSelectDialogProps<Toption> =
    | CMSingleSelectDialogBasePropsNotAllowingNull<Toption>
    | CMSingleSelectDialogBasePropsAllowingNull<Toption>
    | CMSingleSelectDialogBasePropsAllowingUndefined<Toption>;

export function CMSingleSelectDialog<T>(props: CMSingleSelectDialogProps<T>) {
    const source = withNullSelection(makeAsyncSelectionSource(props), props.nullBehavior, props.renderNullOption);
    const onOK = props.onOK as (value: T | Tnull) => void;
    return <SelectionPicker {...props} source={source} value={singleSelectionValue(props.value, props.nullBehavior)} onAccept={values => onOK(values[0])} />;
}
