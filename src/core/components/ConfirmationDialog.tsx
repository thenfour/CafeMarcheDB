// TODO: replace with useMessageBox

// ConfirmContext.tsx
import { DialogContentText } from '@mui/material';
import React, { createContext, ReactNode, useContext, useState } from 'react';
import { CMButton } from './CMCoreComponents2';
import { CMDialog } from './CMDialog';

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
    let descElement = description;
    if (typeof description === 'string') {
        descElement = <DialogContentText>{description}</DialogContentText>;
    }

    return (
        <CMDialog
            open={open}
            onClose={() => onClose(false)}
            title={title}
            actions={<>
                <CMButton onClick={() => onClose(false)}>Cancel</CMButton>
                <CMButton onClick={() => onClose(true)} autoFocus>OK</CMButton>
            </>}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onClose(true);
                }
            }}
        >
            {descElement}
        </CMDialog>
    );
};
