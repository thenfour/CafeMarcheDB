// ConfirmContext.tsx
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ConfirmOptions {
    title?: React.ReactNode;
    description?: React.ReactNode;
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};



interface ConfirmProviderProps {
    children: ReactNode;
}

export const ConfirmProvider: React.FC<ConfirmProviderProps> = ({ children }) => {
    const [confirmState, setConfirmState] = useState<{
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    const confirm: ConfirmFunction = (options) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({ options, resolve });
        });
    };

    const handleClose = (result: boolean) => {
        if (confirmState) {
            confirmState.resolve(result);
            setConfirmState(null);
        }
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {confirmState && (
                <ConfirmDialog
                    open={true}
                    title={confirmState.options.title}
                    description={confirmState.options.description}
                    onClose={handleClose}
                />
            )}
        </ConfirmContext.Provider>
    );
};




interface ConfirmDialogProps {
    open: boolean;
    title?: React.ReactNode;
    description?: React.ReactNode;
    onClose: (result: boolean) => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title = 'Confirm',
    description = 'Are you sure?',
    onClose,
}) => {
    // in order to allow things like tables in the description, careful not to wrap in a <p> accidentally.
    let descElement = description;
    if (typeof (description) === 'string') {
        descElement = <DialogContentText>{description}</DialogContentText>;
    }
    return (
        <Dialog open={open} onClose={() => onClose(false)}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {descElement}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)} color="primary">
                    Cancel
                </Button>
                <Button onClick={() => onClose(true)} color="primary" autoFocus>
                    OK
                </Button>
            </DialogActions>
        </Dialog>
    );
};
