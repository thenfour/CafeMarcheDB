import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";
import { Box, Button } from "@mui/material";
import type { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
//import * as DB3Client from "../DB3Client";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { SplitQuickFilter } from 'shared/quickFilter';
import type { SettingKey } from 'shared/settingKeys';
import { gQueryOptions } from "shared/utils";
import updateSetting from 'src/auth/mutations/updateSetting';
import getSetting from 'src/auth/queries/getSetting';
import { CMChip, CMChipContainer } from 'src/core/components/CMChip';
import { useIsShowingAdminControls } from 'src/core/components/CMCoreComponents2';
import { SelectionPicker } from 'src/core/components/select/SelectionPicker';
import { SelectionEditButton, SelectionFieldFrame } from 'src/core/components/select/SelectionField';
import { SelectionSource } from 'src/core/components/select/selectionSource';
import { SelectionValueList } from 'src/core/components/select/SelectionOptions';
import { GenerateForeignSingleSelectStyleSettingName, SettingMarkdown } from 'src/core/components/SettingMarkdown';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import { IColumnClient, type RenderForNewItemDialogArgs, type RenderViewerArgs, type TMutateFn, xTableRenderClient } from './DB3ClientCore';
import type { RenderAsChipParams } from './db3ForeignSingleFieldClient';
import { RenderMuiIcon } from './IconMap';
import { type ColorVariationSpec, StandardVariationSpec } from '../../components/color/palette';
import { TAnyModel } from '@/shared/rootroot';
import { useDashboardContext } from '../../components/dashboardContext/DashboardContext';


const gMaxVisibleTags = 6;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DB3TagsValueComponentProps<TAssociation extends TAnyModel> {
    spec: TagsFieldClient<TAssociation>;//CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    value: TAssociation[],
    onDelete?: (value: TAssociation) => void;
    onItemClick?: (value: TAssociation) => void;

};
export const DB3TagsValueComponent = <TAssociation extends TAnyModel,>(props: DB3TagsValueComponentProps<TAssociation>) => {
    return <CMChipContainer>{props.value.map(c => <React.Fragment key={c[props.spec.associationForeignIDMember]}>
        {props.spec.args.renderAsChip!({
            value: c,
            onDelete: props.onDelete && (() => props.onDelete!(c)),
            onClick: props.onItemClick && (() => props.onItemClick!(c)),
            colorVariant: StandardVariationSpec.Strong,
        })}
    </React.Fragment>
    )}</CMChipContainer>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DB3SelectTagsDialogProps<TAssociation extends TAnyModel> {
    initialValue: TAssociation[];
    row: TAnyModel;
    spec: TagsFieldClient<TAssociation>;
    onChange: (value: TAssociation[]) => void;
    onClose: () => void;
    caption?: string;
    descriptionSettingName?: SettingKey;
};

function DB3SelectTagsDialogInner<TAssociation extends TAnyModel>(props: DB3SelectTagsDialogProps<TAssociation>) {
    const descriptionSettingName = props.descriptionSettingName || props.spec.fieldDescriptionSettingName;
    const source: SelectionSource<TAssociation> = {
        getKey: item => item[props.spec.associationForeignIDMember],
        getLabel: props.spec.getSelectionLabel,
        renderValue: item => props.spec.args.renderAsChip!({ value: item, colorVariant: StandardVariationSpec.Strong }),
        renderOption: (item, selected) => props.spec.args.renderAsListItem!({}, item, selected),
        matchesText: (item, text) => props.spec.typedSchemaColumn.getAssociationTableShema().doesItemExactlyMatchText(item, text),
        useOptions(filterText) {
            const query = useTagsFieldRenderContext({ spec: props.spec, row: props.row, filterText, suspense: false });
            const publicData = useDB3Authorization();
            const dashboard = useDashboardContext();
            const { showMessage } = React.useContext(SnackbarContext);
            const canCreate = props.spec.typedSchemaColumn.allowInsertFromString && props.spec.schemaTable.authorizeRowBeforeInsert({ publicData });
            return {
                ...query, items: query.options,
                createOption: canCreate ? async text => {
                    const item = await query.doInsertFromString({ row: props.row, userInput: text });
                    dashboard.refreshCachedData();
                    showMessage({ children: "New option created", severity: "success" });
                    return item;
                } : undefined,
            };
        },
    };
    return <SelectionPicker source={source} multiple value={props.initialValue}
        title={props.caption || `Select ${props.spec.selectionCaption}`}
        description={descriptionSettingName ? <SettingMarkdown setting={descriptionSettingName} /> : undefined}
        onCancel={props.onClose} onAccept={value => { props.onChange(value); props.onClose(); }} />;
}

export function DB3SelectTagsDialog<TAssociation extends TAnyModel>(props: DB3SelectTagsDialogProps<TAssociation>) {
    return <DB3SelectTagsDialogInner {...props} />;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldInputProps<TAssociation extends TAnyModel> {
    spec: TagsFieldClient<TAssociation>;
    value: TAssociation[];
    onChange: (value: TAssociation[]) => void;

    // for creating new associations
    row: TAnyModel;

    selectStyle: "inline" | "dialog";
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const ChipsFieldInlineValues = <TAssociation extends TAnyModel,>(props: TagsFieldInputProps<TAssociation>) => {

    const dbctx = useTagsFieldRenderContext({
        filterText: "",
        row: props.row,
        spec: props.spec,
    });

    const itemIsSelected = (x: TAssociation) => {
        return props.value.some(v => v[props.spec.associationForeignIDMember] === x[props.spec.associationForeignIDMember]);
    }
    const handleItemToggle = (item: TAssociation) => {
        const isSelected = itemIsSelected(item);
        let newValue;
        if (isSelected) {
            newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== item[props.spec.associationForeignIDMember]);
        } else {
            newValue = [...props.value, item];
        }
        props.onChange(newValue);
    };
    return <>
        {dbctx.options.map(item => {
            const selected = itemIsSelected(item);
            return (
                <React.Fragment key={item[props.spec.associationForeignIDMember]}>
                    {props.spec.args.renderAsChip!({
                        value: item,
                        colorVariant: { selected, variation: selected ? "strong" : "weak", enabled: true, fillOption: 'filled' },
                        onClick: () => handleItemToggle(item),
                    })}
                </React.Fragment>
            );
        })
        }
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// general use "edit cell" for tags
export const TagsFieldInput = <TAssociation extends TAnyModel,>(props: TagsFieldInputProps<TAssociation>) => {
    const [setSetting] = useMutation(updateSetting);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const isShowingAdminControls = useIsShowingAdminControls();
    //const [oldValue, setOldValue] = React.useState<TAssociation[]>([]);
    // React.useEffect(() => {
    //     setOldValue(props.value);
    // }, []);

    if (!props.value) {
        console.error(`props.value is null for ${props.spec.columnName}. make sure it's included in the query.`);
    }
    if (!props.spec.schemaColumn) {
        console.error(`props.spec.schemaColumn is null for ${props.spec.columnName}. make sure the schema contains the right info`);
    }

    // the "local row" is always available here, 
    // and the "foreign row" (the tag) is also always available via the association row.
    // but the association may be missing the link back to the local row.
    // it's necessary for things like FileTagAssociation which needs to access the File record in getRowInfo() to know the owner.
    // so artificially link em up.
    const localPkMember = props.spec.typedSchemaColumn.localTableSpec.pkMember;
    const associationLocalObjectMember = props.spec.typedSchemaColumn.associationLocalObjectMember;
    const associationLocalIDMember = props.spec.typedSchemaColumn.associationLocalIDMember;
    const correctedValue = props.value.map(v => {
        return {
            ...v,
            [associationLocalIDMember]: props.row[localPkMember],
            [associationLocalObjectMember]: props.row,
        };
    });

    const selectStyleSetting = GenerateForeignSingleSelectStyleSettingName(props.spec.schemaTable.tableName, props.spec.columnName);
    const [selectStyleSettingValue] = useQuery(getSetting, { name: selectStyleSetting });//  API.settings.useSetting(selectStyleSetting);
    const selectStyle = (selectStyleSettingValue || props.selectStyle) as ("inline" | "dialog");
    const newProps = { ...props };
    newProps.selectStyle = selectStyle;

    const handleChangeSetting = (newVal: ("inline" | "dialog" | null)) => {
        setSetting({ name: selectStyleSetting, value: newVal }).then((x) => {
            showSnackbar({ children: "Saved", severity: 'success' });
        }).catch((err => {
            console.log(err);
            showSnackbar({ children: "Error", severity: 'error' });
        }));
    };

    return <Box className="tagsFieldView" sx={{ minWidth: 0, py: 0.5 }}>
        {isShowingAdminControls && <CMChipContainer className="adminControlFrame">
            <CMChip size="small" onClick={() => handleChangeSetting("inline")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "inline" }}>inline</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting("dialog")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "dialog" }}>dialog</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting(null)} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyleSettingValue === null }}>default</CMChip>
        </CMChipContainer>}

        {selectStyle === "dialog" ? <SelectionValueList
            value={correctedValue}
            getKey={value => value[props.spec.associationForeignIDMember]}
            getLabel={props.spec.getSelectionLabel}
            renderValue={value => props.spec.renderAsChipForCell({ value, colorVariant: StandardVariationSpec.Strong })}
            onRemove={props.spec.args.allowDeleteFromCell ? value => {
                props.onChange(correctedValue.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]));
            } : undefined}
        >
            <SelectionEditButton onClick={() => setIsOpen(true)} label={`Edit ${props.spec.selectionCaption}`} />
        </SelectionValueList> : <SelectionFieldFrame>
            <ChipsFieldInlineValues {...newProps} />
            <SelectionEditButton onClick={() => setIsOpen(true)} label={`Edit ${props.spec.selectionCaption}`} />
        </SelectionFieldFrame>}

        {isOpen && <DB3SelectTagsDialog
            row={props.row}
            initialValue={correctedValue}
            spec={props.spec}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(newValue: TAssociation[]) => {
                props.onChange(newValue);
            }}
        />
        }
    </Box>;
};





//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsViewProps<TAssociation> {
    value: TAssociation[],
    associationForeignIDMember: string,
    renderAsChip: (args: RenderAsChipParams<TAssociation>) => React.ReactNode;
};
export const TagsView = <TAssociation,>(props: TagsViewProps<TAssociation>) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const value: TAssociation[] = open ? props.value : props.value.slice(0, gMaxVisibleTags);

    return (<div className='MuiDataGrid-cellContent NoMaxHeight'>
        {
            value.map(a => {
                return <React.Fragment key={a[props.associationForeignIDMember]}>
                    {props.renderAsChip({ value: a, colorVariant: StandardVariationSpec.Strong })}
                </React.Fragment>;
            })
        }
        {(!open && (props.value.length > gMaxVisibleTags)) && <Button size='small' style={{ display: 'inline' }} onClick={() => setOpen(!open)}>+{props.value.length - gMaxVisibleTags}</Button>}
        {(open && (props.value.length > gMaxVisibleTags)) && <Button size='small' style={{ display: 'inline' }} onClick={() => setOpen(!open)}>-</Button>}
    </div>);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DefaultRenderAsChipParams<TAssociation> {
    value: TAssociation | null;
    columnSchema: db3.TagsField<TAssociation>,
    colorVariant: ColorVariationSpec;
    onDelete?: () => void;
    onClick?: () => void;
    overrideRowInfo?: (value: TAssociation, rowInfo: db3.RowInfo) => db3.RowInfo,
}

export const DefaultRenderAsChip = <TAssociation,>(args: DefaultRenderAsChipParams<TAssociation>) => {
    if (!args.value) {
        return <>--</>;
    }
    if (!args.columnSchema) {
        throw new Error(`columnSchema is not set for DefaultRenderAsChip.`);
    }
    if (!args.columnSchema.getAssociationTableShema) {
        throw new Error(`columnSchema is missing getAssociationTableShema.`);
    }
    const rowInfo1 = args.columnSchema.getAssociationTableShema().getRowInfo(args.value);
    const rowInfo = args.overrideRowInfo ? args.overrideRowInfo(args.value, rowInfo1) : rowInfo1;

    return <CMChip
        className={`tagsFieldValue defaultRenderAsChip`}
        color={rowInfo.color}
        variation={args.colorVariant}
        onClick={args.onClick}
        onDelete={args.onDelete}
        tooltip={rowInfo.description}
        size='small'
    >
        {rowInfo.name}
        {RenderMuiIcon(rowInfo.iconName)}
    </CMChip>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldClientArgs<TAssociation> {
    columnName: string;
    cellWidth: number;
    allowDeleteFromCell: boolean,

    renderAsChip?: (args: RenderAsChipParams<TAssociation>) => React.ReactNode;

    // Renders option content; the dialog supplies the list item and selection control.
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TAssociation, selected: boolean) => React.ReactNode;
    className?: string;
    fieldCaption?: string;
    fieldDescriptionSettingName?: SettingKey;
    selectStyle?: "inline" | "dialog",
    overrideRowInfo?: (value: TAssociation, rowInfo: db3.RowInfo) => db3.RowInfo,
};

// the client-side description of the field, used in xTableClient construction.
export class TagsFieldClient<TAssociation extends TAnyModel> extends IColumnClient {
    typedSchemaColumn: db3.TagsField<TAssociation>;
    args: TagsFieldClientArgs<TAssociation>;

    ApplyClientToPostClient = undefined;
    selectStyle: "inline" | "dialog";

    get selectionCaption(): string {
        return this.fieldCaption || this.columnName.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
    }

    getSelectionLabel = (value: TAssociation): string => {
        const rowInfo = this.typedSchemaColumn.getAssociationTableShema().getRowInfo(value);
        return (this.args.overrideRowInfo ? this.args.overrideRowInfo(value, rowInfo) : rowInfo).name;
    };

    renderAsChipForCell = (args: RenderAsChipParams<TAssociation>) => {
        if (this.args.allowDeleteFromCell) {
            return this.args.renderAsChip!(args);
        }
        return this.args.renderAsChip!({ ...args, onDelete: undefined });
    };

    // convenience
    get associationLocalIDMember() {
        return this.typedSchemaColumn.associationLocalIDMember;
    }
    get associationForeignIDMember() {
        return this.typedSchemaColumn.associationForeignIDMember;
    }

    constructor(args: TagsFieldClientArgs<TAssociation>) {
        super({
            columnName: args.columnName,
            headerName: args.columnName,
            editable: true,
            width: args.cellWidth,
            isAutoFocusable: false,
            visible: true,
            className: args.className,
            fieldCaption: args.fieldCaption,
            fieldDescriptionSettingName: args.fieldDescriptionSettingName,
        });
        this.args = args;
        this.selectStyle = args.selectStyle || "dialog";
        if (this.args.allowDeleteFromCell === undefined) this.args.allowDeleteFromCell = true;
    }

    defaultRenderAsChip = (args: RenderAsChipParams<TAssociation>) => {
        return DefaultRenderAsChip({ ...args, columnSchema: this.typedSchemaColumn, overrideRowInfo: this.args.overrideRowInfo });
    };

    defaultRenderAsListItem = (_props, value, _selected) => this.args.renderAsChip!({
        value, colorVariant: StandardVariationSpec.Strong,
    });

    renderViewer = (params: RenderViewerArgs<TAssociation[]>) => <React.Fragment key={params.key}>{this.defaultRenderer({
        className: params.className,
        isReadOnly: true,
        validationResult: undefined,
        //name: this.columnName,
        value: <TagsView
            associationForeignIDMember={this.typedSchemaColumn.associationForeignIDMember}
            renderAsChip={this.renderAsChipForCell}
            value={params.value}
        />
    })}</React.Fragment>;

    onSchemaConnected = (tableClient: xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3.TagsField<TAssociation>;

        if (!this.args.renderAsChip) {
            this.args.renderAsChip = (args: RenderAsChipParams<TAssociation>) => this.defaultRenderAsChip(args);
        }
        if (!this.args.renderAsListItem) {
            this.args.renderAsListItem = (props, value, selected) => this.defaultRenderAsListItem(props, value, selected);
        }

        this.GridColProps = {
            renderCell: (params: GridRenderCellParams) => {
                return <TagsView
                    associationForeignIDMember={this.typedSchemaColumn.associationForeignIDMember}
                    renderAsChip={this.renderAsChipForCell}
                    value={params.value}
                />;
            },
            sortable: false, // https://github.com/thenfour/CafeMarcheDB/issues/120
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse({ row: params.row, mode: "update" });
                const value: TAssociation[] = params.value;
                return <TagsFieldInput
                    //validationError={vr.result === "success" ? null : vr.errorMessage || null}
                    selectStyle={this.selectStyle}
                    spec={this}
                    value={value}
                    row={params.row as TAnyModel}
                    onChange={(value: TAssociation[]) => {
                        void params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        //const validationValue = params.validationResult ? (params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null) : undefined;

        return <React.Fragment key={params.key}>{this.defaultRenderer({
            isReadOnly: !this.editable,
            validationResult: params.validationResult,
            value:
                <TagsFieldInput
                    key={params.key}
                    spec={this}
                    //validationError={validationValue}
                    selectStyle={this.selectStyle}
                    row={params.row as TAnyModel}
                    value={params.value as TAssociation[]}
                    onChange={(value: TAssociation[]) => {
                        params.api.setFieldValues({ [this.schemaColumn.member]: value });
                    }}
                />
        })}</React.Fragment>;

    };

};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldRenderContextArgs<TAssociation extends TAnyModel> {
    row: TAnyModel;
    spec: TagsFieldClient<TAssociation>;
    filterText: string;
    // Dialogs keep their draft, search and actions mounted while options load or fail.
    suspense?: boolean;

};

export interface TagsCreateFromStringArgs {
    userInput: string;
    row: TAnyModel;
};

// the "live" adapter handling server-side comms.
export class TagsFieldRenderContext<TAssociation extends TAnyModel> {
    args: TagsFieldRenderContextArgs<TAssociation>;
    mutateFn: TMutateFn;

    options: TAssociation[];
    refetch: () => void;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    isPreviousData: boolean;

    constructor(args: TagsFieldRenderContextArgs<TAssociation>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        // returns the foreign items.
        const [result, queryStatus] = useQuery(db3queries, {
            table: {
                tableID: args.spec.typedSchemaColumn.getForeignTableShema().tableID,
                tableName: args.spec.typedSchemaColumn.getForeignTableShema().tableName,
            },
            orderBy: undefined,
            filter: {
                tableParams: {},
                quickFilterValues: SplitQuickFilter(args.filterText),
            },
            cmdbQueryContext: `TagsFieldRenderContext for table.field: ${args.spec.schemaTable.tableName}.${args.spec.columnName}`,
        }, {
            ...gQueryOptions.default,
            suspense: args.suspense ?? true,
            ...(args.suspense === false ? { useErrorBoundary: false } : {}),
            keepPreviousData: args.suspense === false,
        });
        this.options = (result?.items || []).map(item => this.args.spec.typedSchemaColumn.createMockAssociation(args.row, item));
        this.refetch = queryStatus.refetch;
        this.isLoading = queryStatus.isLoading;
        this.isFetching = queryStatus.isFetching;
        this.isError = queryStatus.isError;
        this.isPreviousData = queryStatus.isPreviousData;
    }

    doInsertFromString = async (args: TagsCreateFromStringArgs): Promise<TAssociation> => {
        // create the tag, and return the mocked up association.
        const foreignTableSpec = this.args.spec.typedSchemaColumn.getForeignTableShema();
        console.assert(!!foreignTableSpec.createInsertModelFromString);
        const insertModel = foreignTableSpec.createInsertModelFromString!(args.userInput);
        try {
            const foreignObject = await this.mutateFn({
                tableID: foreignTableSpec.tableID,
                tableName: foreignTableSpec.tableName,
                mutationType: "insert",
                insertModel,
            }) as TAnyModel;
            return this.args.spec.typedSchemaColumn.createMockAssociation(args.row, foreignObject);
        } catch (e) {
            // ?
            throw e;
        }
    };
};

export const useTagsFieldRenderContext = <TAssociation extends TAnyModel,>(args: TagsFieldRenderContextArgs<TAssociation>) => {
    return new TagsFieldRenderContext<TAssociation>(args);
};

