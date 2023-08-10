'use client';

import React from "react";
import * as db3 from "../db3";
//import db3queries from "../queries/db3queries";
import { Button, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import { gNullValue } from "shared/utils";
import * as db3client from "./db3Client";
import { GridFilterModel, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { SelectSingleForeignDialog } from "./db3SelectSingleForeignDialog";
import { useMutation, useQuery } from "@blitzjs/rpc";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";


export type InsertFromStringParams = {
    mutation: any, // async mutation(input)
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    onDelete?: () => void;
}

export interface ForeignSingleFieldInputProps<TForeign> {
    foreignSpec: ForeignSingleFieldFieldClient<TForeign>;
    value: TForeign | null;
    onChange: (value: TForeign | null) => void;
};

// general use "edit cell" for foreign single values
export const ForeignSingleFieldInput = <TForeign,>(props: ForeignSingleFieldInputProps<TForeign>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<TForeign | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const chip = props.foreignSpec.args.renderAsChip({
        value: props.value,
        onDelete: () => {
            props.onChange(null);
        },
    });

    return <div>
        {chip}
        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.foreignSpec.schemaColumn.label}</Button>
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
    </div>;
};

export interface ForeignSingleFieldClientArgs<TForeign> {
    columnName: string;
    cellWidth: number;

    renderAsChip: (args: RenderAsChipParams<TForeign>) => React.ReactElement;

    // should render a <li {...props}> for autocomplete
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: TForeign, selected: boolean) => React.ReactElement;
};

// the client-side description of the field, used in xTableClient construction.
export class ForeignSingleFieldFieldClient<TForeign> extends db3client.IColumnClient {
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

    onSchemaConnected = () => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;

        this.GridColProps = {
            renderCell: (args: GridRenderCellParams) => {
                return this.args.renderAsChip({ value: args.value });
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                return <ForeignSingleFieldInput
                    foreignSpec={this}
                    value={params.value}
                    onChange={(value) => {
                        params.api.setEditCellValue({ id: params.id, field: this.args.columnName, value });//.then(() => {
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: db3client.RenderForNewItemDialogArgs) => {
        return <React.Fragment key={params.key}>
            <InputLabel>{this.schemaColumn.label}</InputLabel>
            <ForeignSingleFieldInput
                foreignSpec={this}
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
    spec: ForeignSingleFieldFieldClient<TForeign>;
    filterText: string;
};

// the "live" adapter handling server-side comms.
export class ForeignSingleFieldRenderContext<TForeign> {
    args: ForeignSingleFieldRenderContextArgs<TForeign>;
    mutateFn: db3client.TMutateFn;

    items: TForeign[];
    refetch: () => void;

    constructor(args: ForeignSingleFieldRenderContextArgs<TForeign>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as db3client.TMutateFn;
        }

        const where = { AND: [] as any[] };
        if (args.filterText) {
            const tokens = args.filterText.split(/\s+/).filter(token => token.length > 0);
            const quickFilterItems = tokens.map(q => {
                const OR = args.spec.typedSchemaColumn.getForeignQuickFilterWhereClause(q);
                if (!OR) return null;
                return {
                    OR,
                };
            });
            where.AND.push(...quickFilterItems.filter(i => i !== null));
            console.log(where.AND);
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
        //console.assert(!`todo`);
        const insertModel = this.args.spec.typedSchemaColumn.createInsertModelFromString(userInput);
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

