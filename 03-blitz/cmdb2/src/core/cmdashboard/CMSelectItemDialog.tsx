import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Add as AddIcon,
    Search as SearchIcon,
    Security as SecurityIcon
} from '@mui/icons-material';
import {
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    InputBase,
    List,
    ListItemButton, ListItemIcon, ListItemText
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React from "react";
import { CMColumnSpec, GetCaptionReasons } from "src/core/cmdashboard/CMColumnSpec";
import { SnackbarContext } from "src/core/components/SnackbarContext";

type CMSelectItemDialogProps<TDBModel> = {
    value?: TDBModel | null,
    onOK: (value?: TDBModel | null) => void,
    onCancel: () => void,
    columnSpec: CMColumnSpec<TDBModel>,
};

export function CMSelectItemDialog<TDBModel>({ value, onOK, onCancel, columnSpec }: CMSelectItemDialogProps<TDBModel>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<TDBModel | undefined | null>(value);
    const [filterText, setFilterText] = React.useState("");

    const where = { AND: [] };
    if (filterText?.length) {
        const tokens = filterText.split(/\s+/).filter(token => token.length > 0);
        const quickFilterItems = tokens.map(q => {
            return {
                OR: [
                    { name: { contains: q } },
                    { description: { contains: q } },
                ]
            };
        });
        where.AND.push(...quickFilterItems);
    }

    const [items, { refetch }] = useQuery(columnSpec.GetAllItemsQuery, {});

    const [createItemMutation] = useMutation(columnSpec.CreateFromStringMutation);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const onNewClicked = (e) => {
        columnSpec.CreateFromString({ mutation: createItemMutation, input: filterText })
            .then((updatedObj) => {
                setSelectedObj(updatedObj);
                showSnackbar({ children: columnSpec.GetCaption({ reason: GetCaptionReasons.AutocompleteCreatedItemSnackbar, obj: updatedObj }), severity: 'success' });
                refetch();
            }).catch((err => {
                showSnackbar({ children: columnSpec.GetCaption({ reason: GetCaptionReasons.AutocompleteCreatedItemSnackbar, err }), severity: 'error' });
                refetch(); // should revert the data.
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
            <DialogTitle>{columnSpec.GetCaption({ reason: GetCaptionReasons.SelectItemDialogTitle })}</DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    To subscribe to this website, please enter your email address here. We
                    will send updates occasionally.
                </DialogContentText>

                <Box sx={{ p: 2 }}>
                    Selected: {columnSpec.RenderItem({
                        value: selectedObj,
                        onDelete: () => {
                            setSelectedObj(null);
                        }
                    })}
                </Box>

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
                            {columnSpec.GetCaption({ reason: GetCaptionReasons.AutocompleteInsertVirtualItemCaption, inputString: filterText })}
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
                                        <ListItemButton selected={columnSpec.IsEqual(item, selectedObj)} onClick={e => { handleItemClick(item) }}>
                                            {columnSpec.RenderSelectListItemChildren(item)}
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
