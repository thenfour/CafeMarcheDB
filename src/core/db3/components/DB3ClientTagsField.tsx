import CloseIcon from '@mui/icons-material/Close';
import { Button } from "@mui/material";
import type { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React, { Suspense } from "react";
//import * as DB3Client from "../DB3Client";
import { useAuthenticatedSession } from '@blitzjs/auth';
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon
} from '@mui/icons-material';
import {
    Box,
    DialogContent,
    DialogTitle,
    Divider,
    List,
    ListItemButton
} from "@mui/material";
import { SplitQuickFilter } from 'shared/quickFilter';
import type { SettingKey } from 'shared/settings';
import { gQueryOptions } from "shared/utils";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import updateSetting from 'src/auth/mutations/updateSetting';
import getSetting from 'src/auth/queries/getSetting';
import { CMChip, CMChipContainer } from 'src/core/components/CMChip';
import { CMSmallButton, DialogActionsCM, useIsShowingAdminControls } from 'src/core/components/CMCoreComponents2';
import { SearchInput } from 'src/core/components/CMTextField';
import { useDashboardContext } from 'src/core/components/DashboardContext';
import { ReactiveInputDialog } from 'src/core/components/ReactiveInputDialog';
import { GenerateForeignSingleSelectStyleSettingName, SettingMarkdown } from 'src/core/components/SettingMarkdown';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import type { TAnyModel } from '../shared/apiTypes';
import { IColumnClient, type RenderForNewItemDialogArgs, type RenderViewerArgs, type TMutateFn, xTableRenderClient } from './DB3ClientCore';
import type { RenderAsChipParams } from './db3ForeignSingleFieldClient';
import { RenderMuiIcon } from './IconMap';
import { type ColorVariationSpec, StandardVariationSpec } from '../../components/color/palette';


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
interface DB3SelectTagsDialogListProps<TAssociation extends TAnyModel> {
    value: TAssociation[];
    spec: TagsFieldClient<TAssociation>;//CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    row: TAnyModel;
    filterText: string;
    handleItemToggle: (value: TAssociation) => void;
}

function DB3SelectTagsDialogList<TAssociation extends TAnyModel>(props: DB3SelectTagsDialogListProps<TAssociation>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicData = useAuthenticatedSession();
    const currentUser = useCurrentUser()[0]!;
    const dashboardContext = useDashboardContext();

    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser };

    const dbctx = useTagsFieldRenderContext({
        filterText: props.filterText,
        row: props.row,
        spec: props.spec,
        clientIntention,
    });

    const itemIsSelected = (x: TAssociation) => {
        return props.value.some(v => v[props.spec.associationForeignIDMember] === x[props.spec.associationForeignIDMember]);
    }

    const filterMatchesAnyItemsExactly = dbctx.options.some(item => props.spec.typedSchemaColumn.getAssociationTableShema().doesItemExactlyMatchText(item, props.filterText));

    const onNewClicked = () => {
        dbctx.doInsertFromString({ row: props.row, userInput: props.filterText })
            .then((newObj) => {
                //const newValue = [updatedObj, ...props.value];
                //props.onChange(newValue);
                showSnackbar({ children: "created new success", severity: 'success' });
                dbctx.refetch();
                // Refresh dashboard context to include the newly created tag
                dashboardContext.refreshCachedData();
                props.handleItemToggle(newObj);
            }).catch((err => {
                console.log(err);
                showSnackbar({ children: "create error", severity: 'error' });
                dbctx.refetch(); // should revert the data.
            }));
    };

    const insertAuthorized = props.spec.schemaTable.authorizeRowBeforeInsert({ clientIntention, publicData });

    return <>
        {
            !!props.filterText.length && !filterMatchesAnyItemsExactly && props.spec.typedSchemaColumn.allowInsertFromString && insertAuthorized && (
                <Box><Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={onNewClicked}
                >
                    add {props.filterText}
                </Button>
                </Box>
            )
        }

        {
            (dbctx.options.length == 0) ?
                <Box>Nothing here</Box>
                :
                <List>

                    {
                        dbctx.options.map(item => {
                            const selected = itemIsSelected(item);
                            return (
                                <React.Fragment key={item[props.spec.associationForeignIDMember]}>
                                    <ListItemButton selected onClick={e => { props.handleItemToggle(item) }}>
                                        {props.spec.args.renderAsListItem!({}, item, selected)}
                                    </ListItemButton>
                                    <Divider></Divider>
                                </React.Fragment>
                            );
                        })
                    }
                </List>
        }</>;

}

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
    const [filterText, setFilterText] = React.useState("");
    const [value, setValue] = React.useState<TAssociation[]>(props.initialValue);
    //const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleItemRemove = (x: TAssociation) => {
        // const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== x[props.spec.associationForeignIDMember]);
        // props.onChange(newValue);
        const newValue: TAssociation[] = value.filter(v => v[props.spec.associationForeignIDMember] !== x[props.spec.associationForeignIDMember]);
        setValue(newValue);
    };

    const itemIsSelected = (x: TAssociation) => {
        return value.some(v => v[props.spec.associationForeignIDMember] === x[props.spec.associationForeignIDMember]);
    }

    const handleItemToggle = (item: TAssociation) => {
        if (itemIsSelected(item)) {
            handleItemRemove(item);
        } else {
            const newValue = [item, ...value];
            setValue(newValue);
        }
    };

    return (
        <>
            <DialogTitle>
                {props.caption || <>Select {props.spec.typedSchemaColumn.member}</>}
                <Box sx={{ p: 0 }}>
                    <DB3TagsValueComponent
                        spec={props.spec}
                        value={value}
                        onDelete={(item) => handleItemRemove(item)}
                    />
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {props.descriptionSettingName && <SettingMarkdown setting={props.descriptionSettingName} />}

                <Box>
                    <SearchInput
                        onChange={(v) => setFilterText(v)}
                        value={filterText}
                    //autoFocus={true} // see #408
                    />

                </Box>

                <Suspense>
                    <DB3SelectTagsDialogList
                        value={value}
                        spec={props.spec}
                        handleItemToggle={handleItemToggle}
                        filterText={filterText}
                        row={props.row}
                    //onNewClicked={onNewClicked}
                    />
                </Suspense>
                <DialogActionsCM>
                    <Button onClick={props.onClose}>Cancel</Button>
                    <Button onClick={() => {
                        props.onChange(value);
                        props.onClose();
                    }}>OK</Button>
                </DialogActionsCM>

            </DialogContent>
        </>
    );
}


export function DB3SelectTagsDialog<TAssociation extends TAnyModel>(props: DB3SelectTagsDialogProps<TAssociation>) {
    return <ReactiveInputDialog
        onCancel={props.onClose}
    ><DB3SelectTagsDialogInner {...props} /></ReactiveInputDialog>;
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
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser };
    const dbctx = useTagsFieldRenderContext({
        filterText: "",
        row: props.row,
        spec: props.spec,
        clientIntention,
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

    let chips: React.ReactNode[] = [];

    if (selectStyle === "dialog") {

        chips = correctedValue.map(value => <React.Fragment key={value[props.spec.associationForeignIDMember]}>{props.spec.renderAsChipForCell!({
            value,
            colorVariant: StandardVariationSpec.Strong,
            onDelete: () => {
                const newValue = correctedValue.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                props.onChange(newValue);
            }
        })
        }</React.Fragment>);

    } else { // inline select style. show all options always and selection indicators.
        chips = [<ChipsFieldInlineValues key={"v"} {...newProps} />];
    }

    return <CMChipContainer className='tagsFieldView'>
        {isShowingAdminControls && <CMChipContainer className="adminControlFrame">
            <CMChip size="small" onClick={() => handleChangeSetting("inline")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "inline" }}>inline</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting("dialog")} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyle === "dialog" }}>dialog</CMChip>
            <CMChip size="small" onClick={() => handleChangeSetting(null)} variation={{ enabled: true, fillOption: "filled", variation: "strong", selected: selectStyleSettingValue === null }}>default</CMChip>
        </CMChipContainer>}

        {chips}

        <CMSmallButton onClick={() => { setIsOpen(!isOpen) }}>Select {props.spec.schemaColumn.member}...</CMSmallButton>

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
    </CMChipContainer>;
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

    // should render a <li {...props}> for autocomplete
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

    defaultRenderAsListItem = (props, value, selected) => {
        //console.assert(!!this.typedSchemaColumn.getChipCaption);
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: { ...StandardVariationSpec.Strong, selected } });
        return <li {...props}>
            <CMChipContainer>
                {/* {selected && <DoneIcon />} */}
                {chip}
                {/* {this.typedSchemaColumn.getChipCaption!(value)}
            {this.typedSchemaColumn.getChipDescription && this.typedSchemaColumn.getChipDescription!(value)} */}
                {selected && <CloseIcon />}
            </CMChipContainer>
        </li>
    };

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
                const vr = this.typedSchemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
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
    clientIntention: db3.xTableClientUsageContext;
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

    constructor(args: TagsFieldRenderContextArgs<TAssociation>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        // returns the foreign items.
        const [{ items }, { refetch }] = useQuery(db3queries, {
            tableID: args.spec.typedSchemaColumn.getForeignTableShema().tableID,
            tableName: args.spec.typedSchemaColumn.getForeignTableShema().tableName,
            orderBy: undefined,
            clientIntention: args.clientIntention,
            filter: {
                items: [],
                tableParams: {},
                quickFilterValues: SplitQuickFilter(args.filterText),
            },
            cmdbQueryContext: `TagsFieldRenderContext for table.field: ${args.spec.schemaTable.tableName}.${args.spec.columnName}`,
        }, gQueryOptions.default);
        this.options = items.map(item => this.args.spec.typedSchemaColumn.createMockAssociation(args.row, item));
        this.refetch = refetch;
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
                clientIntention: this.args.clientIntention,
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

