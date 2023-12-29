
// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { Button, Checkbox, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Stack, Switch } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from "dayjs";
import React from "react";
import { ColorPaletteEntry } from "shared/color";
import { formatTimeSpan } from "shared/time";
import { gNullValue } from "shared/utils";
import { CMTextField } from "src/core/components/CMTextField";
import { ColorPick, ColorSwatch } from "src/core/components/Color";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
import { IconEditCell, RenderMuiIcon } from "./IconSelectDialog";
import { assert } from "blitz";
import { Markdown } from "src/core/components/RichTextEditor";
//import { API } from '../clientAPI';

interface RenderBasicNameValuePairProps {
    key?: string;
    className?: string;
    name: React.ReactNode;
    value: React.ReactNode;
};

export const RenderBasicNameValuePair = (props: RenderBasicNameValuePairProps) => {
    return <div key={props.key} className={`BasicNameValuePairContainer ${props.className}`}>
        <div className="name">{props.name}</div>
        <div className="value">{props.value}</div>
    </div>;
};


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
            visible: true,
            width: 40,
            GridColProps: {
                type: "number",
            }
        });
    }

    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: params.value,
    });

    onSchemaConnected() { };
    ApplyClientToPostClient = undefined;
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
            visible: true,
        });
    }

    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.GenericStringField;

        assert(this.typedSchemaColumn.format === "raw" || this.typedSchemaColumn.format === "plain" || this.typedSchemaColumn.format === "email" || this.typedSchemaColumn.format === "title", `GenericStringColumnClient[${tableClient.tableSpec.args.table.tableID}.${this.schemaColumn.member}] has an unsupported type.`);

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                return <CMTextField
                    key={params.key}
                    className={`columnName-${this.columnName}`}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: params.value,
    });

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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.SlugField;

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                return <div key={params.key}>placeholder</div>;
                // const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                // return <CMTextField
                //     key={params.key}
                //     autoFocus={params.hasFocus}
                //     label={this.headerName}
                //     validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
                //     value={params.value as string}
                //     onChange={(e, value) => {
                //         void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                //     }}
                // />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<string>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: params.value,
    });

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        if (!this.schemaColumn) throw new Error(`no schemacolumn for slug column '${this.columnName}'`);
        const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "new", clientIntention: params.clientIntention });

        //const [isEditable, setIsEditable] = React.useState<boolean>(false);
        //const [customValue, setCustomValue] = React.useState<string>("");

        // set the calculated value in the object.
        // if (params.value !== vr.parsedValue) {
        //     params.api.setFieldValues({ [this.schemaColumn.member]: vr.parsedValue });
        // }
        if (vr.values[this.columnName] !== params.row[this.columnName]) {
            params.api.setFieldValues(vr.values);
        }

        // NOTE: do not bother with custom-editable slugs.
        // it causes complications not worth the effort WRT
        // - gui. need more controls and explanation
        // - validation needs to know if you've edited the value by hand because of how the field is populated
        // - it will lead to more confusion than anything.
        // simplest is to always calculate based on name, and just SHOW the slug in readonly state
        // next-simplest may be to have a button to regenerate the slug on demand, and otherwise never change it.

        // const handleEditableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        //     if (e.target.checked) {
        //         // switching to manual mode; initialize custom value with current value.
        //         setCustomValue(vr.parsedValue as string);
        //     }
        //     setIsEditable(e.target.checked);
        // };

        return <div className="slugEditField">
            <CMTextField
                readOnly={true}
                key={params.key}
                autoFocus={false}
                label={this.headerName}
                //validationError={null} // don't show validation errors for fields you can't edit.
                //validationError={vr.errorMessage || null}
                value={vr.values[this.columnName] as string}
                onChange={(e, val) => {
                    //params.api.setFieldValues({ [this.columnName]: val });
                }}
            />

        </div>;
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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.GenericStringField;

        if (this.typedSchemaColumn.format !== "markdown") {
            debugger;
        }
        assert(this.typedSchemaColumn.format === "markdown", "wrong format for markdown string client");

        this.GridColProps = {
            type: "string",
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                return <Stack><CMTextField
                    key={params.key}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
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

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<string>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: <Markdown key={params.key} markdown={params.value} />
    });

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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            type: "string", // we will do our own number conversion
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                return <CMTextField
                    key={params.key}
                    autoFocus={params.hasFocus}
                    label={this.headerName}
                    validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
                    value={params.value as string}
                    onChange={(e, value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: params.value,
    });

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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            renderCell: (params: GridRenderCellParams) => {
                return <div className='MuiDataGrid-cellContent'><Checkbox checked={params.value} disabled /></div>;
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                return <FormControlLabel className='CMFormControlLabel' label={this.schemaColumn.member} control={
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

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<boolean>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: !!params.value ? "Yes" : "No",
    });

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <FormControlLabel className='CMFormControlLabel' label={this.schemaColumn.member} control={
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
            visible: true,
            GridColProps: {
                renderCell: (args: GridRenderCellParams) => {
                    return <div className='MuiDataGrid-cellContent'><ColorSwatch color={args.value} variation={{ enabled: true, selected: true, fillOption: "filled", variation: "strong" }} /></div>; // colorswatch must be aware of null values.
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
    ApplyClientToPostClient = undefined;

    onSchemaConnected() { };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<ColorPaletteEntry | null>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: <ColorSwatch color={params.value} variation={{ enabled: true, selected: true, fillOption: "filled", variation: "strong" }} />
    });

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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<string>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: params.value,
    });

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
            <InputLabel>{this.schemaColumn.member}</InputLabel>
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
    ApplyClientToPostClient = undefined;

    onSchemaConnected(tableClient: DB3ClientCore.xTableRenderClient) {
        super.onSchemaConnected(tableClient);
        this.GridColProps!.renderCell = (params) => {
            return RenderMuiIcon(params.value);
        };
        this.GridColProps!.renderEditCell = (params) => {
            const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
            return <IconEditCell
                validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
                value={params.value}
                //allowNull={true}
                readonly={false}
                onOK={(value) => {
                    void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                }}
            />;
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const value = params.value === null ? gNullValue : params.value;
        return <React.Fragment key={params.key}>
            <InputLabel>{this.schemaColumn.member}</InputLabel>
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
            <FormControlLabel className='CMFormControlLabel' control={<Checkbox
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
            visible: true,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3fields.CreatedAtField;
        this.GridColProps = {
            type: "dateTime",
            renderCell: (params: GridRenderCellParams) => {
                const value = params.value as Date;
                const now = new Date();
                const ageStr = `(${formatTimeSpan(value, now)} ago)`;
                return <>{value.toTimeString()} {ageStr}</>; // todo
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                const value = params.value as Date;
                const now = new Date();
                //const age = new TimeSpan(now.valueOf() - value.valueOf());
                const ageStr = `(${formatTimeSpan(now, value)} ago)`;
                return <>{value.toTimeString()} {ageStr}</>; // todo
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<Date>) => {
        const value = params.value;
        const now = new Date();
        const ageStr = `(${formatTimeSpan(value, now)} ago)`;
        return RenderBasicNameValuePair({
            key: params.key,
            className: params.className,
            name: this.columnName,
            value: <>{value.toTimeString()} {ageStr}</> // todo,
        })
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "new", clientIntention: params.clientIntention });

        // set the calculated value in the object.
        if (params.value === undefined && vr.values) {
            params.api.setFieldValues(vr.values);
        }

        //const value = vr.parsedValue as Date;
        const value = params.row[this.columnName];
        const now = new Date();
        //const age = new TimeSpan(now.valueOf() - value.valueOf());
        const ageStr = `(${formatTimeSpan(now, value)} ago)`;
        return <>{value.toTimeString()} {ageStr}</>; // todo
    };
};
