import { GridColDef, GridPreProcessEditCellProps, GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { ZodSchema, z } from "zod";
import { CMTextField } from "../CMTextField";
import { Backdrop, Box, Button, FormHelperText, InputLabel, MenuItem, Popover, Select, Tooltip } from "@mui/material";
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



const gNullValue = "__null__498b0049-f883-4c77-9613-c8712e49e183";
//const gInitialInvalidValue = "__initial_invalid_value__498b0049-f883-4c77-9613-c8712e49e183";

interface EnumFieldArgs<TEnum extends Record<string, string>> {
    member: string,
    label: string,
    cellWidth: number,
    allowNull: boolean,
    options: TEnum,
    initialNewItemValue: TEnum | null;
};

// static list / enum
// for null support we add a fake value representing null.
// when an incoming value is not a valid value, it will coerce to null.
export class EnumField<TEnum extends Record<string, string>, DBModel> extends CMFieldSpecBase<DBModel> {

    args: EnumFieldArgs<TEnum>;
    gridOptions: { value: string | null, label: string }[];
    //initialInvalidValue?: string;
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


// i don't want to support like, ANY color. let's instead use a palette.

interface ColorPaletteEntry {
    label: string;
    value: string | null;
}

class ColorPaletteArgs {
    entries: ColorPaletteEntry[];
    columns: number;
};

export class ColorPalette extends ColorPaletteArgs {
    // entries: ColorPaletteEntry[];
    // columns: number;
    get count(): number {
        return this.entries.length;
    }
    get rows(): number {
        return Math.ceil(this.entries.length / this.columns);
    }
    getEntriesForRow = (row: number) => {
        const firstEntry = row * this.columns;
        return this.entries.slice(firstEntry, firstEntry + this.columns);
    };
    // return an array of rows
    getAllRowsAndEntries(): ColorPaletteEntry[][] {
        const rows: ColorPaletteEntry[][] = [];
        for (let i = 0; i < this.rows; ++i) {
            rows.push(this.getEntriesForRow(i));
        }
        return rows;
    }

    constructor(args: ColorPaletteArgs) {
        super();
        Object.assign(this, args);
    }
};

interface ColorPaletteFieldArgs {
    member: string,
    label: string,
    cellWidth: number,
    allowNull: boolean,
    palette: ColorPalette,
    initialNewItemValue: string | null;
};

export interface ColorSwatchProps {
    color: ColorPaletteEntry;
    selected: boolean;
};

// props.color can never be null.
export const ColorSwatch = (props: ColorSwatchProps) => {
    const style = (props.color.value === null) ? "dotted" : "solid";
    return <Tooltip title={props.color.label}>
        <Box sx={{
            width: 25,
            height: 25,
            backgroundColor: props.color.value,
            border: props.selected ? `2px ${style} #888` : `2px ${style} #d8d8d8`,
        }}>
        </Box>
    </Tooltip>;
};

export interface ColorPickProps {
    value: ColorPaletteEntry;
    palette: ColorPalette;
    onChange: (value: ColorPaletteEntry) => void;
};

// props.color can never be null.
export const ColorPick = (props: ColorPickProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return <>
        {/* <Backdrop open={true}> */}
        <Tooltip title={props.value.label}>
            <Button onClick={handleOpen}><ColorSwatch selected={true} color={props.value} /></Button>
        </Tooltip>
        <Popover
            anchorEl={anchorEl}
            open={isOpen}
            onClose={() => setAnchorEl(null)}
        // i really want this but can't make it work.
        //hideBackdrop={false}
        //BackdropProps={{ invisible: false }}
        //slotProps={{ backdrop: { className: "bleh" } }}
        >
            {
                props.palette.getAllRowsAndEntries().map((row, rowIndex) => {
                    return <Box key={rowIndex}>
                        {row.map(e => {
                            return <MenuItem sx={{ display: "inline-flex" }} key={e.value || gNullValue} onClick={() => {
                                props.onChange(e);
                                setAnchorEl(null);
                            }}> <ColorSwatch selected={e.value === props.value.value} key={e.value || gNullValue} color={e} /></MenuItem>

                        })}
                    </Box>;
                })
            }
        </Popover >
        {/* </Backdrop> */}
    </>;
};

// static list / enum
// for null support we add a fake value representing null.
// when an incoming value is not a valid value, it will coerce to null.
export class ColorPaletteField<DBModel> extends CMFieldSpecBase<DBModel> {

    args: ColorPaletteFieldArgs;

    // undefined if doesn't exist
    findColorPaletteEntry = (colorString: string | null): ColorPaletteEntry | undefined => {
        let ret = this.args.palette.entries.find(i => i.value === colorString);
        if (ret !== undefined) return ret;

        // not found; treat as null?
        ret = this.args.palette.entries.find(i => i.value === null);
        if (ret !== undefined) return ret;

        // still not found; use first entry.
        return this.args.palette.entries[0];
    }

    constructor(args: ColorPaletteFieldArgs) {
        super();
        this.args = args;
        this.member = args.member;
        this.fkidMember = undefined;
        this.columnHeaderText = args.member;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = args.initialNewItemValue;

        // create a zod schema to validate against enum values, case-insensitive, and null sensitivity.
        this.zodSchema = z.string();

        if (args.allowNull) {
            this.zodSchema = this.zodSchema.nullable();
        }

        this.logParseResult = true;

        this.GridColProps = {
            // this impl required showing validation result
            preProcessEditCellProps: (params: GridPreProcessEditCellProps) => {
                const parseResult = this.ValidateAndParse(params.props.value);
                return { ...params.props, error: !parseResult.success };
            },
        };
    }

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel>) => {
        const value = params.value === null ? gNullValue : params.value;
        return <React.Fragment key={params.key}>
            <InputLabel>{this.args.label}</InputLabel>
        </React.Fragment>;

    };

    renderForEditGridView = (params: GridRenderCellParams) => {
        const entry = this.findColorPaletteEntry(params.value);
        console.assert(entry !== undefined); // if this is undefined it means the value wasn't found in the palette.
        return <ColorSwatch selected={true} color={entry!} />;
    };

    renderForEditGridEdit = (params: GridRenderEditCellParams) => {
        const entry = this.findColorPaletteEntry(params.value);
        console.log(`rendering for edit, value=${params.value}; entry=${JSON.stringify(entry)}`);
        console.assert(entry !== undefined); // if this is undefined it means the value wasn't found in the palette.
        return <ColorPick
            value={entry!}
            palette={this.args.palette}
            onChange={(value: ColorPaletteEntry) => {
                console.log(`setting color to ${JSON.stringify(value)}`);
                params.api.setEditCellValue({ id: params.id, field: this.args.member, value: value.value });
            }}
        />;
    };

    getQuickFilterWhereClause = (query: string) => {
        return { [this.member]: { contains: query } };
    }; // return either falsy, or an object like {name: {contains: query } }

};


// date
// date-time
// boolean
// multi fk
