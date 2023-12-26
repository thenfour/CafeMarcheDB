'use client';

import React from "react";
import * as db3 from "../db3";
//import * as DB3Client from "../DB3Client";
import { Button, Chip, FormHelperText } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import { Coalesce, TAnyModel, gQueryOptions, parseIntOrNull } from "shared/utils";
import { useMutation, useQuery } from "@blitzjs/rpc";
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import { IColumnClient, RenderForNewItemDialogArgs, RenderViewerArgs, TMutateFn, xTableRenderClient } from "./DB3ClientCore";
import {
    Add as AddIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Box,
    DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    InputBase,
    List,
    ListItemButton
} from "@mui/material";
import { ReactiveInputDialog } from 'src/core/components/CMCoreComponents';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { RenderBasicNameValuePair } from "./DB3ClientBasicFields";
import { ColorVariationSpec, StandardVariationSpec } from "shared/color";
import { GetStyleVariablesForColor } from "src/core/components/Color";
import { assert } from "blitz";



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
        colorVariant: StandardVariationSpec.Strong,
        onDelete: props.readOnly ? undefined : (() => {
            props.onChange(null);
        }),
    });

    assert(!!props.foreignSpec.typedSchemaColumn, "schema is not connected to the table spec. you probably need to initiate the client render context");

    return <div className={`chipContainer ${props.validationError === undefined ? "" : (props.validationError === null ? "validationSuccess" : "validationError")}`}>
        {chip}
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.foreignSpec.typedSchemaColumn.member}</Button>
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

    visible?: boolean;
};

// the client-side description of the field, used in xTableClient construction.
export class ForeignSingleFieldClient<TForeign> extends IColumnClient {
    typedSchemaColumn: db3.ForeignSingleField<TForeign>;
    args: ForeignSingleFieldClientArgs<TForeign>;

    fixedValue: TForeign | null | undefined;

    constructor(args: ForeignSingleFieldClientArgs<TForeign>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
            visible: Coalesce(args.visible, true),
        });

        this.args = args;
        this.fixedValue = undefined; // for the moment it's not known.
    }

    ApplyClientToPostClient = (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => {
        updateModel[this.typedSchemaColumn.fkMember] = clientRow[this.typedSchemaColumn.fkMember];
        updateModel[this.columnName] = clientRow[this.columnName];
    };

    defaultRenderAsChip = (args: RenderAsChipParams<TForeign>) => {
        if (!args.value) {
            return <>--</>;
        }

        const rowInfo = this.typedSchemaColumn.getForeignTableSchema().getRowInfo(args.value);

        const style = GetStyleVariablesForColor({ color: rowInfo.color, ...args.colorVariant })

        return <Chip
            className={`cmdbChip applyColor ${style.cssClass}`}
            style={style.style}
            size="small"
            label={rowInfo.name}
            onDelete={args.onDelete}
        />;
    };

    defaultRenderAsListItem = (props, value, selected) => {
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: StandardVariationSpec.Strong });
        return <li {...props}>
            {selected && <DoneIcon />}
            {chip}
            {selected && <CloseIcon />}
        </li>
    };

    renderViewer = (params: RenderViewerArgs<TForeign>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: <>{this.defaultRenderAsChip({ value: params.value, colorVariant: StandardVariationSpec.Strong })}</>,
    });

    onSchemaConnected = (tableClient: xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3.ForeignSingleField<TForeign>;

        if (tableClient.args.filterModel?.tableParams && tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember] != null) {
            const fkid = parseIntOrNull(tableClient.args.filterModel?.tableParams[this.typedSchemaColumn.fkMember]);

            const queryInput: db3.QueryInput = {
                tableID: this.typedSchemaColumn.getForeignTableSchema().tableID,
                tableName: this.typedSchemaColumn.getForeignTableSchema().tableName,
                orderBy: undefined,
                clientIntention: this.args.clientIntention,
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
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                return <ForeignSingleFieldInput
                    validationError={vr.success ? null : vr.errorMessage || null}
                    clientIntention={this.args.clientIntention}
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
            //console.log(`rendering new dlg for foreign single`);
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

        return <React.Fragment key={params.key}>
            {/* <InputLabel>{this.schemaColumn.label}</InputLabel> */}
            <ForeignSingleFieldInput
                foreignSpec={this}
                readOnly={!!this.fixedValue}
                clientIntention={this.args.clientIntention}
                validationError={validationValue}
                value={value}
                onChange={(newValue: TForeign | null) => {
                    const foreignPkMember = this.typedSchemaColumn.getForeignTableSchema().pkMember;
                    params.api.setFieldValues({
                        [this.args.columnName]: newValue,
                        [this.typedSchemaColumn.fkMember]: !!newValue ? newValue[foreignPkMember] : null,
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
            filter: { items: [] },
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




export interface SelectSingleForeignDialogProps<TForeign> {
    value: TForeign | null;
    spec: ForeignSingleFieldClient<TForeign>;
    clientIntention: db3.xTableClientUsageContext,

    onOK: (value: TForeign | null) => void;
    onCancel: () => void;
    closeOnSelect: boolean;
};

export function SelectSingleForeignDialogInner<TForeign>(props: SelectSingleForeignDialogProps<TForeign>) {
    const [selectedObj, setSelectedObj] = React.useState<TForeign | null>(props.value);
    const [filterText, setFilterText] = React.useState("");

    const db3Context = useForeignSingleFieldRenderContext({
        filterText,
        spec: props.spec,
        clientIntention: props.clientIntention,
    });
    const items = db3Context.items;

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        db3Context.doInsertFromString(filterText)//.then(updatedObj)
            .then((updatedObj) => {
                setSelectedObj(updatedObj);
                showSnackbar({ children: "created new success", severity: 'success' });
                db3Context.refetch();
            }).catch((err => {
                showSnackbar({ children: "create error", severity: 'error' });
                db3Context.refetch(); // should revert the data.
            }));
    };

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

    const filterMatchesAnyItemsExactly = items.some(item => props.spec.typedSchemaColumn.doesItemExactlyMatchText(item, filterText)); //.  spec.args.
    return <>
        <DialogTitle>
            select {props.spec.schemaColumn.member}
            <Box sx={{ p: 0 }}>
                Selected: {props.spec.args.renderAsChip!({
                    colorVariant: StandardVariationSpec.Strong,
                    value: selectedObj || null,
                    onDelete: () => {
                        setSelectedObj(null);
                    }
                })}
            </Box>
        </DialogTitle>
        <DialogContent dividers>
            <DialogContentText>
                To subscribe to this website, please enter your email address here. We
                will send updates occasionally.
            </DialogContentText>

            <Box>
                <InputBase
                    size="small"
                    placeholder="Filter"
                    sx={{
                        backgroundColor: "#f0f0f0",
                        borderRadius: 3,
                    }}
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    startAdornment={<SearchIcon />}
                />
            </Box>

            {
                !!filterText.length && !filterMatchesAnyItemsExactly && props.spec.typedSchemaColumn.allowInsertFromString && (
                    <Box><Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onNewClicked}
                    >
                        add {filterText}
                    </Button>
                    </Box>
                )
            }

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


export function SelectSingleForeignDialog<TForeign>(props: SelectSingleForeignDialogProps<TForeign>) {
    return (
        <ReactiveInputDialog
            onCancel={props.onCancel}
        >
            <SelectSingleForeignDialogInner {...props} />
        </ReactiveInputDialog>

    );
}



