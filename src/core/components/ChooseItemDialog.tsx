// TODO: find a way to clean up / unify somehow all of these different selection dialogs.
// - ChooseItemDialog
// - TagsFieldInput
// - ChipSelector
// - DB3SelectTagsDialog
// - CMSelect


import {
    Box,
    Button, Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    FormHelperText,
    List,
    ListItemButton
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from '@mui/material/useMediaQuery';
import React from "react";
import { CMDialogContentText, DialogActionsCM } from "./CMCoreComponents2";



export interface ChoiceEditCellRenderValueArgs {
    value: any;
    onDelete: (undefined | (() => void)); // allows the renderer to add a delete function
    handleEnterEdit?: () => void; // allows renderer to handle clicks to edit the value.
};

export interface ChooseItemDialogProps<T> {
    value: T | null;
    onOK: (value: T | null) => void;
    onCancel: () => void;
    closeOnSelect: boolean;
    title: React.ReactNode;
    description: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    // how to treat items of unknown type...
    isEqual: (a: T, b: T) => boolean; // non-null values. null values are compared internally.
    renderValue: (args: ChoiceEditCellRenderValueArgs) => React.ReactNode;
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: T, selected: boolean) => React.ReactNode;
    items: any[];
};

// todo: add a text filter
export function ChooseItemDialog<T>(props: ChooseItemDialogProps<T>) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const [selectedObj, setSelectedObj] = React.useState<T | null>(props.value);

    const betterIsEqual = (a, b) => {
        if (a == null) {
            return b == null; // either both null or only 1 null. no further comparison necessary.
        }
        if (b == null) return false; // a not null, b is null.
        return props.isEqual(a, b);
    };

    const handleItemClick = (value) => {
        if (betterIsEqual(value, selectedObj)) {
            setSelectedObj(null);
            return;
        }
        setSelectedObj(value);
        if (props.closeOnSelect) {
            props.onOK(value);
        }
    };

    return (
        <Dialog
            open={true}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
            className={`ReactiveInputDialog ${fullScreen ? "smallScreen" : "bigScreen"}`}
            disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
        >
            <DialogTitle>
                {props.title}
                <Box sx={{ p: 0 }}>
                    Selected: {props.renderValue({
                        value: selectedObj || null,
                        onDelete: () => setSelectedObj(null)
                    })}
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <CMDialogContentText>
                    {props.description}
                </CMDialogContentText>

                {
                    (props.items.length == 0) ?
                        <Box>Nothing here</Box>
                        :
                        <List>
                            {
                                props.items.map((item, index) => {
                                    const selected = betterIsEqual(item, selectedObj);
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

                <DialogActionsCM>
                    <Button onClick={() => { props.onOK(selectedObj || null) }}>OK</Button>
                    <Button onClick={props.onCancel}>Cancel</Button>
                </DialogActionsCM>
            </DialogContent>
        </Dialog>
    );
}


export interface ChoiceEditCellProps {
    value: any | null;
    onChange: (value: any | null) => void;
    validationError?: string | null;
    readonly: boolean;
    selectButtonLabel?: string; // if behavior includes extra button this is needed. if not specified then the button won't be rendered.

    selectDialogTitle: React.ReactNode;
    dialogDescription: React.ReactNode; // i should actually be using child elements like <ChooseItemDialogDescription> or something. but whatev.

    isEqual: (a: any, b: any) => boolean;
    renderValue: (args: ChoiceEditCellRenderValueArgs) => React.ReactNode;
    renderAsListItem: (props: React.HTMLAttributes<HTMLLIElement>, value: any, selected: boolean) => React.ReactNode;
    items: any[];
};

// general use "edit cell" for foreign single values.
export const ChoiceEditCell = (props: ChoiceEditCellProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);
    const [oldValue, setOldValue] = React.useState<any | null>();
    React.useEffect(() => {
        setOldValue(props.value);
    }, []);

    const renderedValue = props.renderValue({
        value: props.value,
        onDelete: props.readonly ? undefined : (() => {
            props.onChange(null);
        }),
        handleEnterEdit: () => { setIsOpen(!isOpen) },
    });

    return <div className={`ChoiceEditCell ${(props.validationError === undefined) ? "" : (props.validationError === null ? "validationSuccess" : "validationError")}`}>
        {renderedValue}
        {props.selectButtonLabel && <Button disabled={props.readonly} onClick={props.readonly ? undefined : () => { setIsOpen(!isOpen) }} disableRipple>{props.selectButtonLabel}</Button>}
        {isOpen && <ChooseItemDialog
            closeOnSelect={true}
            value={props.value}
            isEqual={props.isEqual}
            items={props.items}
            renderAsListItem={props.renderAsListItem}
            description={props.dialogDescription}
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
        {props.validationError && <FormHelperText>{props.validationError}</FormHelperText>}
    </div>;
};

