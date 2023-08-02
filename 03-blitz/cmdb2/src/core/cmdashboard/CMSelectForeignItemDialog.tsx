// a modal dialog for selecting 1 item.
// the show/hide logic is not here.
// the selected item is transmitted back on onOK().
// all datasource is dsecribed by the spec: ForeignSingleField<any, TDBModel>,

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
import { ForeignSingleField } from "src/core/cmdashboard/CMColumnSpec";
import { SnackbarContext } from "src/core/components/SnackbarContext";


// why is it important that this class knows about the local model? shouldn't we simply allow selecting from the list of foreign values alone?
type CMSelectItemDialog2Props<TDBModel> = {
    value?: TDBModel | null,
    onOK: (value?: TDBModel | null) => void,
    onCancel: () => void,
    spec: ForeignSingleField<any, TDBModel>,
};

export function CMSelectItemDialog2<TDBModel>({ value, onOK, onCancel, spec }: CMSelectItemDialog2Props<TDBModel>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<TDBModel | undefined | null>(value);
    const [filterText, setFilterText] = React.useState("");

    const where = { AND: [] as any[] };
    if (filterText?.length) {
        const tokens = filterText.split(/\s+/).filter(token => token.length > 0);
        const quickFilterItems = tokens.map(q => {
            const OR = spec.args.getForeignQuickFilterWhereClause(q);
            if (!OR) return null;
            return {
                OR,
            };
        });
        where.AND.push(...quickFilterItems.filter(i => i !== null));
        console.log(where.AND);
    }

    const [items, { refetch }]: [TDBModel[], any] = useQuery(spec.args.getAllOptionsQuery, { where });

    const [createItemMutation] = useMutation(spec.args.insertFromStringMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        spec.args.insertFromString({ mutation: createItemMutation, input: filterText })
            .then((updatedObj) => {
                setSelectedObj(updatedObj);
                showSnackbar({ children: "created new success", severity: 'success' });
                void refetch();
            }).catch((err => {
                showSnackbar({ children: "create error", severity: 'error' });
                void refetch(); // should revert the data.
            }));
    };

    const handleItemClick = (value) => {
        setSelectedObj(value);
    };

    const filterMatchesAnyItemsExactly = items.some(item => spec.args.doesItemExactlyMatchText(item, filterText)); //.  spec.args.

    return (
        <Dialog
            open={true}
            onClose={onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                select {spec.member}
                <Box sx={{ p: 0 }}>
                    Selected: {spec.args.renderAsChip({
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
                    !!filterText.length && !filterMatchesAnyItemsExactly && spec.args.allowInsertFromString && (
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
                                    const selected = spec.isEqual(item, selectedObj);
                                    return (
                                        <React.Fragment key={item[spec.args.foreignPk]}>
                                            <ListItemButton selected onClick={e => { handleItemClick(item) }}>
                                                {spec.args.renderAsListItem({}, item, selected)}
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
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={() => { onOK(selectedObj) }}>OK</Button>
            </DialogActions>
        </Dialog>
    );
}
