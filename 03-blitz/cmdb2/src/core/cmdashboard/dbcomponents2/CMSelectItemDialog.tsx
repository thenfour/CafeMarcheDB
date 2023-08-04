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
import { CMSelectItemDialogSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { SnackbarContext } from "src/core/components/SnackbarContext";

// old version
// a modal dialog for selecting 1 item.

type CMSelectItemDialogProps<TDBModel> = {
    value?: TDBModel | null,
    onOK: (value?: TDBModel | null) => void,
    onCancel: () => void,
    spec: CMSelectItemDialogSpec<TDBModel>,
};

export function CMSelectItemDialog<TDBModel>({ value, onOK, onCancel, spec }: CMSelectItemDialogProps<TDBModel>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<TDBModel | undefined | null>(value);
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

    const [items, { refetch }] = useQuery(spec.GetAllItemsQuery, { where });

    const [createItemMutation] = useMutation(spec.CreateFromStringMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        spec.CreateFromString({ mutation: createItemMutation, input: filterText })
            .then((updatedObj) => {
                setSelectedObj(updatedObj);
                showSnackbar({ children: spec.NewItemSuccessSnackbarText(updatedObj), severity: 'success' });
                void refetch();
            }).catch((err => {
                showSnackbar({ children: spec.NewItemErrorSnackbarText(err), severity: 'error' });
                void refetch(); // should revert the data.
            }));
    };

    const handleItemClick = (value) => {
        setSelectedObj(value);
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
                    Selected: {spec.RenderItem({
                        value: selectedObj,
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
                                items.map(item => (
                                    <React.Fragment key={item.id}>
                                        <ListItemButton selected={spec.IsEqual(item, selectedObj)} onClick={e => { handleItemClick(item) }}>
                                            {spec.RenderListItemChild(item)}
                                        </ListItemButton>
                                        <Divider></Divider>
                                    </React.Fragment>
                                ))
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
