import React from "react";
import { CMChipShapeOptions, CMChipSizeOptions } from "src/core/components/CMChip";
import { CMSelectDisplayStyle, SelectionField } from "src/core/components/select/SelectionField";
import { CMSelectNullBehavior, singleSelectionValue, withNullSelection } from "src/core/components/select/selectionSource";
import { TAnyModel } from "@/shared/rootroot";
import * as db3 from "../db3";
import { useDB3SelectionSource } from "./useDB3SelectionSource";
type Tnull = null | undefined;

interface Db3SingleSelectBaseProps<Toption extends TAnyModel> {
    schema: db3.xTable,

    value: Toption | Tnull;
    onChange: (optionIds: Toption | Tnull) => void;

    renderOption?: ((item: Toption) => React.ReactNode) | undefined;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    readonly?: boolean;
    displayStyle?: CMSelectDisplayStyle | undefined;

    editButtonChildren?: React.ReactNode;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: Toption) => void);
};

interface Db3SingleSelectPropsNotAllowingNull<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior?: CMSelectNullBehavior.NonNullable | undefined;
    value: Toption;
    onChange: (option: Toption) => void;
}

interface Db3SingleSelectPropsAllowingNull<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowNull;
    value: Toption | null;
    onChange: (option: Toption | null) => void;
}

interface Db3SingleSelectPropsAllowingUndefined<Toption extends TAnyModel> extends Db3SingleSelectBaseProps<Toption> {
    nullBehavior: CMSelectNullBehavior.AllowUndefined;
    value: Toption | undefined;
    onChange: (option: Toption | undefined) => void;
}

type Db3SingleSelectProps<Toption extends TAnyModel> =
    | Db3SingleSelectPropsNotAllowingNull<Toption>
    | Db3SingleSelectPropsAllowingNull<Toption>
    | Db3SingleSelectPropsAllowingUndefined<Toption>;

export const DB3SingleSelect = <Toption extends TAnyModel,>(props: Db3SingleSelectProps<Toption>) => {
    const source = withNullSelection(useDB3SelectionSource(props), props.nullBehavior);
    const onChange = props.onChange as (value: Toption | Tnull) => void;
    return <SelectionField {...props} source={source} value={singleSelectionValue(props.value, props.nullBehavior)}
        onChange={values => onChange(values[0])} className="CMSingleSelect" />;
};

interface DB3MultiSelectProps<Toption extends TAnyModel> {
    schema: db3.xTable,

    value: Toption[];
    onChange: (optionIds: Toption[]) => void;
    renderOption?: ((item: Toption) => React.ReactNode) | undefined;
    customRender?: (onClick: () => void) => React.ReactNode; // for display style custom

    chipSize?: CMChipSizeOptions | undefined;
    chipShape?: CMChipShapeOptions | undefined;

    readonly?: boolean;
    displayStyle?: CMSelectDisplayStyle | undefined;

    editButtonChildren?: React.ReactNode | undefined;
    dialogTitle?: React.ReactNode;
    dialogDescription?: React.ReactNode;

    allowQuickFilter?: boolean;
    allowInsertFromString?: boolean | undefined;
    onInsert?: undefined | ((newObj: Toption) => void);
};


export const DB3MultiSelect = <Toption extends TAnyModel,>(props: DB3MultiSelectProps<Toption>) => <SelectionField
    {...props} multiple source={useDB3SelectionSource(props)} className="CMMultiSelect" />;
