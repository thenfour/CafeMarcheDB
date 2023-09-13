'use client';

import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { Button, Chip, FormHelperText } from "@mui/material";
import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import * as DB3Client from "../DB3Client";
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
import { TAnyModel } from "shared/utils";
import { useMutation, useQuery } from "@blitzjs/rpc";
import db3mutations from "../mutations/db3mutations";
import db3queries from "../queries/db3queries";
import { ColorVariationOptions } from 'src/core/components/Color';


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
            colorVariant: "strong",
            onDelete: props.onDelete && (() => props.onDelete!(c)),
            onClick: props.onItemClick && (() => props.onItemClick!(c)),
        })}
    </React.Fragment>
    )}</>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface DB3SelectTagsDialogProps<TAssociation> {
    value: TAssociation[];
    row: TAnyModel;
    spec: TagsFieldClient<TAssociation>;//CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    onChange: (value: TAssociation[]) => void;
    onClose: () => void;
};

// caller controls value
export function DB3SelectTagsDialog<TAssociation>(props: DB3SelectTagsDialogProps<TAssociation>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [filterText, setFilterText] = React.useState("");
    const [originalValue, setOriginalValue] = React.useState<TAssociation[]>([]);
    React.useEffect(() => {
        setOriginalValue(props.value);
    }, []);

    const dbctx = useTagsFieldRenderContext({
        filterText,
        row: props.row,
        spec: props.spec,
    });

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        dbctx.doInsertFromString({ row: props.row, userInput: filterText })
            .then((updatedObj) => {
                const newValue = [updatedObj, ...props.value];
                props.onChange(newValue);
                showSnackbar({ children: "created new success", severity: 'success' });
                dbctx.refetch();
            }).catch((err => {
                console.log(err);
                showSnackbar({ children: "create error", severity: 'error' });
                dbctx.refetch(); // should revert the data.
            }));
    };

    const handleItemRemove = (x: TAssociation) => {
        const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== x[props.spec.associationForeignIDMember]);
        props.onChange(newValue);
    };

    const itemIsSelected = (x: TAssociation) => {
        return props.value.some(v => v[props.spec.associationForeignIDMember] === x[props.spec.associationForeignIDMember]);
    }

    const handleItemToggle = (value: TAssociation) => {
        if (itemIsSelected(value)) {
            handleItemRemove(value);
        } else {
            const newValue = [value, ...props.value];
            props.onChange(newValue);
        }
    };

    const filterMatchesAnyItemsExactly = dbctx.options.some(item => props.spec.typedSchemaColumn.doesItemExactlyMatchText(item, filterText));

    return (
        <Dialog
            open={true}
            onClose={props.onClose}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                select {props.spec.typedSchemaColumn.label}
                <Box sx={{ p: 0 }}>
                    Selected:
                    <DB3TagsValueComponent
                        spec={props.spec}
                        value={props.value}
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
                    (dbctx.options.length == 0) ?
                        <Box>Nothing here</Box>
                        :
                        <List>
                            {
                                dbctx.options.map(item => {
                                    const selected = itemIsSelected(item);
                                    return (
                                        <React.Fragment key={item[props.spec.associationForeignIDMember]}>
                                            <ListItemButton selected onClick={e => { handleItemToggle(item) }}>
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
                <Button onClick={() => {
                    props.onChange(originalValue);
                    props.onClose();
                }}>Cancel</Button>
                <Button onClick={() => {
                    props.onClose();
                }}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsFieldInputProps<TAssociation> {
    spec: TagsFieldClient<TAssociation>;
    value: TAssociation[];
    onChange: (value: TAssociation[]) => void;

    // for creating new associations
    row: TAnyModel;
    validationError: string | null;
};

// general use "edit cell" for foreign single values
export const TagsFieldInput = <TAssociation,>(props: TagsFieldInputProps<TAssociation>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<TAssociation[]>([]);
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    return <div className={props.validationError ? "chipContainer validationError" : "chipContainer validationSuccess"}>
        {props.value.map(value => <React.Fragment key={value[props.spec.associationForeignIDMember]}>{props.spec.renderAsChipForCell!({
            value,
            colorVariant: "strong",
            onDelete: () => {
                const newValue = props.value.filter(v => v[props.spec.associationForeignIDMember] !== value[props.spec.associationForeignIDMember]);
                props.onChange(newValue);
            }
        })
        }</React.Fragment>)}

        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.spec.schemaColumn.label}</Button>

        {isOpen && <DB3SelectTagsDialog
            row={props.row}
            value={props.value}
            spec={props.spec}
            onClose={() => {
                setIsOpen(false);
            }}
            onChange={(newValue: TAssociation[]) => {
                props.onChange(newValue);
            }}
        />
        }
        {props.validationError && <FormHelperText children={props.validationError} />}
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface TagsViewProps<TAssociation> {
    value: TAssociation[],
    associationForeignIDMember: string,
    renderAsChip: (args: DB3Client.RenderAsChipParams<TAssociation>) => React.ReactElement;
};
export const TagsView = <TAssociation,>(props: TagsViewProps<TAssociation>) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const value: TAssociation[] = open ? props.value : props.value.slice(0, gMaxVisibleTags);

    return (<div className='MuiDataGrid-cellContent NoMaxHeight'>
        {
            value.map(a => {
                return <React.Fragment key={a[props.associationForeignIDMember]}>
                    {props.renderAsChip({ value: a, colorVariant: "strong" })}
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
    colorVariant: ColorVariationOptions;
    onDelete?: () => void;
    onClick?: () => void;
}

export const DefaultRenderAsChip = <TAssociation,>(args: DefaultRenderAsChipParams<TAssociation>) => {
    if (!args.value) {
        return <>--</>;
    }
    const rowInfo = args.columnSchema.associationTableSpec.getRowInfo(args.value);
    const style: React.CSSProperties = {};
    const color = rowInfo.color;
    if (color != null) {
        if (args.colorVariant === "strong") {
            style.backgroundColor = color.strongValue;
            style.color = color.strongContrastColor;
            style.border = `1px solid ${color.strongOutline ? color.strongContrastColor : color.strongValue}`;
        } else {
            style.backgroundColor = color.weakValue;
            style.color = color.weakContrastColor;
            style.border = `1px solid ${color.weakOutline ? color.weakContrastColor : color.weakValue}`;
        }
    }

    return <Chip
        className="cmdbChip"
        style={style}
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

    renderAsChip?: (args: DB3Client.RenderAsChipParams<TAssociation>) => React.ReactElement;

    // should render a <li {...props}> for autocomplete
    renderAsListItem?: (props: React.HTMLAttributes<HTMLLIElement>, value: TAssociation, selected: boolean) => React.ReactElement;
};

// the client-side description of the field, used in xTableClient construction.
export class TagsFieldClient<TAssociation> extends DB3Client.IColumnClient {
    typedSchemaColumn: db3.TagsField<TAssociation>;
    args: TagsFieldClientArgs<TAssociation>;

    renderAsChipForCell = (args: DB3Client.RenderAsChipParams<TAssociation>) => {
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
        });
        this.args = args;
        if (this.args.allowDeleteFromCell === undefined) this.args.allowDeleteFromCell = true;
    }

    defaultRenderAsChip = (args: DB3Client.RenderAsChipParams<TAssociation>) => {
        return DefaultRenderAsChip({ ...args, columnSchema: this.typedSchemaColumn });
    };

    defaultRenderAsListItem = (props, value, selected) => {
        //console.assert(!!this.typedSchemaColumn.getChipCaption);
        console.assert(value != null);
        const chip = this.defaultRenderAsChip({ value, colorVariant: "strong" });
        return <li {...props}>
            {selected && <DoneIcon />}
            {chip}
            {/* {this.typedSchemaColumn.getChipCaption!(value)}
            {this.typedSchemaColumn.getChipDescription && this.typedSchemaColumn.getChipDescription!(value)} */}
            {selected && <CloseIcon />}
        </li>
    };

    onSchemaConnected = (tableClient: DB3Client.xTableRenderClient) => {
        this.typedSchemaColumn = this.schemaColumn as db3.TagsField<TAssociation>;

        if (!this.args.renderAsChip) {
            this.args.renderAsChip = (args: DB3Client.RenderAsChipParams<TAssociation>) => this.defaultRenderAsChip(args);
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
                const vr = this.typedSchemaColumn.ValidateAndParse({ value: params.value, row: params.row, mode: "update" });
                const value: TAssociation[] = params.value;
                return <TagsFieldInput
                    validationError={vr.success ? null : vr.errorMessage || null}
                    spec={this}
                    value={value}
                    row={params.row as TAnyModel}
                    onChange={(value: TAssociation[]) => {
                        params.api.setEditCellValue({ id: params.id, field: this.schemaColumn.member, value });
                    }}
                />;
            },
        };
    };

    renderForNewDialog = (params: DB3Client.RenderForNewItemDialogArgs) => {
        return <TagsFieldInput
            spec={this}
            validationError={params.validationResult.hasErrorForField(this.columnName) ? params.validationResult.getErrorForField(this.columnName) : null}
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
};

export interface TagsCreateFromStringArgs {
    userInput: string;
    row: TAnyModel;
};

// the "live" adapter handling server-side comms.
export class TagsFieldRenderContext<TAssociation> {
    args: TagsFieldRenderContextArgs<TAssociation>;
    mutateFn: DB3Client.TMutateFn;

    options: TAssociation[];
    refetch: () => void;

    constructor(args: TagsFieldRenderContextArgs<TAssociation>) {
        this.args = args;

        if (this.args.spec.typedSchemaColumn.allowInsertFromString) {
            this.mutateFn = useMutation(db3mutations)[0] as DB3Client.TMutateFn;
        }

        const where = { AND: [] as any[] };
        if (args.filterText) {
            const tokens = args.filterText.split(/\s+/).filter(token => token.length > 0);
            const quickFilterItems = tokens.map(q => {
                const OR = args.spec.typedSchemaColumn.foreignTableSpec.GetQuickFilterWhereClauseExpression(q);
                if (!OR) return null;
                return {
                    OR,
                };
            });
            where.AND.push(...quickFilterItems.filter(i => i !== null));
        }

        // returns the foreign items.
        const [items, { refetch }]: [TAnyModel[], any] = useQuery(db3queries, {
            tableName: args.spec.typedSchemaColumn.foreignTableSpec.tableName,
            orderBy: undefined,
            where,
        });
        this.options = items.map(item => this.args.spec.typedSchemaColumn.createMockAssociation(args.row, item));
        this.refetch = refetch;
    }

    doInsertFromString = async (args: TagsCreateFromStringArgs): Promise<TAssociation> => {
        // create the tag, and return the mocked up association.
        const foreignTableSpec = this.args.spec.typedSchemaColumn.foreignTableSpec;
        console.assert(!!foreignTableSpec.createInsertModelFromString);
        const insertModel = foreignTableSpec.createInsertModelFromString!(args.userInput);
        try {
            const foreignObject = await this.mutateFn({
                tableName: foreignTableSpec.tableName,
                insertModel,
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

