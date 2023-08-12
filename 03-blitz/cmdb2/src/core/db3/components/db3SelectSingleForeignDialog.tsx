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
import React, { Suspense } from "react";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { ForeignSingleFieldClient, useForeignSingleFieldRenderContext } from "./db3ForeignSingleFieldClient";

export interface SelectSingleForeignDialogProps<TForeign> {
    value: TForeign | null;
    spec: ForeignSingleFieldClient<TForeign>;

    onOK: (value: TForeign | null) => void;
    onCancel: () => void;
};

export function SelectSingleForeignDialog<TForeign>(props: SelectSingleForeignDialogProps<TForeign>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<TForeign | null>(props.value);
    const [filterText, setFilterText] = React.useState("");

    const db3Context = useForeignSingleFieldRenderContext({
        filterText,
        spec: props.spec,
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
        return a![props.spec.typedSchemaColumn.foreignTableSpec.pkMember] === b![props.spec.typedSchemaColumn.foreignTableSpec.pkMember];
    };

    const handleItemClick = (value) => {
        if (isEqual(value, selectedObj)) {
            setSelectedObj(null);
            return;
        }
        setSelectedObj(value);
    };

    const filterMatchesAnyItemsExactly = items.some(item => props.spec.typedSchemaColumn.doesItemExactlyMatchText(item, filterText)); //.  spec.args.

    return (
        <Suspense>
            <Dialog
                open={true}
                onClose={props.onCancel}
                scroll="paper"
                fullScreen={fullScreen}
            >
                <DialogTitle>
                    select {props.spec.schemaColumn.label}
                    <Box sx={{ p: 0 }}>
                        Selected: {props.spec.args.renderAsChip!({
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
                                            <React.Fragment key={item[props.spec.typedSchemaColumn.foreignTableSpec.pkMember]}>
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
            </Dialog>
        </Suspense>
    );
}
