import React from "react";
import { CMChipShapeOptions, CMChipSizeOptions } from "../CMChip";
import { SelectionPicker } from "./SelectionPicker";
import { SelectionItemInfo, makeAsyncSelectionSource } from "./selectionSource";
type ItemInfo = SelectionItemInfo;

export interface CMMultiSelectDialogProps<T> {
    onOK: (value: T[]) => void;
    onCancel: () => void;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    getOptions: (args: { quickFilter: string | undefined }) => Promise<T[]> | T[];
    getOptionInfo: (item: T) => ItemInfo;
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
    return <SelectionPicker {...props} multiple source={makeAsyncSelectionSource(props)} value={props.initialValues || []} onAccept={props.onOK} />;
}
