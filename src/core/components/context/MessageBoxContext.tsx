import { Button, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import React from 'react';
import { DialogActionsCM } from '../CMCoreComponents2';
import { ReactiveInputDialog } from '../ReactiveInputDialog';


export type MessageBoxButton = "ok" | "cancel" | "yes" | "no";
export type MessageBoxResult = MessageBoxButton;

export interface MessageBoxOptions {
    title?: string;
    message: string;
    buttons?: MessageBoxButton[];
}

interface MessageBoxContextValue {
    showMessage: (options: MessageBoxOptions) => Promise<MessageBoxResult>;
}


const MessageBoxContext = React.createContext<MessageBoxContextValue | undefined>(undefined);

// Custom hook to use the MessageBox.
export function useMessageBox(): MessageBoxContextValue {
    const context = React.useContext(MessageBoxContext);
    if (!context) {
        throw new Error("useMessageBox must be used within a MessageBoxProvider");
    }
    return context;
}


export const MessageBoxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    const [title, setTitle] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [buttons, setButtons] = React.useState<MessageBoxButton[]>(["ok"]);
    const [resolveCallback, setResolveCallback] = React.useState<((result: MessageBoxResult) => void) | null>(null);

    const showMessage = (options: MessageBoxOptions): Promise<MessageBoxResult> => {
        setTitle(options.title || "");
        setMessage(options.message);
        setButtons(options.buttons ?? ["ok"]);
        setOpen(true);
        return new Promise<MessageBoxResult>((resolve) => {
            setResolveCallback(() => resolve);
        });
    };

    const handleClose = (result: MessageBoxResult) => {
        setOpen(false);
        if (resolveCallback) {
            resolveCallback(result);
            setResolveCallback(null);
        }
    };

    return (
        <MessageBoxContext.Provider value={{ showMessage }}>
            {children}
            <ReactiveInputDialog open={open} onCancel={() => handleClose("cancel")}>
                {title && <DialogTitle>{title}</DialogTitle>}
                <DialogContent dividers>
                    <DialogContentText>{message}</DialogContentText>
                    <DialogActionsCM>
                        {buttons.map((btn) => (
                            <Button key={btn} onClick={() => handleClose(btn)}>
                                {btn.toUpperCase()}
                            </Button>
                        ))}
                    </DialogActionsCM>
                </DialogContent>
            </ReactiveInputDialog>
        </MessageBoxContext.Provider>
    );
};