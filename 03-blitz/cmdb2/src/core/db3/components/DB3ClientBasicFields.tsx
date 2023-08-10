'use client';

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import React from "react";
//import db3mutations from "../mutations/db3mutations";
//import db3queries from "../queries/db3queries";
//import db3paginatedQueries from "../queries/db3paginatedQueries";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { gNullValue } from "shared/utils";
import { CMTextField } from "src/core/cmdashboard/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import { ColorPaletteEntry } from "shared/color";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import * as DB3ClientCore from "./DB3ClientCore";
import * as db3fields from "../shared/db3basicFields";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface PKColumnArgs {
    columnName: string;
};

export class PKColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: PKColumnArgs) {
        super({
            columnName: args.columnName,
            editable: false,
            headerName: args.columnName,
            width: 50,
            GridColProps: {
                type: "number",
            }
        });
    }

    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    onSchemaConnected = undefined;
};

export interface GenericStringColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class GenericStringColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: GenericStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: 220,
        });
    }
    onSchemaConnected = undefined;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};

export interface GenericIntegerColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class GenericIntegerColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: GenericIntegerColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            GridColProps: {
                type: "number",
            }
        });
    }

    onSchemaConnected = undefined;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                // so this sets the row model value to a string. that's OK because the value gets parsed later.
                // in fact it's convenient because it allows temporarily-invalid inputs instead of joltingly changing the user's own input.
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};

export interface ColorColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class ColorColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: ColorColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            GridColProps: {
                renderCell: (args: GridRenderCellParams) => {
                    return <ColorSwatch selected={true} color={args.value} />; // colorswatch must be aware of null values.
                },
                renderEditCell: (args: GridRenderEditCellParams) => {
                    return <ColorPick
                        value={args.value}
                        palette={(this.schemaColumn as db3fields.ColorField).palette}
                        onChange={(value: ColorPaletteEntry) => {
                            args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
                        }}
                    />;

                },
            }
        });
    }

    onSchemaConnected = undefined;

    // will render as a child of <FormControl>
    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <ColorPick
            value={params.value as ColorPaletteEntry | null}
            palette={(this.schemaColumn as db3fields.ColorField).palette}
            onChange={(value: ColorPaletteEntry) => {
                params.api.setFieldValues({ [this.schemaColumn.member]: value }); // params.api.setFieldValues({ [this.columnName]: val });
                //args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
            }}
        />;
    };
};


export interface ConstEnumStringFieldClientArgs {
    columnName: string;
    cellWidth: number;
};

export class ConstEnumStringFieldClient extends DB3ClientCore.IColumnClient {
    gridOptions: { value: string, label: string }[];
    enumSchemaColumn: db3fields.ConstEnumStringField;

    constructor(args: ConstEnumStringFieldClientArgs) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = () => {
        this.enumSchemaColumn = this.schemaColumn as db3fields.ConstEnumStringField;

        this.gridOptions = Object.entries(this.enumSchemaColumn.options).map(([k, v]) => {
            return { value: k, label: v };
        });

        // if we use datagrid's builtin singleselect column, it doesn't support null. so use a sentinel value.
        this.gridOptions = [{ value: gNullValue, label: "--" }, ...this.gridOptions];

        this.GridColProps = {
            type: "singleSelect",
            valueOptions: this.gridOptions,
            valueGetter: (params) => params.value === null ? gNullValue : params.value, // transform underlying row model value to the value the grid will use in the selection box.
            valueSetter: (params) => { // transform select value to grid value.
                const val = params.value === gNullValue ? null : params.value;
                return { ...params.row, [this.schemaColumn.member]: val };
            },
            getOptionValue: (value: any) => value.value,
            getOptionLabel: (value: any) => value.label,
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const value = params.value === null ? gNullValue : params.value;
        return <React.Fragment key={params.key}>
            <InputLabel>{this.schemaColumn.label}</InputLabel>
            <Select
                value={value}
                error={!!params.validationResult.hasErrorForField(this.schemaColumn.member)}
                onChange={e => {
                    let userInputValue: (string | null) = e.target.value as string;
                    if (userInputValue === gNullValue) {
                        userInputValue = null;
                    }
                    return params.api.setFieldValues({ [this.schemaColumn.member]: userInputValue });
                }}
            >
                {
                    this.gridOptions.map(option => {
                        return <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>;
                    })
                }
            </Select>
            <FormHelperText>Here's my helper text</FormHelperText>
        </React.Fragment>;

    };
};
