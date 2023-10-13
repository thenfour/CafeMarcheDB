'use client';

import React from "react";
import * as db3 from "../db3";
import * as DB3Client from "../DB3Client";
import { Button, Chip, FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import { TAnyModel, gNullValue, gQueryOptions, parseIntOrNull } from "shared/utils";
import { GridFilterModel, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { SelectSingleForeignDialog } from "./db3SelectSingleForeignDialog";
import { useMutation, useQuery } from "@blitzjs/rpc";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { ColorVariationOptions } from "src/core/components/Color";


export type InsertFromStringParams = {
    mutation: any, // async mutation(input)
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    colorVariant: ColorVariationOptions;
    onDelete?: () => void;
    onClick?: () => void;
}

export interface ForeignSingleFieldInputProps<TForeign> {
    foreignSpec: ForeignSingleFieldClient<TForeign>;
    value: TForeign | null;
    onChange: (value: TForeign | null) => void;
    validationError?: string | null;
    readOnly: boolean;
    clientIntention: db3.xTableClientUsageContext,
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
        colorVariant: "strong",
        onDelete: props.readOnly ? undefined : (() => {
            props.onChange(null);
        }),
    });

    return <div className={`chipContainer ${props.validationError === undefined ? "" : (props.validationError === null ? "validationSuccess" : "validationError")}`}>
        {chip}
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.foreignSpec.typedSchemaColumn.label}</Button>
        {isOpen && <SelectSingleForeignDialog
            clientIntention={props.clientIntention}
            closeOnSelect={true}
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
        {props.validationError && <FormHelperText>{props.validationError}</FormHelperText>}
    </div>;
};

export interface ForeignSingleFieldClientArgs<TForeign> {
    columnName: string;
    cellWidth: number;

    // used for selecting new items. therefore mode:primary.
    clientIntention: db3.xTableClientUsageContext,

    renderAsChip?: (args: RenderAsChipParams<TForeign>) => React.ReactElement;

    // should render a <li {...props}> for autocomplete
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TForeign, selected: boolean) => React.ReactElement;
};

// the client-side description of the field, used in xTableClient construction.
export class ForeignSingleFieldClient<TForeign> extends DB3Client.IColumnClient {
    typedSchemaColumn: db3.ForeignSingleField<TForeign>;
    args: ForeignSingleFieldClientArgs<TForeign>;

    fixedValue: TForeign | null | undefined;

    constructor(args: ForeignSingleFieldClientArgs<TForeign>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
        });
        this.args = args;
        this.fixedValue = undefined; // for the moment it's not known.
    }

    defaultRenderAsChip = (args: RenderAsChipParams<TForeign>) => {
        if (!args.value) {
            return <>--</>;
        }

        const rowInfo = this.typedSchemaColumn.foreignTableSpec.getRowInfo(args.value);

        const style: React.CSSProperties = {};
        const color = rowInfo.color;
        if (color != null) {
            style.backgroundColor = color.strongValue;
            style.color = color.strongContrastColor;
            style.border = `1px solid ${color.strongOutline ? color.strongContrastColor : color.strongValue}`;
        }

        return <Chip
            className="cmdbChip"
            style={style}
            size="small"
            label={rowInfo.name}
            onDelete={args.onDelete}
        />;
    };

    defaultRenderAsListItem = (props, value, selected) => {
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: "strong" });
        return <li {...props}>
            {selected && <DoneIcon />}
            {chip}
            {selected && <CloseIcon />}
        </li>
    };

    onSchemaConnected = (tableClient: DB3Client.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;

        if (tableClient.args.filterModel?.tableParams && tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember] != null) {
            const fkid = parseIntOrNull(tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember]);

            const queryInput: db3.QueryInput = {
                tableID: this.typedSchemaColumn.foreignTableSpec.tableID,
                tableName: this.typedSchemaColumn.foreignTableSpec.tableName,
                orderBy: undefined,
                clientIntention: this.args.clientIntention,
                filter: {
                    items: [{
                        field: this.typedSchemaColumn.foreignTableSpec.pkMember,
                        operator: "equals",
                        value: fkid,
                    }]
                },
                cmdbQueryContext: `ForeignSingleFieldClient querying table ${this.typedSchemaColumn.foreignTableSpec.tableName} for table.column ${this.schemaTable.tableName}.${this.columnName}`
            };

            const [{ items }, { refetch }] = useQuery(db3queries, queryInput, gQueryOptions.default);
            if (items.length !== 1) {
                console.error(`table params ${JSON.stringify(tableClient.args.filterModel?.tableParams)} object not found for ${this.typedSchemaColumn.fkMember}. Maybe data obsolete? Maybe you manually typed in the query?`);
            }
            else {
                this.fixedValue = items[0];
                //items_ = items;
                //this.rowCount = items.length;
                //this.refetch = refetch;
            }
        }

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
                return <div className='MuiDataGrid-cellContent'>
                    {this.args.renderAsChip!({ value: args.value, colorVariant: "strong" })}
                </div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <ForeignSingleFieldInput
                    validationError={vr.success ? null : vr.errorMessage || null}
                    clientIntention={this.args.clientIntention}
                    foreignSpec={this}
                    readOnly={false} // always allow switching this; for admin purposes makes sense
                    value={params.value}
                    onChange={(value) => {
                        params.api.setEditCellValue({ id: params.id, field: this.args.columnName, value });//.then(() => {
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => {

        let value = params.value;

        // for NEW items, use the fixed value passed in as table params.
        // so when you filter by some master object (editing event segments for event XYZ), the master object is a fixed and pre-selected.
        if (this.fixedValue != null) {
            const foreignPkMember = this.typedSchemaColumn.foreignTableSpec.pkMember;
            //console.log(`rendering new dlg for foreign single`);
            const currentVal = params.row[this.typedSchemaColumn.member];
            if (currentVal === null || (this.fixedValue[foreignPkMember] !== currentVal[foreignPkMember])) {
                value = this.fixedValue;
                params.api.setFieldValues({
                    [this.args.columnName]: value,
                });
            }
        }

        const validationValue = params.validationResult ? (params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null) : undefined;

        return <React.Fragment key={params.key}>
            {/* <InputLabel>{this.schemaColumn.label}</InputLabel> */}
            <ForeignSingleFieldInput
                foreignSpec={this}
                readOnly={!!this.fixedValue}
                clientIntention={this.args.clientIntention}
                validationError={validationValue}
                value={value}
                onChange={(newValue: TForeign | null) => {
                    params.api.setFieldValues({
                        [this.args.columnName]: newValue,
                    });
                }}
            />
        </React.Fragment>;
    };
};

export interface ForeignSingleFieldRenderContextArgs<TForeign> {
    spec: ForeignSingleFieldClient<TForeign>;
    filterText: string;
    clientIntention: db3.xTableClientUsageContext,
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

        const [{ items }, { refetch }] = useQuery(db3queries, {
            tableID: args.spec.typedSchemaColumn.foreignTableSpec.tableID,
            tableName: args.spec.typedSchemaColumn.foreignTableSpec.tableName,
            orderBy: undefined,
            clientIntention: args.clientIntention,
            filter: { items: [] },
            cmdbQueryContext: "ForeignSingleFieldRenderContext",
        }, gQueryOptions.default);
        this.items = items;
        this.refetch = refetch;
    }

    doInsertFromString = async (userInput: string): Promise<TForeign> => {
        console.assert(!!this.args.spec.typedSchemaColumn.foreignTableSpec.createInsertModelFromString);
        const insertModel = this.args.spec.typedSchemaColumn.foreignTableSpec.createInsertModelFromString!(userInput);
        try {
            return await this.mutateFn({
                tableID: this.args.spec.typedSchemaColumn.foreignTableSpec.tableID,
                tableName: this.args.spec.typedSchemaColumn.foreignTableSpec.tableName,
                insertModel,
                clientIntention: this.args.clientIntention,
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

