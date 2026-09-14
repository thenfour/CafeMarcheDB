import React from "react";
import { CMChipShapeOptions, CMChipSizeOptions } from "../CMChip";
import { CMSelectDisplayStyle, SelectionField } from "./SelectionField";
import { CMSelectNullBehavior, SelectionItemInfo, makeAsyncSelectionSource, singleSelectionValue, withNullSelection } from "./selectionSource";
export { CMSelectDisplayStyle } from "./SelectionField";
type Tnull = null | undefined;
type ItemInfo = SelectionItemInfo;

interface CMMultiSelectProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Promise<Toption[]> | Toption[];
    value: Toption[];
    onChange: (options: Toption[]) => void;
    getOptionInfo: (item: Toption) => ItemInfo;
    renderOption: (item: Toption) => React.ReactNode;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    displayStyle?: CMSelectDisplayStyle | undefined;
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: Toption, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<Toption>; // similar

    className?: string | undefined;
};

export const CMMultiSelect = <Toption,>(props: CMMultiSelectProps<Toption>) => <SelectionField
    {...props} multiple source={makeAsyncSelectionSource(props)} className={`CMMultiSelect ${props.className || ""}`} />;

interface CMSingleSelectBaseProps<Toption> {
    getOptions: (args: { quickFilter: string | undefined }) => Promise<Toption[]> | Toption[];
    value: Toption | Tnull;
    onChange: (option: Toption | Tnull) => void;
    renderOption: (item: Toption) => React.ReactNode;
    renderNullOption?: () => React.ReactNode;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom
    getOptionInfo: (item: Toption) => ItemInfo;

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    displayStyle?: CMSelectDisplayStyle | undefined;
    readonly?: boolean;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    doesItemExactlyMatchText?: (item: Toption, filterText: string) => boolean; // if this is a tags or foreign single field, the db3client column implements this
    doInsertFromString?: (userInput: string) => Promise<Toption>; // similar

    className?: string | undefined;
};

interface CMSingleSelectPropsNotAllowingNull<Toption> extends CMSingleSelectBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    value: Toption;
    onChange: (option: Toption) => void;
}

interface CMSingleSelectPropsAllowingNull<Toption> extends CMSingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    value: Toption | null;
    onChange: (option: Toption | null) => void;
}

interface CMSingleSelectPropsAllowingUndefined<Toption> extends CMSingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    value: Toption | undefined;
    onChange: (option: Toption | undefined) => void;
}

type CMSingleSelectProps<Toption> =
    | CMSingleSelectPropsNotAllowingNull<Toption>
    | CMSingleSelectPropsAllowingNull<Toption>
    | CMSingleSelectPropsAllowingUndefined<Toption>;

export const CMSingleSelect = <Toption,>(props: CMSingleSelectProps<Toption>) => {
    const source = withNullSelection(makeAsyncSelectionSource(props), props.nullBehavior, props.renderNullOption);
    const onChange = props.onChange as (value: Toption | Tnull) => void;
    return <SelectionField {...props} source={source} value={singleSelectionValue(props.value, props.nullBehavior)}
        onChange={values => onChange(values[0])} className={`CMSingleSelect ${props.className || ""}`} />;
};

export const StringArrayOptionsProvider = <T extends (number | string),>(x: T[]) => ({
    getOptions: () => x,
    getOptionInfo: (option: T) => ({ id: option as T }),
    renderOption: (option: T): React.ReactNode => option,
});
