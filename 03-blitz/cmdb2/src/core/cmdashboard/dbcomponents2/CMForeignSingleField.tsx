import { Button, InputLabel } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { CMSelectItemDialog2 } from './CMSelectForeignItemDialog';
import { CMFieldSpecBase, RenderForNewItemDialogArgs, ValidateAndParseResult } from "./CMColumnSpec";

export type InsertFromStringParams = {
    mutation: any, // async mutation(input)
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    onDelete?: () => void;
}

export interface CMSelectItemDialogSpec<ItemModel, ItemWhereInput> {
    label: string;
    pkMember: string, // i guess this is always "id".

    getQuickFilterWhereClause: (query: string) => ItemWhereInput;
    getAllOptionsQuery: any,

    allowInsertFromString: boolean,
    insertFromStringMutation: any,
    insertFromString: ((params: InsertFromStringParams) => Promise<ItemModel>), // create an object from string asynchronously.

    doesItemExactlyMatchText: (item: ItemModel, filterText: string) => boolean,

    renderAsChip: (args: RenderAsChipParams<ItemModel>) => React.ReactElement;
    // should render a <li {...props}> for autocomplete
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: ItemModel, selected: boolean) => React.ReactElement;
};

interface ForeignSingleFieldArgs<ForeignModel, ForeignWhereInput> {
    foreignSpec: CMSelectItemDialogSpec<ForeignModel, ForeignWhereInput>;

    member: string,
    fkidMember: string,

    cellWidth: number,
    allowNull: boolean, // not sure if it's possible to infer this from a zod schema or not ... simple to put here anyway.
};

export interface ForeignSingleFieldInputProps<DBModel, ForeignModel, LocalWhereInput, ForeignWhereInput> {
    field: ForeignSingleField<DBModel, ForeignModel, LocalWhereInput, ForeignWhereInput>;
    value: ForeignModel | null;
    onChange: (value: ForeignModel | null) => void;
};

// general use "edit cell" for foreign single values
export const ForeignSingleFieldInput = <DBModel, ForeignModel, LocalWhereInput, ForeignWhereInput>(props: ForeignSingleFieldInputProps<DBModel, ForeignModel, LocalWhereInput, ForeignWhereInput>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<ForeignModel | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const chip = props.field.args.foreignSpec.renderAsChip({
        value: props.value,
        onDelete: () => {
            props.onChange(null);
        },
    });

    return <div>
        {chip}
        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.field.args.foreignSpec.label}</Button>
        {isOpen && <CMSelectItemDialog2
            value={props.value}
            spec={props.field.args.foreignSpec}
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
export abstract class ForeignSingleField<DBModel, ForeignModel, LocalWhereInput, ForeignWhereInput> extends CMFieldSpecBase<DBModel, LocalWhereInput, ForeignModel | null> {

    args: ForeignSingleFieldArgs<ForeignModel, ForeignWhereInput>;

    constructor(args: ForeignSingleFieldArgs<ForeignModel, ForeignWhereInput>) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = args.fkidMember;
        this.columnHeaderText = args.foreignSpec.label;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = null;
        this.zodSchema = null;
    }

    // only validation is currently checking null.
    ValidateAndParse = (val: ForeignModel | null): ValidateAndParseResult<ForeignModel | null> => {
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

    // view: render as a single chip
    renderForEditGridView = (params: GridRenderCellParams): React.ReactElement => {
        return this.args.foreignSpec.renderAsChip({
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
                    params.api.setEditCellValue({ id: params.id, field: this.args.fkidMember, value: ((value === null) ? null : (value![this.args.foreignSpec.pkMember])) });
                });
            }}
        />;
    }

    // edit: render as single chip with "SELECT..." and a github style autocomplete.
    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel, ForeignModel | null>) => {
        return <React.Fragment key={params.key}>
            <InputLabel>{this.args.foreignSpec.label}</InputLabel>
            <ForeignSingleFieldInput
                field={this}
                value={params.value}
                onChange={(value: ForeignModel | null) => {
                    let pk = null;
                    params.api.setFieldValues({
                        [this.member]: value,
                        [this.args.fkidMember]: ((value === null) ? null : value![this.args.foreignSpec.pkMember]),
                    });
                }}
            />
        </React.Fragment>;
    };
};

