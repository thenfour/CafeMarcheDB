
// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { Checkbox, FormControlLabel, MenuItem, Select, Stack } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { assert } from "blitz";
import dayjs, { Dayjs } from "dayjs";
import React, { Suspense } from "react";
import { formatTimeSpan } from "shared/time";
import { CoalesceBool, CoerceToBoolean, CoerceToNumberOrNull, IsNullOrWhitespace } from "shared/utils";
import { CMTextField, CMTextInputBase, SongLengthInput } from "src/core/components/CMTextField";
import { Markdown } from "src/core/components/markdown/Markdown";
import * as db3 from "../db3";
import * as db3fields from "../shared/db3basicFields";
import * as DB3ClientCore from "./DB3ClientCore";
import { IconEditCell } from "./IconSelectDialog";
// NB: do not use API.* here due to circular dependencies
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMDBTableFilterModel, TAnyModel, gNullValue } from "../shared/apiTypes";
import { RenderMuiIcon } from "./IconMap";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { SettingKey } from "shared/settings";
import { GenericStringField } from "../shared/genericStringField";
import { ColorSwatch } from "../../components/color/ColorSwatch";
import { ColorPaletteEntry } from "../../components/color/palette";
import { ColorPick } from "../../components/color/ColorPick";

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
            width: 90, // ids don't need to be this wide, but it helps keep the column clean when hovering
            className: undefined,
            fieldCaption: "id",
            isAutoFocusable: false,
            fieldDescriptionSettingName: undefined,
            GridColProps: {
                type: "number",
            }
        });
    }

    renderForNewDialog = undefined;// (params: RenderForNewItemDialogArgs) => React.ReactElement; // will render as a child of <FormControl>

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        isReadOnly={true}
        fieldName={this.columnName}
    />;

    onSchemaConnected() { };
    ApplyClientToPostClient = undefined;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface GenericStringColumnArgs {
    columnName: string;
    cellWidth: number;
    className?: string;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    renderCell?: undefined | ((params: GridRenderCellParams) => React.ReactNode);
};

export class GenericStringColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: GenericStringField;
    renderCell?: undefined | ((params: GridRenderCellParams) => React.ReactNode);

    constructor(args: GenericStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            visible: true,
            className: args.className,
            isAutoFocusable: false, // on mobile this causes on screen keyboard display and zoom which is disruptive because this field may not be that important. case in point: setlist name.
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
        this.renderCell = args.renderCell;
    }

    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as GenericStringField;

        assert(this.typedSchemaColumn.format === "raw" ||
            this.typedSchemaColumn.format === "plain" ||
            this.typedSchemaColumn.format === "email" ||
            this.typedSchemaColumn.format === "title" ||
            this.typedSchemaColumn.format === "customLinkSlug" ||
            this.typedSchemaColumn.format === "uri"
            , `GenericStringColumnClient[${tableClient.tableSpec.args.table.tableID}.${this.schemaColumn.member}] has an unsupported type.`);

        this.GridColProps = {
            type: "string",
            renderCell: this.renderCell,
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                return <CMTextField
                    key={params.key}
                    className={`columnName-${this.columnName}`}
                    //autoFocus={params.hasFocus}
                    autoFocus={false}
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

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        fieldName={this.columnName}
        isReadOnly={false}
    />;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => this.defaultRenderer({
        validationResult: params.validationResult,
        isReadOnly: false,
        value: <CMTextInputBase
            onChange={(e, val) => params.api.setFieldValues({ [this.columnName]: val })}
            //autoFocus={params.autoFocus}
            autoFocus={false}
            value={params.value as string}
            className={this.className}
        />
    });
};






//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface MarkdownStringColumnArgs {
    columnName: string;
    cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
    visible?: boolean;
};

export class MarkdownStringColumnClient extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: GenericStringField;

    constructor(args: MarkdownStringColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            isAutoFocusable: true,
            width: args.cellWidth,
            visible: CoerceToBoolean(args.visible, true),
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as GenericStringField;

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
                </Stack>;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<string>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={<Markdown key={params.key} markdown={params.value} />}
        fieldName={this.columnName}
        isReadOnly={false}
    />

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        // TODO: Pass uploadFileContext based on table type (e.g., song, event, etc.)
        return this.defaultRenderer({
            isReadOnly: false,
            validationResult: params.validationResult,
            value: <Markdown3Editor
                value={params.value as string}
                nominalHeight={120}
                autoFocus={false}
                onChange={async (val) => {
                    params.api.setFieldValues({ [this.columnName]: val });
                }}
            // uploadFileContext={...} // See TODO above
            />
        });
    }


};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface GenericIntegerColumnArgs {
    columnName: string;
    cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
};

export class GenericIntegerColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: GenericIntegerColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            isAutoFocusable: true,
            width: args.cellWidth,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        this.GridColProps = {
            type: "string", // we will do our own number conversion
            renderEditCell: (params: GridRenderEditCellParams) => {
                //const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                // return <CMTextField
                //     key={params.key}
                //     autoFocus={params.hasFocus}
                //     label={this.headerName}
                //     validationError={vr.result === "success" ? null : (vr.errorMessage || null)}
                //     value={params.value as string}
                //     onChange={(e, value) => {
                //         void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                //     }}
                ///>;
                const val = params.value;
                const displayValue = (val == null) || isNaN(val) ? "" : `${val}`;
                return <CMTextInputBase
                    autoFocus={params.hasFocus}
                    initialValue={displayValue}
                    readOnly={!this.editable}
                    onChange={(e, val) => {
                        //params.api.set({ [this.columnName]: CoerceToNumberOrNull(val) });
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value: CoerceToNumberOrNull(val) });
                    }} />;
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        isReadOnly={!this.editable}
        fieldName={this.columnName}
    />;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const val = params.value as (number | null);
        // for values which are not numeric, simply display as "".
        const displayValue = (val == null) || isNaN(val) ? "" : `${val}`;

        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            className: `field_${this.columnName}`,
            value: <CMTextInputBase value={displayValue} readOnly={!this.editable} onChange={(e, val) => {
                params.api.setFieldValues({ [this.columnName]: CoerceToNumberOrNull(val) });
            }} />,
        });
    };
};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface SongLengthSecondsColumnArgs {
    columnName: string;
    cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
};

export class SongLengthSecondsColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: SongLengthSecondsColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            isAutoFocusable: true,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        // TODO: this can be enhanced like renderForNewDialog
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

    // TODO: this can be enhanced like renderForNewDialog
    renderViewer = (params: DB3ClientCore.RenderViewerArgs<number>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        isReadOnly={!this.editable}
        fieldName={this.columnName}
    />;

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const val = params.value as (number | null);
        // for values which are not numeric, simply display as "".
        //const displayValue = (val == null) || isNaN(val) ? "" : `${val}`;

        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            className: `field_${this.columnName}`,
            value: <SongLengthInput
                initialValue={val}
                readonly={!this.editable}
                onChange={(val) => {
                    params.api.setFieldValues({ [this.columnName]: CoerceToNumberOrNull(val) });
                }} />,
        });
    };
};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface BoolColumnArgs {
    columnName: string;
    //cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
};

export class BoolColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: BoolColumnArgs) {
        super({
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            width: 80,//args.cellWidth,
            isAutoFocusable: false,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
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

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<boolean>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={!!params.value ? "Yes" : "No"}
        fieldName={this.columnName}
        isReadOnly={!this.editable}
    />;

    // TODO: use defaultRenderer. the problem with a bool field is that the checkbox itself is very small, so the clickable label is really important.
    // so, TODO: add click-to-focus support to <NameValuePair>
    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        return <FormControlLabel className='CMFormControlLabel' label={this.fieldCaption || this.schemaColumn.member} control={
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
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
};

export class ColorColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: ColorColumnArgs) {
        super({
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            className: args.className,
            isAutoFocusable: false,
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

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<ColorPaletteEntry | null>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={<ColorSwatch color={params.value} variation={{ enabled: true, selected: true, fillOption: "filled", variation: "strong" }} />}
        fieldName={this.columnName}
        isReadOnly={!this.editable}
    />

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
export interface ConstEnumStringFieldClientItemInfo {
    color?: string | null;
    label?: string;
    descriptionMarkdownSettingKey?: string;
};

export interface ConstEnumStringFieldClientArgs {
    columnName: string;
    cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
    allowNull?: boolean;
    getItemInfo?: (option: { value: string, label: string }) => ConstEnumStringFieldClientItemInfo;
};

export class ConstEnumStringFieldClient extends DB3ClientCore.IColumnClient {
    gridOptions: { value: string, label: string }[];
    allowNull: boolean;
    enumSchemaColumn: db3fields.ConstEnumStringField;
    getItemInfo?: (option: { value: string, label: string }) => ConstEnumStringFieldClientItemInfo;

    constructor(args: ConstEnumStringFieldClientArgs) {
        super({
            columnName: args.columnName,
            isAutoFocusable: true,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
            className: args.className,
            visible: true,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
        this.getItemInfo = args.getItemInfo;
        this.allowNull = CoalesceBool(args.allowNull, true);
    }
    ApplyClientToPostClient = undefined;

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<string>) => <NameValuePair
        className={params.className}
        name={this.columnName}
        value={params.value}
        isReadOnly={!this.editable}
        fieldName={this.columnName}
    />

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

        let selectedDescriptionSettingMarkdownKey: string | undefined = undefined;
        if (this.getItemInfo) {
            const selectedOption = this.gridOptions.find(o => o.value === value)!;
            const selectedInfo = this.getItemInfo(selectedOption);
            selectedDescriptionSettingMarkdownKey = selectedInfo.descriptionMarkdownSettingKey;
        }

        const handleClick = (val: typeof this.gridOptions[0]) => {
            const dbval = val.value === gNullValue ? null : val.value;
            return params.api.setFieldValues({ [this.schemaColumn.member]: dbval });
        };

        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            className: "constEnumStringField",
            value: <div>
                <CMChipContainer className="constEnumStringFieldOptions" key={params.key}>
                    {this.gridOptions.map(option => {
                        let color: string | undefined = undefined;
                        let label: string = option.label;
                        if (this.getItemInfo) {
                            const itemInfo = this.getItemInfo(option);
                            color = itemInfo.color || color;
                            label = itemInfo.label || label;
                        }
                        return <CMChip
                            className={`selectable option ${value === option.value ? "selected" : "notSelected"}`}
                            key={option.value}
                            onClick={() => handleClick(option)}
                            color={color}
                            shape="rectangle"
                            variation={{
                                selected: value === option.value,
                                fillOption: "filled",
                                variation: "strong",
                                enabled: true,
                            }}
                        >
                            {label}
                        </CMChip>;
                    })}
                </CMChipContainer>
                {selectedDescriptionSettingMarkdownKey && <div className="description">
                    <Suspense>
                        <SettingMarkdown setting={selectedDescriptionSettingMarkdownKey as any} />
                    </Suspense>
                </div>}
            </div>
        });

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
                allowNull={this.allowNull}
                readonly={false}
                onOK={(value) => {
                    void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                }}
            />;
        };
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {
        const value = (params.value === null ? gNullValue : params.value as string);
        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            value: <Select
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

        });

    };
    ;

};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMDatePickerProps {
    autoFocus?: boolean,
    label?: string,
    value: Date | null,
    onChange: (value: Date | null) => void,
    allowNull?: boolean, // default falsy
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
                setDatePickerValue(d);
                //invokeOnChange();
            }}
            className={noDateChecked ? "CMDatePicker CMDisabled" : "CMDatePicker CMEnabled"}

        />
        {props.allowNull &&
            <FormControlLabel className='CMFormControlLabel' control={<Checkbox
                checked={!noDateChecked}
                onChange={(e) => {
                    setNoDateChecked(!e.target.checked);
                    if (e.target.checked) {
                        setQueueFocus(true);
                    }
                    //invokeOnChange();
                }}
            />} label="Specify a date" />

        }
    </>
        ;

};



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CreatedAtColumnArgs {
    columnName: string;
    cellWidth: number;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    className?: string;
};


export class CreatedAtColumn extends DB3ClientCore.IColumnClient {
    typedSchemaColumn: db3fields.CreatedAtField;

    constructor(args: CreatedAtColumnArgs) {
        super({
            columnName: args.columnName,
            isAutoFocusable: false,
            editable: true,
            headerName: args.columnName,
            width: args.cellWidth,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
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
        return <NameValuePair
            className={params.className}
            name={this.columnName}
            value={<>{value.toTimeString()} {ageStr}</>}// todo
            isReadOnly={!this.editable}
            fieldName={this.columnName}
        />;
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




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeColumnArgs {
    columnName: string;
    fieldCaption?: string;
    className?: string;
};


export class DateTimeColumn extends DB3ClientCore.IColumnClient {
    //typedSchemaColumn: db3fields.CreatedAtField;

    constructor(args: DateTimeColumnArgs) {
        super({
            columnName: args.columnName,
            isAutoFocusable: true,
            editable: true,
            headerName: args.columnName,
            width: 150,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: null,
        });
    }
    ApplyClientToPostClient = undefined;

    onSchemaConnected = (tableClient: DB3ClientCore.xTableRenderClient) => {
        //this.typedSchemaColumn = this.schemaColumn as db3fields.CreatedAtField;
        this.GridColProps = {
            type: "dateTime",
            renderCell: (params: GridRenderCellParams) => {
                if (params.value === null) {
                    return <>--</>;
                }
                const value = params.value as Date;
                const now = new Date();
                const ageStr = `(${formatTimeSpan(value, now)} ago)`;
                return <>{value.toLocaleString()} {ageStr}</>; // todo
            },
            renderEditCell: (params: GridRenderEditCellParams) => {
                if (params.value === null) {
                    return <>--</>;
                }
                const value = params.value as Date;
                const now = new Date();
                //const age = new TimeSpan(now.valueOf() - value.valueOf());
                const ageStr = `(${formatTimeSpan(now, value)} ago)`;
                return <>{value.toLocaleString()} {ageStr}</>; // todo
            },
        };
    };

    renderViewer = (params: DB3ClientCore.RenderViewerArgs<Date>) => {
        const value = params.value;
        const now = new Date();
        const ageStr = `(${formatTimeSpan(value, now)} ago)`;
        return <NameValuePair
            className={params.className}
            name={this.columnName}
            value={<>{!!value ? value.toLocaleString() : "--"} {ageStr}</>} // todo
            isReadOnly={!this.editable}
            fieldName={this.columnName}
        />;
    };

    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => {

        // while editing, the value literally becomes a string type instead of date type.
        let valueAsString: string = "";
        if (!!params.value) {
            // if (typeof params.value === "string") {
            //     valueAsString = params.value as string;
            // } else if (typeof params.value === "object") { // assume date type
            valueAsString = (params.value as Date).toLocaleString();
            //}
        }

        return this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            value: <div>
                <CMTextInputBase
                    onChange={(e, val) => {
                        const date = IsNullOrWhitespace(val) ? null : new Date(val); // convert to kosher value.
                        params.api.setFieldValues({ [this.columnName]: date });
                    }}
                    initialValue={valueAsString}
                />
                <div>{valueAsString}</div>
            </div>
        });

        // const vr = this.schemaColumn.ValidateAndParse({ row: params.row, mode: "new", clientIntention: params.clientIntention });

        // // set the calculated value in the object.
        // if (params.value === undefined && vr.values) {
        //     params.api.setFieldValues(vr.values);
        // }

        // //const value = vr.parsedValue as Date;
        // const value = params.row[this.columnName];
        // const now = new Date();
        // //const age = new TimeSpan(now.valueOf() - value.valueOf());
        // const ageStr = `(${formatTimeSpan(now, value)} ago)`;
        // return <>{!!value ? value.toTimeString() : "--"} {ageStr}</>; // todo
    };
};




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for generic non-UI support for any column type
export interface AnyColumnArgs {
    columnName: string;
};

export class AnyColumnClient extends DB3ClientCore.IColumnClient {
    constructor(args: AnyColumnArgs) {
        super({
            fieldCaption: args.columnName,
            fieldDescriptionSettingName: undefined,
            columnName: args.columnName,
            editable: true,
            headerName: args.columnName,
            className: undefined,
            isAutoFocusable: false,
            width: 100,
            visible: true,
        });
    }

    ApplyClientToPostClient = undefined;
    onSchemaConnected() { };
    renderViewer = (params: DB3ClientCore.RenderViewerArgs<ColorPaletteEntry | null>) => <></>
    renderForNewDialog = (params: DB3ClientCore.RenderForNewItemDialogArgs) => <></>
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const useInsertMutationClient = (schema: db3.xTable) => {
    const ctx = useDashboardContext();
    const mutationCtx = DB3ClientCore.useTableRenderContext({
        clientIntention: ctx.userClientIntention,
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: new DB3ClientCore.xTableClientSpec({
            table: schema,
            columns: schema.columns.map(c => new AnyColumnClient({ columnName: c.member })),
        }),
    });
    return mutationCtx;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface UseDb3QueryArgs {
    schema: db3.xTable;
    filterSpec?: CMDBTableFilterModel | undefined;
    enable?: boolean;
};

export interface UseDb3QueryArgsWithEnable extends UseDb3QueryArgs {
    enable: boolean;
};

// Overload: when enable is explicitly provided, return type includes undefined
export function useDb3Query<Trow extends TAnyModel>(args: UseDb3QueryArgsWithEnable): DB3ClientCore.xTableRenderClient<Trow> | undefined;
// Overload: when enable is not provided (or optional), return type never includes undefined  
export function useDb3Query<Trow extends TAnyModel>(args: UseDb3QueryArgs): DB3ClientCore.xTableRenderClient<Trow>;
// Implementation
export function useDb3Query<Trow extends TAnyModel>({ enable = true, schema, filterSpec }: UseDb3QueryArgs): DB3ClientCore.xTableRenderClient<Trow> | undefined {
    const ctx = useDashboardContext();
    if (!enable) {
        return undefined;
    }
    const mutationCtx = DB3ClientCore.useTableRenderContext<Trow>({
        clientIntention: ctx.userClientIntention,
        requestedCaps: DB3ClientCore.xTableClientCaps.Query,
        tableSpec: new DB3ClientCore.xTableClientSpec({
            table: schema,
            columns: schema.columns.map(c => new AnyColumnClient({ columnName: c.member })),
        }),
        filterModel: filterSpec,
    });
    return mutationCtx;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const useDb3Update = <Trow extends TAnyModel,>(schema: db3.xTable) => {
    const ctx = useDashboardContext();
    const mutationCtx = DB3ClientCore.useTableRenderContext<Trow>({
        clientIntention: ctx.userClientIntention,
        requestedCaps: DB3ClientCore.xTableClientCaps.Mutation,
        tableSpec: new DB3ClientCore.xTableClientSpec({
            table: schema,
            columns: schema.columns.map(c => new AnyColumnClient({ columnName: c.member })),
        }),
    });
    return mutationCtx;
}

