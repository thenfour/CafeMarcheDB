// the value type we operate on is TAssociationModel[].
// why do we need to pass the row? because associations refer to the row, so the spec will need to access the row for its ID etc.

// i would actually prefer to refactor this so it's not so much "row" and "association[]", but rather just "parentObject" and array "value". maybe?

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
import React from "react";
import { CMSelectMultiDialogSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { SnackbarContext } from "src/core/components/SnackbarContext";

type CMSelectMultiDialogProps<TRow, TAssociation> = {
    rowObject: TRow,
    value: TAssociation[], // no null. empty array yes.
    onOK: (value: TAssociation[]) => void,
    onCancel: () => void,
    spec: CMSelectMultiDialogSpec<TRow, TAssociation>,
};

export function CMSelectMultiDialog<TRow, TAssociation>({ rowObject, value, onOK, onCancel, spec }: CMSelectMultiDialogProps<TRow, TAssociation>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<TAssociation[]>(value);
    const [filterText, setFilterText] = React.useState("");

    const where = { AND: [] as any[] };
    if (filterText?.length) {
        const tokens = filterText.split(/\s+/).filter(token => token.length > 0);
        const quickFilterItems = tokens.map(q => {
            return {
                OR: spec.GetQuickFilterWhereClauseExpression(q)
            };
        });
        where.AND.push(...quickFilterItems);
    }

    //const [items, { refetch }] = useQuery<any, TAssociation[]>(spec.GetAllForeignItemsQuery, where);
    const { items, refetch } = spec.GetAllForeignItemOptionsAsAssociations({ where, existingAssociations: selectedObj, rowObject });

    const [createForeignItemMutation] = useMutation(spec.CreateForeignFromStringMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = () => {
        spec.CreateAssociationWithNewForeignObjectFromString({ rowObject, mutation: createForeignItemMutation, input: filterText })
            .then((newAssociation) => {
                const newValue = [...selectedObj, newAssociation];
                setSelectedObj(newValue);
                showSnackbar({ children: spec.NewItemSuccessSnackbarText(newAssociation), severity: 'success' });
                void refetch();
            }).catch((err => {
                showSnackbar({ children: spec.NewItemErrorSnackbarText(err), severity: 'error' });
                void refetch(); // should revert the data.
            }));
    };

    const handleDeleteAssociation = (ass: TAssociation) => {
        const newValue = selectedObj.filter(sass => !spec.IsEqualAssociation(ass, sass));
        setSelectedObj(newValue);
    };

    const handleListItemClick = (newAssociation: TAssociation) => {
        const newValue = [...selectedObj, newAssociation];
        setSelectedObj(newValue);
    };

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                {spec.DialogTitleText()}
                <Box sx={{ p: 0 }}>
                    {spec.RenderValue({
                        rowObject,
                        value: selectedObj,
                        onDelete: handleDeleteAssociation,
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
                    !!filterText && (
                        <Box><Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={onNewClicked}
                        >
                            {spec.NewItemText(filterText)}
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
                                    const selected = !!selectedObj.find(ass => spec.IsEqualAssociation(ass, item));
                                    return (<React.Fragment key={spec.GetKey(item)}>
                                        <ListItemButton disabled={selected} onClick={e => handleListItemClick(item)}>
                                            {spec.RenderListItemChild({ rowObject, value: item, selected })}
                                        </ListItemButton>
                                        <Divider></Divider>
                                    </React.Fragment>);
                                })
                            }
                        </List>
                }

            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={() => { onOK(selectedObj) }}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}
