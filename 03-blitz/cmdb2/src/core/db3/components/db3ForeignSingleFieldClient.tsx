'use client';

import React from "react";
import * as db3 from "../db3";
import * as DB3Client from "../DB3Client";
import { Button, Chip, FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import { gNullValue } from "shared/utils";
import { GridFilterModel, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { SelectSingleForeignDialog } from "./db3SelectSingleForeignDialog";
import { useMutation, useQuery } from "@blitzjs/rpc";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { gNullColorPaletteEntry } from "shared/color";


export type InsertFromStringParams = {
    mutation: any, // async mutation(input)
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    onDelete?: () => void;
    onClick?: () => void;
}

export interface ForeignSingleFieldInputProps<TForeign> {
    foreignSpec: ForeignSingleFieldClient<TForeign>;
    value: TForeign | null;
    onChange: (value: TForeign | null) => void;
    validationError: string | null;
};

// general use "edit cell" for foreign single values
export const ForeignSingleFieldInput = <TForeign,>(props: ForeignSingleFieldInputProps<TForeign>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<TForeign | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const chip = props.foreignSpec.args.renderAsChip!({
        value: props.value,
        onDelete: () => {
            props.onChange(null);
        },
    });

    return <div className={props.validationError ? "chipContainer validationError" : "chipContainer validationSuccess"}>
        {chip}
        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.foreignSpec.typedSchemaColumn.label}</Button>
        {isOpen && <SelectSingleForeignDialog
            value={props.value}
            spec={props.foreignSpec}
            onOK={(newValue: TForeign | null) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                props.onChange(oldValue || null);
                setIsOpen(false);
            }}
        />
        }
        {props.validationError && <FormHelperText children={props.validationError} />}
    </div>;
};

export interface ForeignSingleFieldClientArgs<TForeign> {
    columnName: string;
    cellWidth: number;

    renderAsChip?: (args: RenderAsChipParams<TForeign>) => React.ReactElement;

    // should render a <li {...props}> for autocomplete
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TForeign, selected: boolean) => React.ReactElement;
};

// the client-side description of the field, used in xTableClient construction.
export class ForeignSingleFieldClient<TForeign> extends DB3Client.IColumnClient {
    typedSchemaColumn: db3.ForeignSingleField<TForeign>;
    args: ForeignSingleFieldClientArgs<TForeign>;

    constructor(args: ForeignSingleFieldClientArgs<TForeign>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
        });
        this.args = args;
    }

    defaultRenderAsChip = (args: RenderAsChipParams<TForeign>) => {
        if (!args.value) {
            return <>--</>;
        }

        const rowInfo = this.typedSchemaColumn.foreignTableSpec.getRowInfo(args.value);

        const style: React.CSSProperties = {};
        const color = rowInfo.color || gNullColorPaletteEntry;// this.typedSchemaColumn.getChipColor!(args.value);
        if (color.value != null) {
            style.backgroundColor = color.value!;
            style.color = color.contrastColor!;
            style.border = `1px solid ${color.outline ? color.contrastColor! : color.value!}`;
        }

        return <Chip
            className="cmdbChip"
            style={style}
            size="small"
            //label={`${this.typedSchemaColumn.getChipCaption!(args.value)}`}
            label={rowInfo.name}
            onDelete={args.onDelete}
        />;
    };

    defaultRenderAsListItem = (props, value, selected) => {
        console.assert(value != null);
        //const rowInfo = this.typedSchemaColumn.foreignTableSpec.getRowInfo(value);
        //console.assert(!!this.typedSchemaColumn.getChipCaption);
        const chip = this.defaultRenderAsChip({ value });
        return <li {...props}>
            {selected && <DoneIcon />}
            {chip}
            {/* {this.typedSchemaColumn.getChipCaption!(value)} */}
            {/* {this.typedSchemaColumn.getChipDescription && this.typedSchemaColumn.getChipDescription!(value)} */}
            {selected && <CloseIcon />}
        </li>
    };

    onSchemaConnected = () => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;

        if (!this.args.renderAsChip) {
            // create a default renderer.
            this.args.renderAsChip = (args: RenderAsChipParams<TForeign>) => this.defaultRenderAsChip(args);
        }
        if (!this.args.renderAsListItem) {
            // create a default renderer.
            this.args.renderAsListItem = (props, value, selected) => this.defaultRenderAsListItem(props, value, selected);
        }

        this.GridColProps = {
            renderCell: (args: GridRenderCellParams) => {
                return <div className='MuiDataGrid-cellContent'>{this.args.renderAsChip!({ value: args.value })}</div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse(params.value);
                return <ForeignSingleFieldInput
                    validationError={vr.success ? null : vr.errorMessage || null}
                    foreignSpec={this}
                    value={params.value}
                    onChange={(value) => {
                        params.api.setEditCellValue({ id: params.id, field: this.args.columnName, value });//.then(() => {
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => {
        return <React.Fragment key={params.key}>
            {/* <InputLabel>{this.schemaColumn.label}</InputLabel> */}
            <ForeignSingleFieldInput
                foreignSpec={this}
                validationError={params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null}
                value={params.value}
                onChange={(value: TForeign | null) => {
                    params.api.setFieldValues({
                        [this.args.columnName]: value,
                    });
                }}
            />
        </React.Fragment>;
    };
};

export interface ForeignSingleFieldRenderContextArgs<TForeign> {
    spec: ForeignSingleFieldClient<TForeign>;
    filterText: string;
};

// the "live" adapter handling server-side comms.
export class ForeignSingleFieldRenderContext<TForeign> {
    args: ForeignSingleFieldRenderContextArgs<TForeign>;
    mutateFn: DB3Client.TMutateFn;

    items: TForeign[];
    refetch: () => void;

    constructor(args: ForeignSingleFieldRenderContextArgs<TForeign>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as DB3Client.TMutateFn;
        }

        const where = { AND: [] as any[] };
        if (args.filterText) {
            const tokens = args.filterText.split(/\s+/).filter(token => token.length > 0);
            const quickFilterItems = tokens.map(q => {
                //const OR = args.spec.typedSchemaColumn.getForeignQuickFilterWhereClause(q);
                const OR = args.spec.typedSchemaColumn.foreignTableSpec.GetQuickFilterWhereClauseExpression(q);
                if (!OR) return null;
                return {
                    OR,
                };
            });
            where.AND.push(...quickFilterItems.filter(i => i !== null));
        }

        const [items, { refetch }]: [TForeign[], any] = useQuery(db3queries, {
            tableName: args.spec.typedSchemaColumn.foreignTableSpec.tableName,
            orderBy: undefined,
            where,
        });
        this.items = items;
        this.refetch = refetch;
    }

    doInsertFromString = async (userInput: string): Promise<TForeign> => {
        console.assert(!!this.args.spec.typedSchemaColumn.foreignTableSpec.createInsertModelFromString);
        const insertModel = this.args.spec.typedSchemaColumn.foreignTableSpec.createInsertModelFromString!(userInput);
        try {
            return await this.mutateFn({
                tableName: this.args.spec.typedSchemaColumn.foreignTableSpec.tableName,
                insertModel,
            }) as TForeign;
        } catch (e) {
            // ?
            throw e;
        }
    };
};

export const useForeignSingleFieldRenderContext = <TForeign,>(args: ForeignSingleFieldRenderContextArgs<TForeign>) => {
    return new ForeignSingleFieldRenderContext<TForeign>(args);
};

