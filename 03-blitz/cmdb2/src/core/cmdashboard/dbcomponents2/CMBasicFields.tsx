import { GridColDef, GridPreProcessEditCellProps, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { ZodSchema, z } from "zod";
import { CMTextField } from "../CMTextField";
import { FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import { CMFieldSpecBase, RenderForNewItemDialogArgs } from "./CMColumnSpec";


interface PKIDFieldArgs {
    member: string,
};

export class PKIDField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: PKIDFieldArgs;

    constructor(args: PKIDFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;

        this.columnHeaderText = args.member;
        this.isEditableInGrid = false;
        this.cellWidth = 40;
    }

    getQuickFilterWhereClause = (query: string) => {
        return false;
    }; // return either falsy, or an object like { name: { contains: query } }
};

interface SimpleTextFieldArgs {
    member: string,
    label: string,
    cellWidth: number,
    initialNewItemValue: string;
    zodSchema: ZodSchema; // todo: possibly different schemas for different scenarios. in-grid editing vs. new item dialog etc.
    allowNullAndTreatEmptyAsNull: boolean;
    // for things like treating empty as null, case sensitivity, trimming, do it in the zod schema via transform
};

export class SimpleTextField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: SimpleTextFieldArgs;
    convertGridValueToRowValue: (val: null | string) => null | string;

    constructor(args: SimpleTextFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = args.initialNewItemValue;
        this.zodSchema = args.zodSchema;
        this.convertGridValueToRowValue = (val) => {
            if (val === "" && this.args.allowNullAndTreatEmptyAsNull) {
                return null;
            }
            return val;
        };
        this.GridColProps = {
            type: "string",
            preProcessEditCellProps: (params: GridPreProcessEditCellProps) => { // this impl required showing validation result
                const newVal = this.convertGridValueToRowValue(params.props.value);
                const parseResult = this.ValidateAndParse(newVal);
                return { ...params.props, error: !parseResult.success };
            },
            valueGetter: (params) => params.value || "",
            valueSetter: (params) => {
                const newVal = this.convertGridValueToRowValue(params.value);
                return { ...params.row, [this.member]: newVal };
            },
        };
    }

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.args.label}
            validationError={params.validationResult.getErrorForField(this.args.member)}
            value={params.value}
            onChange={(e, val) => {
                //return onChange(val);
                params.api.setFieldValues({ [this.args.member]: val });
            }}
        />;
    };

    getQuickFilterWhereClause = (query: string) => {
        const obj = {};
        obj[this.member] = { contains: query };
        return obj;
    }; // return either falsy, or an object like { name: { contains: query } }

};




interface SimpleNumberFieldArgs {
    member: string,
    label: string,
    cellWidth: number,
    allowNull: boolean,
    initialNewItemValue: number | null;
    zodSchema: ZodSchema; // todo: possibly different schemas for different scenarios. in-grid editing vs. new item dialog etc.
    // outside of null checks, constraints should be put in the zod schema.
};

export class SimpleNumberField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: SimpleNumberFieldArgs;

    constructor(args: SimpleNumberFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = args.initialNewItemValue;
        this.zodSchema = args.zodSchema;
    }

    GridColProps = {
        type: "number",
        preProcessEditCellProps: (params: GridPreProcessEditCellProps) => { // this impl required showing validation result
            const parseResult = this.ValidateAndParse(params.props.value);
            return { ...params.props, error: !parseResult.success };
        }
    };

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.args.label}
            validationError={params.validationResult.getErrorForField(this.args.member)}
            value={params.value}
            onChange={(e, val) => {
                //return onChange(val);
                params.api.setFieldValues({ [this.args.member]: val });
            }}
        />;
    };

    getQuickFilterWhereClause = (query: string) => {
        const obj = {};
        obj[this.member] = { equals: query };
        return obj;
    }; // return either falsy, or an object like { name: { contains: query } }

};


interface EnumFieldArgs<TEnum extends Record<string, string>> {
    member: string,
    label: string,
    cellWidth: number,
    allowNull: boolean,
    options: TEnum,
    initialNewItemValue: TEnum | null;
};

const gNullValue = "__null__498b0049-f883-4c77-9613-c8712e49e183";
//const gInitialInvalidValue = "__initial_invalid_value__498b0049-f883-4c77-9613-c8712e49e183";

// static list / enum
// for null support we add a fake value representing null.
// when an incoming value is not a valid value, it will coerce to null.
export class EnumField<TEnum extends Record<string, string>, DBModel> extends CMFieldSpecBase<DBModel> {

    args: EnumFieldArgs<TEnum>;
    gridOptions: { value: string | null, label: string }[];
    initialInvalidValue?: string;
    convertGridValueToRowValue: (val: null | string) => null | string;

    constructor(args: EnumFieldArgs<TEnum>) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = args.initialNewItemValue;

        // create a zod schema to validate against enum values, case-insensitive, and null sensitivity.
        //this.zodSchema = args.zodSchema;
        this.zodSchema = z.nativeEnum(args.options);

        this.convertGridValueToRowValue = (val) => {
            // todo: if value doesn't exist in options, coerce to null?
            if (val === gNullValue) {
                return null;
            }
            return val;
        };

        this.gridOptions = Object.entries(this.args.options).map(([k, v]) => {
            return { value: k, label: v };
        });

        if (args.allowNull) {
            this.zodSchema = this.zodSchema.nullable();
            this.gridOptions = [{ value: gNullValue, label: "--" }, ...this.gridOptions];
        }

        this.logParseResult = true;

        this.GridColProps = {
            type: "singleSelect",
            // this impl required showing validation result
            // NB: params.row[member] is not yet updated
            // NB: params.props.value is the new value; it has NOT been translated yet via valueSetter().
            // NB: do not try to combine valueSetter and validation here together by modifying params.props.value. datagrid expects that value to be unchanged.
            // Therefore, transforming the value must be done in both functions; here and in valueSetter.
            preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                //if (params.props.value === gNullValue) params.props.value = null; // don't do this. breaks the grid.
                const val = this.convertGridValueToRowValue(params.props.value);
                const parseResult = this.ValidateAndParse(val);
                return { ...params.props, error: !parseResult.success };
            },
            valueOptions: this.gridOptions,
            valueGetter: (params) => params.value === null ? gNullValue : params.value,
            valueSetter: (params) => {
                const val = this.convertGridValueToRowValue(params.value);
                return { ...params.row, [this.member]: val };
            },
            getOptionValue: (value: any) => value.value,
            getOptionLabel: (value: any) => value.label,
        };
    }

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        const value = params.value === null ? gNullValue : params.value;
        //console.log(`render for new dlg isnull?${params.value === null} isundefined${params.value === undefined} params.value:${params.value}, sanitizedval:${value}`);
        return <React.Fragment key={params.key}>
            <InputLabel>{this.args.label}</InputLabel>
            <Select
                value={value}
                error={!!params.validationResult.hasErrorForField(this.args.member)}
                onChange={e => {
                    return params.api.setFieldValues({ [this.args.member]: e.target.value });
                }}
            >
                {this.args.allowNull && <MenuItem key={gNullValue} value={gNullValue}>--</MenuItem>}
                {Object.values(this.args.options).map(val => (
                    <MenuItem key={val} value={val}>
                        {val}
                    </MenuItem>
                ))}
            </Select>
            <FormHelperText>Here's my helper text</FormHelperText>
        </React.Fragment>;

    };

    getQuickFilterWhereClause = (query: string) => {
        return { [this.member]: { contains: query } };
    }; // return either falsy, or an object like { name: { contains: query } }

};


// color  https://mikbry.github.io/material-ui-color/?id=components-colorpalette--basic&viewMode=docs
// date
// date-time
// boolean
// multi fk
