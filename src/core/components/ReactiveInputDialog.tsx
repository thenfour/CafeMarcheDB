
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { Button, Dialog, DialogContent, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
//import dynamic from 'next/dynamic';
import React, { Suspense } from "react";
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency
import { CMDialogContentText, DialogActionsCM } from "./CMCoreComponents2";


////////////////////////////////////////////////////////////////
// wraps <Dialog> except with mobile responsiveness
export interface ReactiveInputDialogProps {
    onCancel: () => void;
    open?: boolean;
    className?: string;
    style?: React.CSSProperties;
};
export const ReactiveInputDialog = ({ open = true, ...props }: React.PropsWithChildren<ReactiveInputDialogProps>) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    return (
        <Dialog
            className={`ReactiveInputDialog ${props.className} ${fullScreen ? "smallScreen" : "bigScreen"}`}
            open={open}
            style={props.style}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
            disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
        >
            <Suspense>
                {props.children}
            </Suspense>
        </Dialog>
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ConfirmationDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    title?: () => React.ReactNode;
    description?: () => React.ReactNode;
};
export const ConfirmationDialog = (props: ConfirmationDialogProps) => {
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title === undefined ? "Confirm?" : ((typeof props.title === 'string' ? props.title : props.title()))}
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {(props.description !== undefined) && ((typeof props.description === 'string' ? props.description : props.description()))}
            </CMDialogContentText>
            <DialogActionsCM>
                <Button onClick={props.onCancel}>{props.cancelLabel || "Cancel"}</Button>
                <Button onClick={props.onConfirm}>{props.confirmLabel || "OK"}</Button>
            </DialogActionsCM>
        </DialogContent>
    </ReactiveInputDialog>;
};

