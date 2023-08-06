// conceptually similar to ForeignSingle, because it's just a foreign reference.
// but,
// 1. no fk field exists so that's simpler
// 2. instead of ForeignModel type, it's ForeignModel[] array.
// other changes would be hidden in schemas & mutations / queries.

// NB: the array is of AssociationModel[]. Therefore most "value" types are of association object, not the local or foreign object.

// what kind of validation should be necessary? not even null checks seem to make sense here.

import { GridRenderCellParams, GridRenderEditCellParams } from "@mui/x-data-grid";
import React from "react";
import { CMFieldSpecBase, RenderForNewItemDialogArgs, ValidateAndParseResult } from './CMColumnSpec';
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import {
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    InputBase,
    List,
    ListItemButton
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import { SnackbarContext } from "src/core/components/SnackbarContext";


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type TagsInsertFromStringParams = {
    localPk: number | null,
    mutation: any,
    input: string,
};

interface CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput> {
    label: string;
    getAllAssociationOptionsQuery: any; // returns Association[] where many may be mocked up.
    getForeignQuickFilterWhereClause: (query: string) => ForeignWhereInput;

    doesItemExactlyMatchText: (item: AssociationModel, filterText: string) => boolean;

    allowInsertFromString: boolean,
    insertFromStringMutation: any, // creates a foreign item, returns a MOCK association
    insertFromString: ((params: TagsInsertFromStringParams) => Promise<AssociationModel>), // create an object from string asynchronously.
    insertFromStringSchema: any,

    getForeignPKOfAssociation: (a: AssociationModel) => number; // in order to compare for equality

    renderAsChip: (args: TagsRenderAsChipParams<AssociationModel>) => React.ReactElement;
    // should render a <li {...props}> for autocomplete
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: AssociationModel, selected: boolean) => React.ReactElement;
};

interface CMSelectTagsDialogProps<AssociationModel, ForeignWhereInput> {
    value: AssociationModel[];
    localPk: number | null;
    spec: CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    onChange: (value: AssociationModel[]) => void;
    onClose: () => void;
};

// caller controls value
export function CMSelectTagsDialog<AssociationModel, ForeignWhereInput>(props: CMSelectTagsDialogProps<AssociationModel, ForeignWhereInput>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    //const [selectedObj, setSelectedObj] = React.useState<AssociationModel[]>(value);
    const [filterText, setFilterText] = React.useState("");
    const [originalValue, setOriginalValue] = React.useState<AssociationModel[]>([]);
    React.useEffect(() => {
        setOriginalValue(props.value);
    }, []);

    const where = { AND: [] as any[] };
    if (filterText?.length) {
        const tokens = filterText.split(/\s+/).filter(token => token.length > 0);
        const quickFilterItems = tokens.map(q => {
            const OR = props.spec.getForeignQuickFilterWhereClause(q);
            if (!OR) return null;
            return {
                OR,
            };
        });
        where.AND.push(...quickFilterItems.filter(i => i !== null));
        console.log(where.AND);
    }

    const [items, { refetch }]: [AssociationModel[], any] = useQuery(props.spec.getAllAssociationOptionsQuery, { where });

    const [createItemMutation] = useMutation(props.spec.insertFromStringMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        props.spec.insertFromString({ mutation: createItemMutation, input: filterText, localPk: props.localPk })
            .then((updatedObj) => {
                const newValue = [updatedObj, ...props.value];
                props.onChange(newValue);
                //setSelectedObj(updatedObj);
                showSnackbar({ children: "created new success", severity: 'success' });
                void refetch();
            }).catch((err => {
                console.log(err);
                showSnackbar({ children: "create error", severity: 'error' });
                void refetch(); // should revert the data.
            }));
    };

    const handleItemRemove = (x: AssociationModel) => {
        const newValue = props.value.filter(v => props.spec.getForeignPKOfAssociation(v) !== props.spec.getForeignPKOfAssociation(x));
        props.onChange(newValue);
    };

    const itemIsSelected = (x: AssociationModel) => {
        return props.value.some(v => props.spec.getForeignPKOfAssociation(v) === props.spec.getForeignPKOfAssociation(x));
    }

    const handleItemToggle = (value: AssociationModel) => {
        if (itemIsSelected(value)) {
            handleItemRemove(value);
        } else {
            const newValue = [value, ...props.value];
            props.onChange(newValue);
        }
    };

    const filterMatchesAnyItemsExactly = items.some(item => props.spec.doesItemExactlyMatchText(item, filterText));

    return (
        <Dialog
            open={true}
            onClose={props.onClose}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                select {props.spec.label}
                <Box sx={{ p: 0 }}>
                    Selected: {props.value.map(c => {
                        return <React.Fragment key={props.spec.getForeignPKOfAssociation(c)}>
                            {props.spec.renderAsChip({
                                value: c,
                                onDelete: () => {
                                    handleItemRemove(c);
                                }
                            })}
                        </React.Fragment>
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
                    !!filterText.length && !filterMatchesAnyItemsExactly && props.spec.allowInsertFromString && (
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
                                    const selected = itemIsSelected(item);
                                    return (
                                        <React.Fragment key={props.spec.getForeignPKOfAssociation(item)}>
                                            <ListItemButton selected onClick={e => { handleItemToggle(item) }}>
                                                {props.spec.renderAsListItem({}, item, selected)}
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
export interface TagsFieldInputProps<AssociationModel, ForeignWhereInput> {
    //field: TagsField<DBModel, AssociationModel, ForeignModel, WhereInput>;
    associationSpec: CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;
    value: AssociationModel[];
    localPk: number | null;
    onChange: (value: AssociationModel[]) => void;
};

// "edit cell" for multi tag values
export const TagsFieldInput = <AssociationModel, ForeignWhereInput>(props: TagsFieldInputProps<AssociationModel, ForeignWhereInput>) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    const chips = props.value.map(val => {
        console.log(`key: ${props.associationSpec.getForeignPKOfAssociation(val)}`);
        return <React.Fragment key={props.associationSpec.getForeignPKOfAssociation(val)}>{props.associationSpec.renderAsChip({
            value: val,
            onDelete: () => {
                // remove from array & call onchange.
                //props.onChange(null);
            },
        })}
        </React.Fragment>
    });

    return <div>
        {chips}
        <Button onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.associationSpec.label}</Button>
        {isOpen && <CMSelectTagsDialog
            value={props.value}
            localPk={props.localPk}
            spec={props.associationSpec}
            onChange={(val) => {
                props.onChange(val);
            }}
            onClose={() => {
                setIsOpen(false);
            }}
        />
        }
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface TagsRenderAsChipParams<T> {
    value: T | null;
    onDelete?: () => void;
}

// there are cases where we can't really operate on the association object
// like quick filtering of the options list, it would be very awkward to try and manage that from the association table.
// better to just get the list of foreign objects and work with that.
//
// so for rendering the list of options, i think we should operate on the foreign object mostly, but
// the selected value is an association, and the output needs to be an association as well. so both directions of conversion will be needed.
export interface TagsFieldArgs<AssociationModel, ForeignWhereInput> {
    member: string,
    localPkMember: string, // the ID field of the local row; used when creating associations.
    cellWidth: number,
    // getAllForeignOptionsQuery: any, // returns all FOREIGN objects, not association objects

    // // for filtering a list of the foreign items, fetched by getAllOptionsQuery
    // getForeignQuickFilterWhereClause: (query: string) => ForeignWhereInput,


    associationSpec: CMSelectTagsDialogSpec<AssociationModel, ForeignWhereInput>;

    // // when filtering a list, we only show the "Add new item 'text'" when it doesn't match an existing item already. This is therefore required.
    // doesForeignItemExactlyMatchText: (item: ForeignModel, filterText: string) => boolean,

    // allowInsertFromString: boolean,
    // insertFromStringMutation: any,
    // insertFromString: ((params: TagsInsertFromStringParams) => Promise<AssociationModel>), // create a foreign object from string asynchronously + create a mockup association model.
    // insertFromStringSchema: any,

    // // should render a <li {...props}> for autocomplete
    // renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: AssociationModel, selected: boolean) => React.ReactElement;

    // also for autocomplete
};

export abstract class TagsField<DBModel, AssociationModel, WhereInput, ForeignWhereInput> extends CMFieldSpecBase<DBModel, WhereInput, AssociationModel[]> {

    args: TagsFieldArgs<AssociationModel, ForeignWhereInput>;

    constructor(args: TagsFieldArgs<AssociationModel, ForeignWhereInput>) {
        super();
        this.args = args;
        this.member = args.member;
        this.columnHeaderText = args.associationSpec.label;
        this.isEditableInGrid = true;
        this.cellWidth = args.cellWidth;
        this.initialNewItemValue = [];
    }

    ValidateAndParse = (val: AssociationModel[]): ValidateAndParseResult<AssociationModel[]> => {
        return {
            parsedValue: val,
            success: true,
            errorMessage: "",
        };
    };

    isEqual = (a: AssociationModel[], b: AssociationModel[]) => {
        console.assert(Array.isArray(a));
        console.assert(Array.isArray(b));
        if (a.length != b.length) {
            return false; // shortcut
        }
        // ok they are equal length arrays; check all items
        const avalues = (a as AssociationModel[]).map(x => this.args.associationSpec.getForeignPKOfAssociation(x));// x[this.args.foreignPk]);
        const bvalues = (b as AssociationModel[]).map(x => this.args.associationSpec.getForeignPKOfAssociation(x));// x[this.args.foreignPk]);
        avalues.sort();
        bvalues.sort();
        for (let i = 0; i < avalues.length; ++i) {
            if (avalues[i] !== bvalues[i]) return false;
        }
        return true;
    };

    // view: render as a single chip
    renderForEditGridView = (params: GridRenderCellParams): React.ReactElement => {
        //renderForEditGridView = ({value, ...params}: { AssociationModel[], GridRenderCellParams}): React.ReactElement => {
        //renderForEditGridView = ({ value, ...params }: { value: AssociationModel[] }): React.ReactElement => {
        const value: AssociationModel[] = params.value;
        return <>{
            value.map(a => {
                return <React.Fragment key={this.args.associationSpec.getForeignPKOfAssociation(a)}>{this.args.associationSpec.renderAsChip({ value: a, })}</React.Fragment>;
            })
        }</>;
    };

    renderForEditGridEdit = (params: GridRenderEditCellParams): React.ReactElement => {
        const value: AssociationModel[] = params.value;
        return <TagsFieldInput
            associationSpec={this.args.associationSpec}
            localPk={params.row[this.args.localPkMember]}
            value={value}
            onChange={(value: AssociationModel[]) => {
                params.api.setEditCellValue({ id: params.id, field: this.args.member, value });
            }}
        />;
    }

    renderForNewDialog = (params: RenderForNewItemDialogArgs<DBModel, AssociationModel[]>) => {
        return <TagsFieldInput
            localPk={null}
            associationSpec={this.args.associationSpec}
            value={params.value}
            onChange={(value: AssociationModel[]) => {
                params.api.setFieldValues({ [this.member]: value });
            }}
        />
    };
};

