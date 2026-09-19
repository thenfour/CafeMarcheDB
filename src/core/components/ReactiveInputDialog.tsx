
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { Button } from "@mui/material";
import React, { Suspense } from "react";
import { CMDialog } from "./CMDialog";
import { CMDialogContentText } from "./CMCoreComponents2";
import { ResponsiveDialog } from "./ResponsiveDialog";


////////////////////////////////////////////////////////////////
// wraps <Dialog> except with mobile responsiveness
export interface ReactiveInputDialogProps {
    onCancel: () => void;
    open?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement> | undefined;

    defaultAction?: () => void; // this is the default action when Enter is pressed
};
export const ReactiveInputDialog = ({ open = true, ...props }: React.PropsWithChildren<ReactiveInputDialogProps>) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        props.onKeyDown?.(event);
        if (event.isPropagationStopped()) {
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault(); // prevent form submission
            event.stopPropagation(); // stop propagation to parent elements
            if (props.defaultAction) {
                props.defaultAction();
            }
        }
        else if (event.key === 'Escape') {
            event.preventDefault(); // prevent form submission
            event.stopPropagation(); // stop propagation to parent elements
            props.onCancel();
        }
    };

    return (
        <ResponsiveDialog
            className={`ReactiveInputDialog ${props.className ?? ""}`}
            open={open}
            style={props.style}
            onClose={props.onCancel}
            scroll="paper"
            disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
            onKeyDown={handleKeyDown}
        >
            <Suspense>
                {props.children}
            </Suspense>
        </ResponsiveDialog>
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
    return <CMDialog
        open
        onClose={props.onCancel}
        title={props.title === undefined ? "Confirm?" : ((typeof props.title === 'string' ? props.title : props.title()))}
        actions={<>
            <Button onClick={props.onCancel}>{props.cancelLabel || "Cancel"}</Button>
            <Button onClick={props.onConfirm}>{props.confirmLabel || "OK"}</Button>
        </>}
        onKeyDown={event => {
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                props.onConfirm();
            } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                props.onCancel();
            }
        }}
    >
        <CMDialogContentText>
            {(props.description !== undefined) && ((typeof props.description === 'string' ? props.description : props.description()))}
        </CMDialogContentText>
    </CMDialog>;
};

