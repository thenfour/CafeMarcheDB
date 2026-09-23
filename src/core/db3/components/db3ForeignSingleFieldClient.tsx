'use client';

import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";

import { useMutation, useQuery } from "@blitzjs/rpc";
import { Box } from "@mui/material";
import type { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { assert } from "blitz";
import React from "react";
import { SplitQuickFilter } from "shared/quickFilter";
import type { SettingKey } from "shared/settingKeys";
import { Coalesce, gQueryOptions, parseIntOrNull } from "shared/utils";
import updateSetting from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { CMChip, CMChipContainer, type CMChipSizeOptions } from "src/core/components/CMChip";
import { useIsShowingAdminControls } from "src/core/components/CMCoreComponents2";
import { SelectionPicker } from "src/core/components/select/SelectionPicker";
import { SelectionEditButton, SelectionFieldFrame } from "src/core/components/select/SelectionField";
import { CMSelectNullBehavior, SelectionSource, singleSelectionValue, withNullSelection } from "src/core/components/select/selectionSource";
import { SelectionValue } from "src/core/components/select/SelectionOptions";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { GenerateForeignSingleSelectStyleSettingName, SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "../db3";
import db3queries from "../queries/db3queries";
import type { CMDBTableFilterModel } from "../shared/apiTypes";
import { IColumnClient, type RenderForNewItemDialogArgs, type RenderViewerArgs, xTableRenderClient } from "./DB3ClientCore";
import { RenderMuiIcon } from "./IconMap";
import { type CrudViewCreateToken, useCrudViewCreate } from "./useCrudViewCreate";
import { type ColorPaletteEntry, type ColorVariationSpec, StandardVariationSpec } from "../../components/color/palette";
import { TAnyModel } from "@/shared/rootroot";




export type InsertFromStringParams = {
    mutation: any, // async mutation(input)
    input: string,
};

export interface RenderAsChipParams<T> {
    value: T | null;
    colorVariant: ColorVariationSpec;
    onDelete?: () => void;
    onClick?: () => void;
}



export interface ForeignSingleFieldInputProps<TForeign extends TAnyModel> {
    // stuff that could be just passing in a table spec...
    columnName: string;
    tableName: string;
    foreignSpec: ForeignSingleFieldClient<TForeign>;
    allowNull: boolean;

    value: TForeign | null;
    onChange: (value: TForeign | null) => void;
    validationError?: string | null;
    readOnly: boolean;

    selectStyle: "inline" | "dialog";
    inlineSelectOpenDialogButtonCaption?: React.ReactNode;
    openDialogButtonCaption?: React.ReactNode;
};

export const ForeignSingleFieldInlineValues = <TForeign extends TAnyModel,>(props: ForeignSingleFieldInputProps<TForeign>) => {
    const db3Context = useForeignSingleFieldRenderContext({
        filterText: "",
        spec: props.foreignSpec,
    });
    let items = db3Context.items;
    const fs = props.foreignSpec.typedSchemaColumn.getForeignTableSchema();
    if (fs.activeAsSelectable) {
        items = items.filter(o => fs.activeAsSelectable!(o as any));
    }

    const isEqual = (a: TForeign | null, b: TForeign | null) => {
        const anull = (a === null || a === undefined);
        const bnull = (b === null || b === undefined);
        if (anull && bnull) {
            return true;
        }
        if (anull !== bnull) {
            return false;
        }
        // both non-null.
        const ret = a![props.foreignSpec.typedSchemaColumn.getForeignTableSchema().clientIdMember] === b![props.foreignSpec.typedSchemaColumn.getForeignTableSchema().clientIdMember];
        return ret;
    };

    const handleItemClick = (value: TForeign | null) => {
        if (!props.readOnly) props.onChange(value);
    };

    const nullItem = props.allowNull && props.foreignSpec.args.renderAsChip!({
        value: null,
        onClick: props.readOnly ? undefined : () => handleItemClick(null),
        colorVariant: {
            selected: props.value === null,
            enabled: !props.readOnly,
            variation: (props.value === null) ? "strong" : "weak",
            fillOption: "filled",
        }
    });

    return <>
        {nullItem}
        {items.map(item => {
            const selected = isEqual(item, props.value);
            return <React.Fragment key={item[props.foreignSpec.typedSchemaColumn.getForeignTableSchema().clientIdMember]}>
                {props.foreignSpec.args.renderAsChip!({
                    value: item,
                    // this doesn't work and isn't really useful anyway.
                    //onDelete: props.allowNull ? () => handleItemClick(null) : undefined,
                    // onDelete: selected ? (() => {
                    //     handleItemClick(null)
                    // }) : undefined,
                    onClick: props.readOnly ? undefined : () => handleItemClick(item),
                    colorVariant: {
                        selected,
                        enabled: !props.readOnly,
                        variation: selected ? "strong" : "weak",
                        fillOption: "filled",
                    }
                })}</React.Fragment>

        })}
    </>;
};

// general use "edit cell" for foreign single values. does not show a label or validation stuff; just the value and a button to select
export const ForeignSingleFieldInput = <TForeign extends TAnyModel,>(props: ForeignSingleFieldInputProps<TForeign>) => {

    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    const isShowingAdminControls = useIsShowingAdminControls();

    const [setSetting] = useMutation(updateSetting);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const selectStyleSetting = GenerateForeignSingleSelectStyleSettingName(props.tableName, props.columnName);
    const [selectStyleSettingValue] = useQuery(getSetting, { name: selectStyleSetting });//  API.settings.useSetting(selectStyleSetting);
    const selectStyle = (selectStyleSettingValue || props.selectStyle) as ("inline" | "dialog");
    const newProps = { ...props };
    newProps.selectStyle = selectStyle;

    const chip = selectStyle === "dialog" ? <SelectionValue>{props.foreignSpec.args.renderAsChip!({
        value: props.value,
        colorVariant: StandardVariationSpec.Strong,
    })}</SelectionValue> : (
        <ForeignSingleFieldInlineValues {...newProps} />
    );

    assert(!!props.foreignSpec.typedSchemaColumn, "schema is not connected to the table spec. you probably need to initiate the client render context");

    const handleChangeSetting = (newVal: ("inline" | "dialog" | null)) => {
        setSetting({ name: selectStyleSetting, value: newVal }).then((x) => {
            showSnackbar({ children: "Saved", severity: 'success' });
        }).catch((err => {
            console.log(err);
            showSnackbar({ children: "Error", severity: 'error' });
        }));
    };

    const defaultCaption = props.value == null ? "Select" : "Edit";
    const openDialogCaption = (selectStyle === "dialog" ? props.openDialogButtonCaption : props.inlineSelectOpenDialogButtonCaption) || defaultCaption;

    const openDialogButton = !props.readOnly && <SelectionEditButton
        label={typeof openDialogCaption === "string" && openDialogCaption !== defaultCaption ? openDialogCaption : `${defaultCaption} ${props.foreignSpec.selectionCaption}`}
        onClick={() => setIsOpen(true)}
    >{openDialogCaption}</SelectionEditButton>;

    return <Box>
        {isShowingAdminControls && <CMChipContainer className="adminControlFrame">
            <CMChip size="small" onClick={() => handleChangeSetting("inline")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "inline" }}>inline</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting("dialog")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "dialog" }}>dialog</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting(null)} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyleSettingValue === null }}>default</CMChip>
        </CMChipContainer>}
        <SelectionFieldFrame>
            {chip}
            {openDialogButton}
        </SelectionFieldFrame>
        {isOpen && !props.readOnly && <SelectSingleForeignDialog

            closeOnSelect={true}
            allowNull={props.allowNull}
            value={props.value}
            spec={props.foreignSpec}
            onOK={(newValue: TForeign | null) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                setIsOpen(false);
            }}
        />
        }
    </Box>;
};




export interface ForeignSingleFieldNullItemInfo {
    label: string;
    color: ColorPaletteEntry | string | null;
    tooltip: string | null;
};

export interface ForeignSingleFieldClientArgs<TForeign extends TAnyModel> {
    columnName: string;
    cellWidth?: number;
    // the db3 view used for populating selection dialogs
    selectionView?: db3.AnyDB3CrudView;

    renderAsChip?: (args: RenderAsChipParams<TForeign>) => React.ReactNode;

    // Renders option content; the dialog supplies the row and selection control.
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TForeign, selected: boolean) => React.ReactNode;

    visible?: boolean;
    className?: string;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;

    selectStyle?: "inline" | "dialog";
    inlineSelectMoreButtonText?: React.ReactNode;
    nullItemInfo?: ForeignSingleFieldNullItemInfo; // for displaying a null item, which of course has no db info... especially useful for visiblePermissionId where a null value represents "private visibility" so displaying "NULL" or "--" is especially bad.
    size?: CMChipSizeOptions;
};

// the client-side description of the field, used in xTableClient construction.
export class ForeignSingleFieldClient<TForeign extends TAnyModel> extends IColumnClient {
    typedSchemaColumn: db3.ForeignSingleField<TForeign>;
    args: ForeignSingleFieldClientArgs<TForeign>;

    fixedValue: TForeign | null | undefined;


    selectStyle: "inline" | "dialog";
    size: CMChipSizeOptions;

    get selectionCaption(): string {
        return this.fieldCaption || this.columnName.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
    }

    getSelectionLabel = (value: TForeign | null): string => value == null
        ? this.args.nullItemInfo?.label || "None"
        : this.typedSchemaColumn.getForeignTableSchema().getRowInfo(value).name;

    constructor(args: ForeignSingleFieldClientArgs<TForeign>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth ?? 150,
            isAutoFocusable: false,
            visible: Coalesce(args.visible, true),
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });

        this.args = args;
        this.size = args.size || "big";
        this.fixedValue = undefined; // for the moment it's not known.
        this.selectStyle = args.selectStyle || "dialog";
    }

    projectMutation = (clientRow: TAnyModel) => ({
        [this.typedSchemaColumn.fkidMember!]: clientRow[this.typedSchemaColumn.fkidMember!],
        [this.columnName]: clientRow[this.columnName],
    });

    ApplyClientToPostClient = undefined;

    defaultRenderAsChip = (args: RenderAsChipParams<TForeign>) => {
        if (!args.value) {
            const caption = this.getSelectionLabel(null);
            const color = this.args.nullItemInfo?.color || null;
            const tooltip = this.args.nullItemInfo?.tooltip || null;
            return <CMChip
                className={"foreignSingleValue nullValue"}
                color={color}
                tooltip={tooltip}
                onClick={args.onClick}
                variation={args.colorVariant}
                shape="rectangle" // because tags are round
                size={this.size}
            >
                {caption}
            </CMChip>;
        }

        const rowInfo = this.typedSchemaColumn.getForeignTableSchema().getRowInfo(args.value);

        return <CMChip
            className={"foreignSingleValue"}
            color={rowInfo.color}
            tooltip={Coalesce(rowInfo.description, rowInfo.name)}
            onClick={args.onClick}
            onDelete={args.onDelete}
            variation={args.colorVariant}
            shape="rectangle" // because tags are round
            size={this.size}
        >
            {rowInfo.name}
            {RenderMuiIcon(rowInfo.iconName)}
        </CMChip>;
    };

    defaultRenderAsListItem = (_props, value, _selected) => this.args.renderAsChip!({
        value, colorVariant: StandardVariationSpec.Strong,
    });

    renderViewer = (params: RenderViewerArgs<TForeign>) => this.defaultRenderer({
        //key: params.key,
        isReadOnly: true,
        validationResult: undefined,
        className: params.className,
        //name: this.columnName,
        value: <>{this.defaultRenderAsChip({ value: params.value, colorVariant: StandardVariationSpec.Strong })}</>,
    });

    onSchemaConnected = (tableClient: xTableRenderClient<any, any>) => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;


        if (tableClient.args.filterModel?.tableParams && tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkidMember!] != null) {
            const foreignTable = this.typedSchemaColumn.getForeignTableSchema();
            const rawForeignId = tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkidMember!];
            const filter: CMDBTableFilterModel = foreignTable.publicIdMember
                ? { items: [], publicIds: [String(rawForeignId)] } // todo: a helper to coerce rawForeignId to a public id for this table; in theory it may not be a string.
                : {
                    items: [{
                        field: foreignTable.pkMember,
                        operator: "equals",
                        value: parseIntOrNull(rawForeignId),
                    }],
                };

            const queryInput: db3.QueryRequestInput = {
                table: this.typedSchemaColumn.getForeignTableSchema(),
                orderBy: undefined,
                filter,
                cmdbQueryContext: `ForeignSingleFieldClient querying table ${this.typedSchemaColumn.getForeignTableSchema().tableName} for table.column ${this.schemaTable.tableName}.${this.columnName}`
            };

            const [{ items }, { refetch }] = useQuery(db3queries, queryInput, gQueryOptions.default);
            if (items.length !== 1) {
                console.error(`table params ${JSON.stringify(tableClient.args.filterModel?.tableParams)} object not found for ${this.typedSchemaColumn.fkidMember!}. Maybe data obsolete? Maybe you manually typed in the query?`);
            }
            else {
                this.fixedValue = items[0] as any;
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
                    {this.args.renderAsChip!({ value: args.value, colorVariant: StandardVariationSpec.Strong })}
                </div>;
            },
            sortable: false, // https://github.com/thenfour/CafeMarcheDB/issues/120
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse({ row: params.row, mode: "update" });
                return <ForeignSingleFieldInput
                    tableName={this.schemaTable.tableName}
                    columnName={this.columnName}
                    allowNull={this.typedSchemaColumn.allowNull}
                    validationError={vr.result === "success" ? null : vr.errorMessage || null}
                    selectStyle={this.selectStyle}

                    foreignSpec={this}
                    readOnly={false} // always allow switching this; for admin purposes makes sense
                    value={params.value}
                    onChange={(value) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.args.columnName, value });//.then(() => {
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {

        let value = params.value;

        // for NEW items, use the fixed value passed in as table params.
        // so when you filter by some master object (editing event segments for event XYZ), the master object is a fixed and pre-selected.
        if (this.fixedValue != null) {
            const foreignPkMember = this.typedSchemaColumn.getForeignTableSchema().clientIdMember;
            const currentVal = params.row[this.typedSchemaColumn.member];
            if (currentVal === null || (this.fixedValue[foreignPkMember] !== currentVal[foreignPkMember])) {
                value = this.fixedValue;
                params.api.setFieldValues({
                    [this.args.columnName]: value,
                    [this.typedSchemaColumn.fkidMember!]: !!value ? value[foreignPkMember] : null,
                });
            }
        }

        const validationValue = params.validationResult ? (params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null) : undefined;

        return this.defaultRenderer({
            isReadOnly: !!this.fixedValue,
            validationResult: params.validationResult,
            value: <React.Fragment key={params.key}>
                <ForeignSingleFieldInput
                    foreignSpec={this}
                    tableName={this.schemaTable.tableName}
                    columnName={this.columnName}
                    allowNull={this.typedSchemaColumn.allowNull}
                    selectStyle={this.selectStyle}
                    readOnly={!!this.fixedValue}

                    validationError={validationValue}
                    value={value as any}
                    onChange={(newValue: TForeign | null) => {
                        const foreignPkMember = this.typedSchemaColumn.getForeignTableSchema().clientIdMember;
                        params.api.setFieldValues({
                            [this.args.columnName]: newValue,
                            [this.typedSchemaColumn.fkidMember!]: !!newValue ? newValue[foreignPkMember] : null,
                        });
                    }}
                />
            </React.Fragment>
        });
    };
};


export const foreignRefFieldGen = <TForeign extends TAnyModel>(args: Omit<ForeignSingleFieldClientArgs<TForeign>, "columnName">) => (
    (columnName: string) => new ForeignSingleFieldClient<TForeign>({ ...args, columnName })
);



export interface ForeignSingleFieldRenderContextArgs<TForeign extends TAnyModel> {
    spec: ForeignSingleFieldClient<TForeign>;
    filterText: string;
    // Dialog controls remain mounted while the query loads or fails.
    suspense?: boolean;
};

// the "live" adapter handling server-side comms.
export class ForeignSingleFieldRenderContext<TForeign extends TAnyModel> {
    args: ForeignSingleFieldRenderContextArgs<TForeign>;
    crudCreate?: CrudViewCreateToken<db3.AnyDB3CrudView>;

    items: TForeign[];
    refetch: () => void;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    isPreviousData: boolean;

    constructor(args: ForeignSingleFieldRenderContextArgs<TForeign>) {
        this.args = args;
        const foreignSchema = this.args.spec.typedSchemaColumn.getForeignTableSchema();
        const selectionView = this.args.spec.args.selectionView;
        if (selectionView && selectionView.entity !== foreignSchema) {
            throw new Error(
                `DB3 CRUD view '${selectionView.viewID}' does not belong to table '${foreignSchema.tableID}'.`,
            );
        }
        if (this.args.spec.typedSchemaColumn.allowInsertFromString && !selectionView) {
            throw new Error(
                `Foreign field '${this.args.spec.columnName}' requires a selectionView to create options.`,
            );
        }
        const dashboard = useDashboardContext();
        this.crudCreate = useCrudViewCreate(selectionView);

        const [result, queryStatus] = useQuery(db3queries, {
            table: {
                tableID: foreignSchema.tableID,
                tableName: foreignSchema.tableName,
                viewID: selectionView?.viewID,
            },
            orderBy: undefined,
            filter: {
                quickFilterValues: SplitQuickFilter(args.filterText),
            },
            cmdbQueryContext: "ForeignSingleFieldRenderContext",
        }, {
            ...gQueryOptions.default,
            suspense: args.suspense ?? true,
            ...(args.suspense === false ? { useErrorBoundary: false } : {}),
            keepPreviousData: args.suspense === false,
        });
        this.items = selectionView
            ? (result?.items || []).map(item => db3.hydrateView(
                selectionView,
                selectionView.parseDto(item),
                dashboard.referenceStore,
            ) as TForeign)
            : (result?.items || []) as TForeign[];
        this.refetch = queryStatus.refetch;
        this.isLoading = queryStatus.isLoading;
        this.isFetching = queryStatus.isFetching;
        this.isError = queryStatus.isError;
        this.isPreviousData = queryStatus.isPreviousData;
    }

    doInsertFromString = async (userInput: string): Promise<TForeign> => {
        console.assert(!!this.args.spec.typedSchemaColumn.getForeignTableSchema().createInsertModelFromString);
        const insertModel = this.args.spec.typedSchemaColumn.getForeignTableSchema().createInsertModelFromString!(userInput);
        if (!this.crudCreate) {
            throw new Error(
                `Foreign field '${this.args.spec.columnName}' requires a selectionView to create options.`,
            );
        }
        // The runtime view/table equality check above proves that the hydrated
        // create result belongs to this legacy field's foreign-row contract.
        return await this.crudCreate.create(insertModel) as TForeign;
    };
};

export const useForeignSingleFieldRenderContext = <TForeign extends TAnyModel,>(args: ForeignSingleFieldRenderContextArgs<TForeign>) => {
    return new ForeignSingleFieldRenderContext<TForeign>(args);
};



////////////////////////////////////////////////////////
export interface SelectSingleForeignDialogProps<TForeign extends TAnyModel> {
    value: TForeign | null;
    spec: ForeignSingleFieldClient<TForeign>;
    onOK: (value: TForeign | null) => void;
    onCancel: () => void;
    closeOnSelect: boolean;
    allowNull?: boolean;
    caption?: string;
    descriptionSettingName?: SettingKey;
};

export function SelectSingleForeignDialogInner<TForeign extends TAnyModel>(props: SelectSingleForeignDialogProps<TForeign>) {
    const foreignSchema = props.spec.typedSchemaColumn.getForeignTableSchema();
    const allowNull = props.spec.typedSchemaColumn.allowNull && (props.allowNull ?? true);
    const nullBehavior = allowNull ? CMSelectNullBehavior.AllowNull : CMSelectNullBehavior.NonNullable;
    const descriptionSettingName = props.descriptionSettingName || props.spec.fieldDescriptionSettingName;
    const source: SelectionSource<TForeign> = {
        getKey: item => item[foreignSchema.clientIdMember],
        getLabel: props.spec.getSelectionLabel,
        renderValue: item => props.spec.args.renderAsChip!({ value: item, colorVariant: StandardVariationSpec.Strong }),
        renderOption: (item, selected) => props.spec.args.renderAsListItem!({}, item, selected),
        matchesText: (item, text) => foreignSchema.doesItemExactlyMatchText(item, text),
        useOptions(filterText) {
            const query = useForeignSingleFieldRenderContext({ spec: props.spec, filterText, suspense: false });
            const publicData = useDB3Authorization();
            const { showMessage } = React.useContext(SnackbarContext);
            const canCreate = props.spec.typedSchemaColumn.allowInsertFromString
                && !!foreignSchema.createInsertModelFromString
                && !!query.crudCreate
                && foreignSchema.authorizeRowBeforeInsert({ publicData });
            return {
                ...query,
                createOption: canCreate ? async text => {
                    const item = await query.doInsertFromString(text);
                    showMessage({ children: "New option created", severity: "success" });
                    return item;
                } : undefined,
            };
        },
    };
    return <SelectionPicker
        source={withNullSelection(source, nullBehavior, () => props.spec.args.renderAsChip!({ value: null, colorVariant: StandardVariationSpec.Strong }), props.spec.getSelectionLabel(null))}
        value={singleSelectionValue(props.value, nullBehavior)}
        closeOnSelect={props.closeOnSelect}
        title={props.caption || `Select ${props.spec.selectionCaption}`}
        description={descriptionSettingName ? <SettingMarkdown setting={descriptionSettingName} /> : undefined}
        onCancel={props.onCancel} onAccept={values => props.onOK(values[0]!)}
    />;
}

export function SelectSingleForeignDialog<TForeign extends TAnyModel>(props: SelectSingleForeignDialogProps<TForeign>) {
    return <SelectSingleForeignDialogInner {...props} />;
}
