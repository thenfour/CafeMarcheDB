'use client';

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import React from "react";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { TAnyModel, TIconOptions, TimeSpan, gNullValue } from "shared/utils";
import { CMTextField } from "src/core/components/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import { ColorPaletteEntry } from "shared/color";
import { Button, Checkbox, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Stack } from "@mui/material";
import * as DB3ClientCore from "./DB3ClientCore";
import * as db3fields from "../shared/db3basicFields";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from "dayjs";
import { IconEditCell, RenderMuiIcon } from "./IconSelectDialog";



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
            width: 40,
            GridColProps: {
                type: "number",
            }
        });
    }

    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>
    onSchemaConnected() { };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface GenericStringColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class GenericStringColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.GenericStringField;

    constructor(args: GenericStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.GenericStringField;

        console.assert(this.typedSchemaColumn.format === "plain" || this.typedSchemaColumn.format === "email" || this.typedSchemaColumn.format === "title");

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <CMTextField
                    key={params.key}
                    className={`columnName-${this.columnName}`}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.success ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <CMTextField
            className={`columnName-${this.columnName}`}
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult && params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};



export class SlugColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.SlugField;

    constructor(args: GenericStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.SlugField;

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <CMTextField
                    key={params.key}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.success ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        if (!this.schemaColumn) throw new Error(`no schemacolumn for slug column '${this.columnName}'`);
        const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "new" });

        // set the calculated value in the object.
        if (params.value !== vr.parsedValue) {
            params.api.setFieldValues({ [this.schemaColumn.member]: vr.parsedValue });
        }
        return <CMTextField
            readOnly={true}
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            //validationError={null} // don't show validation errors for fields you can't edit.
            //validationError={vr.errorMessage || null}
            value={vr.parsedValue as string}
            onChange={(e, val) => {
                //params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface MarkdownStringColumnArgs {
    columnName: string;
    cellWidth: number;
};

export class MarkdownStringColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.GenericStringField;

    constructor(args: MarkdownStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.GenericStringField;

        console.assert(this.typedSchemaColumn.format === "markdown");

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <Stack><CMTextField
                    key={params.key}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.success ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />
                    <Button>edit</Button>
                </Stack>;
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <Stack><CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult && params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />
            <Button>edit</Button>
        </Stack >;
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            type: "string", // we will do our own number conversion
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <CMTextField
                    key={params.key}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.success ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <CMTextField
            key={params.key}
            autoFocus={false}
            label={this.headerName}
            validationError={params.validationResult && params.validationResult.getErrorForField(this.columnName)}
            value={params.value as string}
            onChange={(e, val) => {
                // so this sets the row model value to a string. that's OK because the value gets parsed later.
                // in fact it's convenient because it allows temporarily-invalid inputs instead of joltingly changing the user's own input.
                params.api.setFieldValues({ [this.columnName]: val });
            }}
        />;
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface BoolColumnArgs {
    columnName: string;
    //cellWidth: number;
};

export class BoolColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: BoolColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: 80,//args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            renderCell: (params: GridRenderCellParams) => {
                return <div className='MuiDataGrid-cellContent'><Checkbox checked={params.value} disabled /></div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                return <FormControlLabel label={this.schemaColumn.label} control={
                    <Checkbox
                        checked={params.value}
                        onChange={(e, value) => {
                            void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                        }}
                    />
                } />
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <FormControlLabel label={this.schemaColumn.label} control={
            <Checkbox
                checked={!!params.value}
                onChange={(e, val) => {
                    // so this sets the row model value to a string. that's OK because the value gets parsed later.
                    // in fact it's convenient because it allows temporarily-invalid inputs instead of joltingly changing the user's own input.
                    params.api.setFieldValues({ [this.columnName]: val });
                }}
            />}
        />;
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
                    return <div className='MuiDataGrid-cellContent'><ColorSwatch selected={true} color={args.value} showStrong={true} showWeak={true} /></div>; // colorswatch must be aware of null values.
                },
                renderEditCell: (args: GridRenderEditCellParams) => {
                    return <ColorPick
                        value={args.value}
                        palettes={(this.schemaColumn as db3fields.ColorField).palette}
                        onChange={(value: ColorPaletteEntry) => {
                            void args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
                        }}
                        allowNull={(this.schemaColumn as db3fields.ColorField).allowNull}
                    />;

                },
            }
        });
    }

    onSchemaConnected() { };

    // will render as a child of <FormControl>
    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <ColorPick
            value={params.value as ColorPaletteEntry | null}
            palettes={(this.schemaColumn as db3fields.ColorField).palette}
            allowNull={(this.schemaColumn as db3fields.ColorField).allowNull}
            onChange={(value: ColorPaletteEntry) => {
                params.api.setFieldValues({ [this.schemaColumn.member]: value }); // params.api.setFieldValues({ [this.columnName]: val });
                //args.api.setEditCellValue({ id: args.id, field: this.schemaColumn.member, value: value });
            }}
        />;
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

    onSchemaConnected(tableClient: DB3ClientCore.xTableRenderClient) {
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
                error={params.validationResult && !!params.validationResult.hasErrorForField(this.schemaColumn.member)}
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
            <FormHelperText>Heres my helper text</FormHelperText>
        </React.Fragment>;

    };
};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class IconFieldClient extends ConstEnumStringFieldClient {

    constructor(args: ConstEnumStringFieldClientArgs) {
        super(args);
    }

    onSchemaConnected(tableClient: DB3ClientCore.xTableRenderClient) {
        super.onSchemaConnected(tableClient);
        this.GridColProps!.renderCell = (params) => {
            return RenderMuiIcon(params.value);
        };
        this.GridColProps!.renderEditCell = (params) => {
            const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
            return <IconEditCell
                validationError={vr.success ? null : (vr.errorMessage || null)}
                value={params.value}
                //allowNull={true}
                onOK={(value) => {
                    void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                }}
            />;
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const value = params.value === null ? gNullValue : params.value;
        return <React.Fragment key={params.key}>
            <InputLabel>{this.schemaColumn.label}</InputLabel>
            <Select
                value={value}
                error={params.validationResult && !!params.validationResult.hasErrorForField(this.schemaColumn.member)}
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
                        return <MenuItem key={option.value} value={option.value}>{RenderMuiIcon(option.value as any)} {option.label}</MenuItem>;
                    })
                }
            </Select>
            <FormHelperText>Heres my helper text</FormHelperText>
        </React.Fragment>;

    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMDatePickerProps {
    autoFocus: boolean,
    label: string,
    value: Date | null,
    onChange: (value: Date | null) => void,
    allowNull: boolean,
};

export const CMDatePicker = (props: CMDatePickerProps) => {
    const [datePickerValue, setDatePickerValue] = React.useState<Date | null>(props.value);
    const [noDateChecked, setNoDateChecked] = React.useState<boolean>(props.value == null);

    // the moment you uncheck the box is the moment we want to set focus. but the control is disabled at that point.
    // so we queue up the setfocus.
    // but then, MUI has some animation or something that delays enabled state further. so a timeout is the hack for now.
    const [queueFocus, setQueueFocus] = React.useState<boolean>(false);

    const datePickerRef = React.useRef(null); // Ref to the TextField

    const datePickerValueField = noDateChecked ? null : (datePickerValue == null ? null : dayjs(datePickerValue));

    React.useEffect(() => {
        const extVal = noDateChecked ? null : datePickerValue;
        props.onChange(extVal);
    }, [noDateChecked, datePickerValue]);

    if (queueFocus && datePickerRef.current && !noDateChecked) {
        setQueueFocus(false);
        setTimeout(() => {
            (datePickerRef.current as any).focus();
            //datePickerRef.current.querySelector('input').focus();
        }, 100);
    }

    // when the user is typing a date, it will be an invalid date in the middle of typing.
    // during that intermediate state, the date picker acts as uncontrolled so setting value does'nt set anything.
    // 

    return <>
        <DatePicker
            autoFocus={props.autoFocus}
            inputRef={datePickerRef}
            label={props.label}
            disabled={noDateChecked}
            value={datePickerValueField}
            onChange={(value: Dayjs, context) => {
                let d: Date | null = (value?.toDate()) || null;
                if (d instanceof Date) {
                    if (isNaN(d.valueOf())) {
                        d = null;
                    }
                }
                //console.log(`date picker onChange: ${value} => ${d}`);
                setDatePickerValue(d);
                //invokeOnChange();
            }}
            className={noDateChecked ? "CMDatePicker CMDisabled" : "CMDatePicker CMEnabled"}

        />
        {props.allowNull &&
            <FormControlLabel control={<Checkbox
                checked={noDateChecked}
                onChange={(e) => {
                    //console.log(`checkbox change checked=${e.target.checked}, changing to ${e.target.checked ? null : datePickerValue} `);
                    setNoDateChecked(e.target.checked);
                    if (!e.target.checked) {
                        setQueueFocus(true);
                    }
                    //invokeOnChange();
                }}
            />} label="Don't specify a date" />

        }
    </>
        ;

};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeColumnArgs {
    columnName: string;
    cellWidth: number;
};


export class DateTimeColumn extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.DateTimeField;

    constructor(args: DateTimeColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.DateTimeField;
        this.GridColProps = {
            type: "dateTime",
            renderCell: (params: GridRenderCellParams) => {
                if (params.value == null) {
                    return <>--</>;
                }
                const value = params.value as Date;
                if (isNaN(value.valueOf())) {
                    return <>---</>; // treat as null.
                }
                const d = dayjs(value);
                return <>{d.toString()}</>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                // regarding validation, the date picker kinda has its own way of doing validation and maybe i'll work with that in the future.
                const granularity = this.typedSchemaColumn.granularity;
                switch (granularity) {
                    case "year": // todo
                    case "day": // todo
                    case "minute":
                    case "second":
                        return <CMDatePicker
                            allowNull={this.typedSchemaColumn.allowNull}
                            autoFocus={params.hasFocus}
                            label={this.typedSchemaColumn.label}
                            value={params.value}
                            onChange={(value: Date | null) => {
                                void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                            }}
                        />;
                    default:
                        throw new Error(`unknown granularity`);
                }
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "new" });
        // regarding validation, the date picker kinda has its own way of doing validation and maybe i'll work with that in the future.
        const granularity = this.typedSchemaColumn.granularity;
        switch (granularity) {
            case "year": // todo
            case "day": // todo
            case "minute":
            case "second":
                return <CMDatePicker
                    allowNull={this.typedSchemaColumn.allowNull}
                    autoFocus={false}
                    label={this.typedSchemaColumn.label}
                    value={params.value as Date | null}
                    onChange={(value: Date | null) => {
                        params.api.setFieldValues({ [this.columnName]: value });
                    }}
                />;
            default:
                throw new Error(`unknown granularity`);
        }
    };
};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CreatedAtColumnArgs {
    columnName: string;
    cellWidth: number;
};


export class CreatedAtColumn extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.CreatedAtField;

    constructor(args: CreatedAtColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
        });
    }

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.CreatedAtField;
        this.GridColProps = {
            type: "dateTime",
            renderCell: (params: GridRenderCellParams) => {
                const value = params.value as Date;
                const now = new Date();
                const age = new TimeSpan(now.valueOf() - value.valueOf());
                const ageStr = `(${age.shortString} ago)`;
                return <>{value.toTimeString()} {ageStr}</>; // todo
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                const value = params.value as Date;
                const now = new Date();
                const age = new TimeSpan(now.valueOf() - value.valueOf());
                const ageStr = `(${age.shortString} ago)`;
                return <>{value.toTimeString()} {ageStr}</>; // todo
            },
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const vr = this.schemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "new" });

        // set the calculated value in the object.
        if (params.value === undefined && vr.parsedValue) {
            params.api.setFieldValues({ [this.schemaColumn.member]: vr.parsedValue });
        }

        const value = vr.parsedValue as Date;
        const now = new Date();
        const age = new TimeSpan(now.valueOf() - value.valueOf());
        const ageStr = `(${age.shortString} ago)`;
        return <>{value.toTimeString()} {ageStr}</>; // todo
    };
};
