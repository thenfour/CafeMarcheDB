
import {
    Box,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Divider,
    FormHelperText,
    List,
    ListItemButton
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React from "react";
//import { TIconOptions } from "shared/utils";


export interface ChooseItemDialogProps {
    value: any | null;
    onOK: (value: any | null) => void;
    onCancel: () => void;
    closeOnSelect: boolean;
    title: string;
    renderDescription: () => React.ReactElement; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    // how to treat items of unknown type...
    isEqual: (a: any, b: any) => boolean;
    renderValue: (value: any, onDelete: (undefined | (() => void))) => React.ReactElement;
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: any, selected: boolean) => React.ReactElement;
    items: any[];
};

export function ChooseItemDialog(props: ChooseItemDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<any>(props.value);
    //const [filterText, setFilterText] = React.useState("");

    //const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    // const onNewClicked = (e) => {
    //     db3Context.doInsertFromString(filterText)//.then(updatedObj)
    //         .then((updatedObj) => {
    //             setSelectedObj(updatedObj);
    //             showSnackbar({ children: "created new success", severity: 'success' });
    //             db3Context.refetch();
    //         }).catch((err => {
    //             showSnackbar({ children: "create error", severity: 'error' });
    //             db3Context.refetch(); // should revert the data.
    //         }));
    // };

    // const isEqual = (a: TForeign | null, b: TForeign | null) => {
    //     const anull = (a === null || a === undefined);
    //     const bnull = (b === null || b === undefined);
    //     if (anull && bnull) return true;
    //     if (anull !== bnull) return false;
    //     // both non-null.
    //     return a![props.spec.typedSchemaColumn.foreignTableSpec.pkMember] === b![props.spec.typedSchemaColumn.foreignTableSpec.pkMember];
    // };

    const handleItemClick = (value) => {
        if (props.isEqual(value, selectedObj)) {
            setSelectedObj(null);
            return;
        }
        setSelectedObj(value);
        if (props.closeOnSelect) {
            props.onOK(value);
        }
    };

    //const filterMatchesAnyItemsExactly = items.some(item => props.spec.typedSchemaColumn.doesItemExactlyMatchText(item, filterText)); //.  spec.args.

    return (
        <Dialog
            open={true}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
        >
            <DialogTitle>
                {props.title}
                <Box sx={{ p: 0 }}>
                    Selected: {props.renderValue(selectedObj || null, () => { setSelectedObj(null) })}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <DialogContentText>
                    {props.renderDescription()}
                </DialogContentText>
                {/* 
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
                    </Box> */}
                {/* 
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
                    } */}

                {
                    (props.items.length == 0) ?
                        <Box>Nothing here</Box>
                        :
                        <List>
                            {
                                props.items.map((item, index) => {
                                    const selected = props.isEqual(item, selectedObj);
                                    return (
                                        <React.Fragment key={index}>
                                            <ListItemButton selected onClick={e => { handleItemClick(item) }}>
                                                {props.renderAsListItem({}, item, selected)}
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
    );
}



export interface ChoiceEditCellProps {
    // foreignSpec: ForeignSingleFieldClient<TForeign>;
    value: any | null;
    onChange: (value: any | null) => void;
    validationError: string | null;
    readOnly: boolean;
    selectButtonLabel: string;

    selectDialogTitle: string;
    renderDialogDescription: () => React.ReactElement; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    isEqual: (a: any, b: any) => boolean;
    renderValue: (value: any, onDelete: (undefined | (() => void))) => React.ReactElement;
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: any, selected: boolean) => React.ReactElement;
    items: any[];
};

// general use "edit cell" for foreign single values
export const ChoiceEditCell = (props: ChoiceEditCellProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<any | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const chip = props.renderValue(props.value, props.readOnly ? undefined : (() => {
        props.onChange(null);
    }));

    return <div className={props.validationError ? "chipContainer validationError" : "chipContainer validationSuccess"}>
        {chip}
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.selectButtonLabel}</Button>
        {isOpen && <ChooseItemDialog
            closeOnSelect={true}
            value={props.value}
            isEqual={props.isEqual}
            items={props.items}
            renderAsListItem={props.renderAsListItem}
            renderDescription={props.renderDialogDescription}
            title={props.selectDialogTitle}
            renderValue={props.renderValue}
            onOK={(newValue: any | null) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                props.onChange(oldValue || null);
                setIsOpen(false);
            }}
        />
        }
        {props.validationError && <FormHelperText children={props.validationError} />}
    </div>;
};
