import { Button } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { CMSelectItemDialog2 } from './CMSelectForeignItemDialog';
import { CMFieldSpecBase, RenderForNewItemDialogArgs, ValidateAndParseResult } from "./CMColumnSpec";


export type InsertFromStringParams<T> = {
    mutation: any,
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    onDelete?: () => void;
}

interface ForeignSingleFieldArgs<ForeignModel> {
    member: string,
    fkidMember: string,
    label: string,
    cellWidth: number,
    allowNull: boolean, // not sure if it's possible to infer this from a zod schema or not ... simple to put here anyway.
    foreignPk: string, // i guess this is always "id".
    getAllOptionsQuery: any,

    // for filtering a list of the foreign items, fetched by getAllOptionsQuery
    getForeignQuickFilterWhereClause: (query: string) => any,

    // when filtering a list, we only show the "Add new item 'text'" when it doesn't match an existing item already. This is therefore required.
    doesItemExactlyMatchText: (item: ForeignModel, filterText: string) => boolean,

    allowInsertFromString: boolean,
    insertFromStringMutation: any,
    insertFromString: ((params: InsertFromStringParams<ForeignModel>) => Promise<ForeignModel>), // create an object from string asynchronously.
    insertFromStringSchema: any,

    // should render a <li {...props}> for autocomplete
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: ForeignModel, selected: boolean) => React.ReactElement;

    // also for autocomplete
    renderAsChip: (args: RenderAsChipParams<ForeignModel>) => React.ReactElement;
};

export interface ForeignSingleFieldInputProps<DBModel, ForeignModel> {
    field: ForeignSingleField<DBModel, ForeignModel>;
    value: ForeignModel | null;
    onChange: (value: ForeignModel | null) => void;
};

// general use "edit cell" for foreign single values
export const ForeignSingleFieldInput = <DBModel, ForeignModel,>(props: ForeignSingleFieldInputProps<DBModel, ForeignModel>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<ForeignModel | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const chip = props.field.args.renderAsChip({
        value: props.value,
        onDelete: () => {
            props.onChange(null);
        },
    });

    return <div>
        {chip}
        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.field.args.label}</Button>
        {isOpen && <CMSelectItemDialog2
            value={props.value}
            spec={props.field}
            onOK={(newValue: ForeignModel | null) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                props.onChange(oldValue || null);
                setIsOpen(false);
            }}
        />
        }
    </div>;
};

// a single-selection foreign object (one-to-one or one-to-many)
export abstract class ForeignSingleField<DBModel, ForeignModel> extends CMFieldSpecBase<DBModel> {

    args: ForeignSingleFieldArgs<ForeignModel>;

    constructor(args: ForeignSingleFieldArgs<ForeignModel>) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = args.fkidMember;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = null;
        this.zodSchema = null;
    }

    // only validation is currently checking null.
    ValidateAndParse = (val: any): ValidateAndParseResult => {
        if (val === null || val === undefined) {
            if (!this.args.allowNull) {
                return {
                    parsedValue: null,
                    success: false,
                    errorMessage: `${this.member} is required`,
                };
            }
        }
        return {
            parsedValue: val,
            success: true,
            errorMessage: "",
        };
    };

    isEqual = (a: any, b: any) => {
        const anull = (a === null || a === undefined);
        const bnull = (b === null || b === undefined);
        if (anull && bnull) return true;
        if (anull !== bnull) return false;
        // both non-null.
        return a[this.args.foreignPk] === b[this.args.foreignPk];
    };

    // child classes must implement:
    // getQuickFilterWhereClause = (query: string) => {
    //     ...
    // };

    // view: render as a single chip
    renderForEditGridView = (params: GridRenderCellParams): React.ReactElement => {
        return this.args.renderAsChip({
            value: params.value,
        });
    };

    // edit cell
    renderForEditGridEdit = (params: GridRenderEditCellParams): React.ReactElement => {
        return <ForeignSingleFieldInput
            field={this}
            value={params.value}
            onChange={(value) => {
                params.api.setEditCellValue({ id: params.id, field: this.args.member, value }).then(() => {
                    params.api.setEditCellValue({ id: params.id, field: this.args.fkidMember, value: ((value === null) ? null : (value![this.args.foreignPk])) });
                });
            }}
        />;
    }

    // edit: render as single chip with "SELECT..." and a github style autocomplete.
    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        return <ForeignSingleFieldInput
            field={this}
            value={params.value}
            onChange={(value: ForeignModel | null) => {
                let pk = null;
                params.api.setFieldValues({
                    [this.member]: value,
                    [this.args.fkidMember]: ((value === null) ? null : value![this.args.foreignPk]),
                });
            }}
        />
    };
};

