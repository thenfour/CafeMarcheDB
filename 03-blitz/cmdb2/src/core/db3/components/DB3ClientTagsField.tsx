import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { Button, Chip, FormHelperText } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React, { Suspense } from "react";
//import * as DB3Client from "../DB3Client";
import * as db3 from "../db3";
import {
    Add as AddIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Box,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    InputBase,
    List,
    ListItemButton
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { TAnyModel, gQueryOptions } from "shared/utils";
import { useMutation, useQuery } from "@blitzjs/rpc";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import { IColumnClient, RenderForNewItemDialogArgs, RenderViewerArgs, TMutateFn, xTableRenderClient } from './DB3ClientCore';
import { RenderAsChipParams } from './db3ForeignSingleFieldClient';
import { ReactiveInputDialog } from 'src/core/components/CMCoreComponents';
import { RenderBasicNameValuePair } from './DB3ClientBasicFields';
import { ColorVariationSpec, StandardVariationSpec } from 'shared/color';
import { GetStyleVariablesForColor } from 'src/core/components/Color';
import { useAuthenticatedSession } from '@blitzjs/auth';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';


const gMaxVisibleTags = 6;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DB3TagsValueComponentProps<TAssociation> {
    spec: TagsFieldClient<TAssociation>;//CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    value: TAssociation[],
    onDelete?: (value: TAssociation) => void;
    onItemClick?: (value: TAssociation) => void;

};
export const DB3TagsValueComponent = <TAssociation,>(props: DB3TagsValueComponentProps<TAssociation>) => {
    return <>{props.value.map(c => <React.Fragment key={c[props.spec.associationForeignIDMember]}>
        {props.spec.args.renderAsChip!({
            value: c,
            onDelete: props.onDelete && (() => props.onDelete!(c)),
            onClick: props.onItemClick && (() => props.onItemClick!(c)),
            colorVariant: StandardVariationSpec.Strong,
        })}
    </React.Fragment>
    )}</>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface DB3SelectTagsDialogListProps<TAssociation> {
    value: TAssociation[];
    spec: TagsFieldClient<TAssociation>;//CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    row: TAnyModel;
    filterText: string;
    handleItemToggle: (value: TAssociation) => void;
}

function DB3SelectTagsDialogList<TAssociation>(props: DB3SelectTagsDialogListProps<TAssociation>) {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const publicData = useAuthenticatedSession();
    const currentUser = useCurrentUser()[0]!;

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
    const filterMatchesAnyItemsExactly = dbctx.options.some(item => props.spec.typedSchemaColumn.doesItemExactlyMatchText(item, props.filterText));

    const onNewClicked = () => {
        dbctx.doInsertFromString({ row: props.row, userInput: props.filterText })
            .then((newObj) => {
                //const newValue = [updatedObj, ...props.value];
                //props.onChange(newValue);
                showSnackbar({ children: "created new success", severity: 'success' });
                dbctx.refetch();
                props.handleItemToggle(newObj);
            }).catch((err => {
                console.log(err);
                showSnackbar({ children: "create error", severity: 'error' });
                dbctx.refetch(); // should revert the data.
            }));
    };

    const insertAuthorized = props.spec.schemaTable.authorizeRowBeforeInsert({ clientIntention, publicData });
    console.log(`insertAuthorized: ${insertAuthorized} alowfromstr:${props.spec.typedSchemaColumn.allowInsertFromString}`);

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

export interface DB3SelectTagsDialogProps<TAssociation> {
    initialValue: TAssociation[];
    row: TAnyModel;
    spec: TagsFieldClient<TAssociation>;
    onChange: (value: TAssociation[]) => void;
    onClose: () => void;
};

function DB3SelectTagsDialogInner<TAssociation>(props: DB3SelectTagsDialogProps<TAssociation>) {
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
                select {props.spec.typedSchemaColumn.member}
                <Box sx={{ p: 0 }}>
                    Selected:
                    <DB3TagsValueComponent
                        spec={props.spec}
                        value={value}
                        onDelete={(item) => handleItemRemove(item)}
                    />
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

            </DialogContent>
            <DialogActions>
                <Button onClick={() => {
                    //props.onChange(originalValue);
                    props.onClose();
                }}>Cancel</Button>
                <Button onClick={() => {
                    props.onChange(value);
                    props.onClose();
                }}>OK</Button>
            </DialogActions>
        </>
    );
}


export function DB3SelectTagsDialog<TAssociation>(props: DB3SelectTagsDialogProps<TAssociation>) {
    return <ReactiveInputDialog
        onCancel={props.onClose}
        children={<DB3SelectTagsDialogInner {...props} />}
    />;
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldInputProps<TAssociation> {
    spec: TagsFieldClient<TAssociation>;
    value: TAssociation[];
    onChange: (value: TAssociation[]) => void;

    // for creating new associations
    row: TAnyModel;
    validationError?: string | null;
};

// general use "edit cell" for tags
export const TagsFieldInput = <TAssociation,>(props: TagsFieldInputProps<TAssociation>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<TAssociation[]>([]);
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    if (!props.value) {
        console.error(`props.value is null for ${props.spec.columnName}. make sure it's included in the query.`);
    }
    if (!props.spec.schemaColumn) {
        console.error(`props.spec.schemaColumn is null for ${props.spec.columnName}. make sure the schema contains the right info`);
    }

    return <div className={`chipContainer ${props.validationError === undefined ? "" : (props.validationError === null ? "validationSuccess" : "validationError")}`}>
        {props.value.map(value => <React.Fragment key={value[props.spec.associationForeignIDMember]}>{props.spec.renderAsChipForCell!({
            value,
            colorVariant: StandardVariationSpec.Strong,
            onDelete: () => {
                const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                props.onChange(newValue);
            }
        })
        }</React.Fragment>)}

        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.spec.schemaColumn.member}</Button>

        {isOpen && <DB3SelectTagsDialog
            row={props.row}
            initialValue={props.value}
            spec={props.spec}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(newValue: TAssociation[]) => {
                props.onChange(newValue);
            }}
        />
        }
        {props.validationError && <FormHelperText>{props.validationError}</FormHelperText>}
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsViewProps<TAssociation> {
    value: TAssociation[],
    associationForeignIDMember: string,
    renderAsChip: (args: RenderAsChipParams<TAssociation>) => React.ReactElement;
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
    const rowInfo = args.columnSchema.getAssociationTableShema().getRowInfo(args.value);
    const style = GetStyleVariablesForColor({ color: rowInfo.color, ...StandardVariationSpec.Strong });

    return <Chip
        className={`cmdbChip applyColor ${style.cssClass}`}
        style={style.style}
        size="small"
        label={rowInfo.name}
        onDelete={args.onDelete}
        clickable={!!args.onClick}
        onClick={(e) => args.onClick!}
    />;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldClientArgs<TAssociation> {
    columnName: string;
    cellWidth: number;
    allowDeleteFromCell: boolean,

    renderAsChip?: (args: RenderAsChipParams<TAssociation>) => React.ReactElement;

    // should render a <li {...props}> for autocomplete
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TAssociation, selected: boolean) => React.ReactElement;
};

// the client-side description of the field, used in xTableClient construction.
export class TagsFieldClient<TAssociation> extends IColumnClient {
    typedSchemaColumn: db3.TagsField<TAssociation>;
    args: TagsFieldClientArgs<TAssociation>;

    ApplyClientToPostClient = undefined;

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
            visible: true,
        });
        this.args = args;
        if (this.args.allowDeleteFromCell === undefined) this.args.allowDeleteFromCell = true;
    }

    defaultRenderAsChip = (args: RenderAsChipParams<TAssociation>) => {
        return DefaultRenderAsChip({ ...args, columnSchema: this.typedSchemaColumn });
    };

    defaultRenderAsListItem = (props, value, selected) => {
        //console.assert(!!this.typedSchemaColumn.getChipCaption);
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: StandardVariationSpec.Strong });
        return <li {...props}>
            {selected && <DoneIcon />}
            {chip}
            {/* {this.typedSchemaColumn.getChipCaption!(value)}
            {this.typedSchemaColumn.getChipDescription && this.typedSchemaColumn.getChipDescription!(value)} */}
            {selected && <CloseIcon />}
        </li>
    };

    renderViewer = (params: RenderViewerArgs<TAssociation[]>) => RenderBasicNameValuePair({
        key: params.key,
        className: params.className,
        name: this.columnName,
        value: <TagsView
            associationForeignIDMember={this.typedSchemaColumn.associationForeignIDMember}
            renderAsChip={this.renderAsChipForCell}
            value={params.value}
        />
    });

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
            renderEditCell: (params: GridRenderEditCellParams) => {
                const vr = this.typedSchemaColumn.ValidateAndParse({ row: params.row, mode: "update", clientIntention: tableClient.args.clientIntention });
                const value: TAssociation[] = params.value;
                return <TagsFieldInput
                    validationError={vr.result === "success" ? null : vr.errorMessage || null}
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
        const validationValue = params.validationResult ? (params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null) : undefined;
        return <TagsFieldInput
            spec={this}
            validationError={validationValue}
            row={params.row as TAnyModel}
            value={params.value as TAssociation[]}
            onChange={(value: TAssociation[]) => {
                params.api.setFieldValues({ [this.schemaColumn.member]: value });
            }}
        />
    };
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldRenderContextArgs<TAssociation> {
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
export class TagsFieldRenderContext<TAssociation> {
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
                quickFilterValues: args.filterText.split(/\s+/).filter(token => token.length > 0),
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
                insertModel,
                clientIntention: this.args.clientIntention,
            }) as TAnyModel;
            return this.args.spec.typedSchemaColumn.createMockAssociation(args.row, foreignObject);
        } catch (e) {
            // ?
            throw e;
        }
    };
};

export const useTagsFieldRenderContext = <TAssociation,>(args: TagsFieldRenderContextArgs<TAssociation>) => {
    return new TagsFieldRenderContext<TAssociation>(args);
};

