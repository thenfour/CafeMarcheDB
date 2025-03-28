'use client';

import { useAuthenticatedSession } from "@blitzjs/auth";
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon
} from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
    Box, Button, DialogActions, DialogContent, DialogTitle,
    Divider,
    List,
    ListItemButton
} from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { assert } from "blitz";
import React, { Suspense } from "react";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec } from "shared/color";
import { Coalesce, gQueryOptions, parseIntOrNull } from "shared/utils";
import { AdminInspectObject } from 'src/core/components/CMCoreComponents';
import { CMDialogContentText, CMSmallButton, useIsShowingAdminControls } from "src/core/components/CMCoreComponents2";
import { GenerateForeignSingleSelectStyleSettingName, SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import updateSetting from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import { SearchInput } from "src/core/components/CMTextField";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import { IColumnClient, RenderForNewItemDialogArgs, RenderViewerArgs, TMutateFn, xTableRenderClient } from "./DB3ClientCore";
import { TAnyModel } from "../shared/apiTypes";
import { RenderMuiIcon } from "./IconMap";
import { CMChip, CMChipContainer, CMChipSizeOptions } from "src/core/components/CMChip";
import { ReactiveInputDialog } from "src/core/components/ReactiveInputDialog";
import { SettingKey } from "shared/settings";
import { SplitQuickFilter } from "shared/quickFilter";




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
    clientIntention: db3.xTableClientUsageContext,
    selectStyle: "inline" | "dialog";
    inlineSelectOpenDialogButtonCaption?: React.ReactNode;
    openDialogButtonCaption?: React.ReactNode;
};

export const ForeignSingleFieldInlineValues = <TForeign extends TAnyModel,>(props: ForeignSingleFieldInputProps<TForeign>) => {
    //const publicData = useAuthenticatedSession();
    const db3Context = useForeignSingleFieldRenderContext({
        filterText: "",
        spec: props.foreignSpec,
        clientIntention: props.clientIntention,
    });
    let items = db3Context.items;
    const fs = props.foreignSpec.typedSchemaColumn.getForeignTableSchema();
    if (fs.activeAsSelectable) {
        items = items.filter(o => fs.activeAsSelectable!(o as any, props.clientIntention));
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
        const ret = a![props.foreignSpec.typedSchemaColumn.getForeignTableSchema().pkMember] === b![props.foreignSpec.typedSchemaColumn.getForeignTableSchema().pkMember];
        return ret;
    };

    const handleItemClick = (value: TForeign | null) => {
        props.onChange(value);
    };

    const nullItem = props.allowNull && props.foreignSpec.args.renderAsChip!({
        value: null,
        onClick: () => handleItemClick(null),
        colorVariant: {
            selected: props.value === null,
            enabled: true,
            variation: (props.value === null) ? "strong" : "weak",
            fillOption: "filled",
        }
    });

    return <>
        {nullItem}
        {items.map(item => {
            const selected = isEqual(item, props.value);
            return <React.Fragment key={item[props.foreignSpec.typedSchemaColumn.getForeignTableSchema().pkMember]}>
                {props.foreignSpec.args.renderAsChip!({
                    value: item,
                    // this doesn't work and isn't really useful anyway.
                    //onDelete: props.allowNull ? () => handleItemClick(null) : undefined,
                    // onDelete: selected ? (() => {
                    //     handleItemClick(null)
                    // }) : undefined,
                    onClick: () => handleItemClick(item),
                    colorVariant: {
                        selected,
                        enabled: true,
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
    //const [oldValue, setOldValue] = React.useState<TForeign | null>();
    // React.useEffect(() => {
    //     setOldValue(props.value);
    // }, []);

    const isShowingAdminControls = useIsShowingAdminControls();

    const [setSetting] = useMutation(updateSetting);

    //const setSetting = API.settings.updateSetting.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const selectStyleSetting = GenerateForeignSingleSelectStyleSettingName(props.tableName, props.columnName);
    const [selectStyleSettingValue] = useQuery(getSetting, { name: selectStyleSetting });//  API.settings.useSetting(selectStyleSetting);
    const selectStyle = (selectStyleSettingValue || props.selectStyle) as ("inline" | "dialog");
    const newProps = { ...props };
    newProps.selectStyle = selectStyle;

    const chip = selectStyle === "dialog" ? (props.foreignSpec.args.renderAsChip!({
        value: props.value,
        colorVariant: { ...StandardVariationSpec.Strong, selected: true },
        onClick: props.readOnly ? undefined : (() => {
            setIsOpen(!isOpen)
        }),
        onDelete: props.readOnly ? undefined : (() => {
            props.onChange(null);
        }),
    })) : (
        <CMChipContainer>
            <ForeignSingleFieldInlineValues {...newProps} />
        </CMChipContainer>
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

    // inlineSelectOpenDialogButtonCaption?: React.ReactNode;
    // openDialogButtonCaption?: React.ReactNode;
    const defaultCaption = `Select ${props.foreignSpec.typedSchemaColumn.member}...`;
    const openDialogCaption = (selectStyle === "dialog" ? props.openDialogButtonCaption : props.inlineSelectOpenDialogButtonCaption) || defaultCaption;

    const openDialogButton = !props.readOnly && <CMSmallButton onClick={() => { setIsOpen(!isOpen) }}>{openDialogCaption}</CMSmallButton>

    return <div className={`chipContainer`}>
        {isShowingAdminControls && <CMChipContainer className="adminControlFrame">
            <CMChip size="small" onClick={() => handleChangeSetting("inline")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "inline" }}>inline</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting("dialog")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "dialog" }}>dialog</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting(null)} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyleSettingValue === null }}>default</CMChip>
        </CMChipContainer>}
        {chip}
        {/* <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.foreignSpec.typedSchemaColumn.member}</Button> */}
        {openDialogButton}
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
                //props.onChange(oldValue || null);
                setIsOpen(false);
            }}
        />
        }
    </div>;
};




export interface ForeignSingleFieldNullItemInfo {
    label: string;
    color: ColorPaletteEntry | string | null;
    tooltip: string | null;
};

export interface ForeignSingleFieldClientArgs<TForeign extends TAnyModel> {
    columnName: string;
    cellWidth: number;

    renderAsChip?: (args: RenderAsChipParams<TForeign>) => React.ReactNode;

    // should render a <li {...props}> for autocomplete
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
    foreignClientIntention: db3.xTableClientUsageContext;

    selectStyle: "inline" | "dialog";
    size: CMChipSizeOptions;

    constructor(args: ForeignSingleFieldClientArgs<TForeign>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
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

    ApplyClientToPostClient = (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => {
        updateModel[this.typedSchemaColumn.fkMember] = clientRow[this.typedSchemaColumn.fkMember];
        updateModel[this.columnName] = clientRow[this.columnName];
    };

    defaultRenderAsChip = (args: RenderAsChipParams<TForeign>) => {
        if (!args.value) {
            const caption = this.args.nullItemInfo?.label || "--";
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

    defaultRenderAsListItem = (props, value, selected) => {
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: { ...StandardVariationSpec.Strong, selected } });
        return <div {...props} className="listItemRow">
            {/* {selected && <DoneIcon />} */}
            {chip}
            {selected && <CloseIcon />}
        </div>
    };

    renderViewer = (params: RenderViewerArgs<TForeign>) => this.defaultRenderer({
        //key: params.key,
        isReadOnly: true,
        validationResult: undefined,
        className: params.className,
        //name: this.columnName,
        value: <>{this.defaultRenderAsChip({ value: params.value, colorVariant: StandardVariationSpec.Strong })}</>,
    });

    onSchemaConnected = (tableClient: xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;

        // calculate a client intention based on the table. all args are the asme as the table, except the mode for the relation is primary.
        this.foreignClientIntention = {
            mode: "primary",
            intention: tableClient.args.clientIntention.intention,
            currentUser: tableClient.args.clientIntention.currentUser,
            relationPath: tableClient.args.clientIntention.relationPath,
        };


        if (tableClient.args.filterModel?.tableParams && tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember] != null) {
            const fkid = parseIntOrNull(tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember]);

            const queryInput: db3.QueryInput = {
                tableID: this.typedSchemaColumn.getForeignTableSchema().tableID,
                tableName: this.typedSchemaColumn.getForeignTableSchema().tableName,
                orderBy: undefined,
                clientIntention: this.foreignClientIntention,
                filter: {
                    items: [{
                        field: this.typedSchemaColumn.getForeignTableSchema().pkMember,
                        operator: "equals",
                        value: fkid,
                    }]
                },
                cmdbQueryContext: `ForeignSingleFieldClient querying table ${this.typedSchemaColumn.getForeignTableSchema().tableName} for table.column ${this.schemaTable.tableName}.${this.columnName}`
            };

            const [{ items }, { refetch }] = useQuery(db3queries, queryInput, gQueryOptions.default);
            if (items.length !== 1) {
                console.error(`table params ${JSON.stringify(tableClient.args.filterModel?.tableParams)} object not found for ${this.typedSchemaColumn.fkMember}. Maybe data obsolete? Maybe you manually typed in the query?`);
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
                const vr = this.typedSchemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                return <ForeignSingleFieldInput
                    tableName={this.schemaTable.tableName}
                    columnName={this.columnName}
                    allowNull={this.typedSchemaColumn.allowNull}
                    validationError={vr.result === "success" ? null : vr.errorMessage || null}
                    selectStyle={this.selectStyle}
                    clientIntention={this.foreignClientIntention}
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
            const foreignPkMember = this.typedSchemaColumn.getForeignTableSchema().pkMember;
            const currentVal = params.row[this.typedSchemaColumn.member];
            if (currentVal === null || (this.fixedValue[foreignPkMember] !== currentVal[foreignPkMember])) {
                value = this.fixedValue;
                params.api.setFieldValues({
                    [this.args.columnName]: value,
                    [this.typedSchemaColumn.fkMember]: !!value ? value[foreignPkMember] : null,
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
                    clientIntention={this.foreignClientIntention}
                    validationError={validationValue}
                    value={value as any}
                    onChange={(newValue: TForeign | null) => {
                        const foreignPkMember = this.typedSchemaColumn.getForeignTableSchema().pkMember;
                        params.api.setFieldValues({
                            [this.args.columnName]: newValue,
                            [this.typedSchemaColumn.fkMember]: !!newValue ? newValue[foreignPkMember] : null,
                        });
                    }}
                />
            </React.Fragment>
        });
    };
};





export interface ForeignSingleFieldRenderContextArgs<TForeign extends TAnyModel> {
    spec: ForeignSingleFieldClient<TForeign>;
    filterText: string;
    clientIntention: db3.xTableClientUsageContext,
};

// the "live" adapter handling server-side comms.
export class ForeignSingleFieldRenderContext<TForeign extends TAnyModel> {
    args: ForeignSingleFieldRenderContextArgs<TForeign>;
    mutateFn: TMutateFn;

    items: TForeign[];
    refetch: () => void;

    constructor(args: ForeignSingleFieldRenderContextArgs<TForeign>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        const [{ items }, { refetch }] = useQuery(db3queries, {
            tableID: args.spec.typedSchemaColumn.getForeignTableSchema().tableID,
            tableName: args.spec.typedSchemaColumn.getForeignTableSchema().tableName,
            orderBy: undefined,
            clientIntention: args.clientIntention,
            filter: { items: [], quickFilterValues: SplitQuickFilter(args.filterText) },
            cmdbQueryContext: "ForeignSingleFieldRenderContext",
        }, gQueryOptions.default);
        this.items = items as any;
        this.refetch = refetch;
    }

    doInsertFromString = async (userInput: string): Promise<TForeign> => {
        console.assert(!!this.args.spec.typedSchemaColumn.getForeignTableSchema().createInsertModelFromString);
        const insertModel = this.args.spec.typedSchemaColumn.getForeignTableSchema().createInsertModelFromString!(userInput);
        try {
            return await this.mutateFn({
                tableID: this.args.spec.typedSchemaColumn.getForeignTableSchema().tableID,
                tableName: this.args.spec.typedSchemaColumn.getForeignTableSchema().tableName,
                clientIntention: this.args.clientIntention,
                mutationType: "insert",
                insertModel,
            }) as TForeign;
        } catch (e) {
            // ?
            throw e;
        }
    };
};

export const useForeignSingleFieldRenderContext = <TForeign extends TAnyModel,>(args: ForeignSingleFieldRenderContextArgs<TForeign>) => {
    return new ForeignSingleFieldRenderContext<TForeign>(args);
};



////////////////////////////////////////////////////////
interface SelectSingleForeignDialogQuerierProps<TForeign extends TAnyModel> {
    spec: ForeignSingleFieldClient<TForeign>;
    clientIntention: db3.xTableClientUsageContext,
    filterText: string;
    allowCreateNew: boolean;

    onResults: (items: TForeign[]) => void;
    onSelectObj: (x: TForeign) => void;
};
export function SelectSingleForeignDialogQuerier<TForeign extends TAnyModel>(props: SelectSingleForeignDialogQuerierProps<TForeign>) {
    const db3Context = useForeignSingleFieldRenderContext({
        filterText: props.filterText,
        spec: props.spec,
        clientIntention: props.clientIntention,
    });
    const items = db3Context.items;
    React.useEffect(() => {
        props.onResults(items);
    }, [items]);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        db3Context.doInsertFromString(props.filterText)
            .then((updatedObj) => {
                props.onSelectObj(updatedObj);
                showSnackbar({ children: "New item created successfully", severity: 'success' });
                db3Context.refetch();
            }).catch((err => {
                console.log(err);
                showSnackbar({ children: "create error", severity: 'error' });
                db3Context.refetch(); // should revert the data.
            }));
    };

    return <Box>
        {props.allowCreateNew &&
            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={onNewClicked}
            >
                Create new item "{props.filterText}"
            </Button>
        }
    </Box>;

};



export interface SelectSingleForeignDialogProps<TForeign extends TAnyModel> {
    value: TForeign | null;
    spec: ForeignSingleFieldClient<TForeign>;
    clientIntention: db3.xTableClientUsageContext,

    onOK: (value: TForeign | null) => void;
    onCancel: () => void;
    closeOnSelect: boolean;

    caption?: string;
    descriptionSettingName?: SettingKey;
};

export function SelectSingleForeignDialogInner<TForeign extends TAnyModel>(props: SelectSingleForeignDialogProps<TForeign>) {
    const [selectedObj, setSelectedObj] = React.useState<TForeign | null>(props.value);
    const [filterText, setFilterText] = React.useState("");
    const [items, setItems] = React.useState<TForeign[]>([]);
    const publicData = useAuthenticatedSession();

    const isEqual = (a: TForeign | null, b: TForeign | null) => {
        const anull = (a === null || a === undefined);
        const bnull = (b === null || b === undefined);
        if (anull && bnull) return true;
        if (anull !== bnull) return false;
        // both non-null.
        return a![props.spec.typedSchemaColumn.getForeignTableSchema().pkMember] === b![props.spec.typedSchemaColumn.getForeignTableSchema().pkMember];
    };

    const handleItemClick = (value) => {
        if (isEqual(value, selectedObj)) {
            setSelectedObj(null);
            return;
        }
        setSelectedObj(value);
        if (props.closeOnSelect) {
            props.onOK(value);
        }
    };

    const filterMatchesAnyItemsExactly = items.some(item => props.spec.typedSchemaColumn.getForeignTableSchema().doesItemExactlyMatchText(item, filterText));

    const insertAuthorized = props.spec.schemaTable.authorizeRowBeforeInsert({
        clientIntention: props.clientIntention,
        publicData,
    });

    return <>
        <DialogTitle>
            {props.caption || <>Select {props.spec.schemaColumn.member}</>}
            <Box sx={{ p: 0 }}>
                Selected: {props.spec.args.renderAsChip!({
                    colorVariant: StandardVariationSpec.Strong,
                    value: selectedObj || null,
                    onDelete: () => {
                        setSelectedObj(null);
                    }
                })}
            </Box>
            <AdminInspectObject src={props.value} label="value" />
        </DialogTitle>
        <DialogContent dividers>

            {props.descriptionSettingName && <CMDialogContentText><SettingMarkdown setting={props.descriptionSettingName} /></CMDialogContentText>}

            <Box>
                <SearchInput
                    onChange={(v) => setFilterText(v)}
                    value={filterText}
                //autoFocus={true} // see #408
                />
            </Box>

            <Suspense>
                <SelectSingleForeignDialogQuerier
                    allowCreateNew={!!filterText.length && !filterMatchesAnyItemsExactly && props.spec.typedSchemaColumn.allowInsertFromString && insertAuthorized}
                    clientIntention={props.clientIntention}
                    filterText={filterText}
                    onResults={(v) => setItems(v)}
                    spec={props.spec}
                    onSelectObj={(x) => setSelectedObj(x)}
                />
            </Suspense>

            {
                (items.length == 0) ?
                    <Box>Nothing here</Box>
                    :
                    <List>
                        {
                            items.map(item => {
                                const selected = isEqual(item, selectedObj);
                                return (
                                    <React.Fragment key={item[props.spec.typedSchemaColumn.getForeignTableSchema().pkMember]}>
                                        <ListItemButton selected onClick={e => { handleItemClick(item) }}>
                                            {props.spec.args.renderAsListItem!({}, item, selected)}
                                        </ListItemButton>
                                        <Divider></Divider>
                                    </React.Fragment>
                                );
                            })
                        }
                    </List>
            }
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(selectedObj || null) }}>OK</Button>
        </DialogActions>
    </>;
};


export function SelectSingleForeignDialog<TForeign extends TAnyModel>(props: SelectSingleForeignDialogProps<TForeign>) {
    return (
        <ReactiveInputDialog
            onCancel={props.onCancel}
        >
            <SelectSingleForeignDialogInner {...props} />
        </ReactiveInputDialog>

    );
}



