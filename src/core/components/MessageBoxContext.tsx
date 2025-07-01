import { Button, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import React from 'react';
import { DialogActionsCM } from './CMCoreComponents2';
import { ReactiveInputDialog } from './ReactiveInputDialog';


export type MessageBoxButton = "ok" | "cancel" | "yes" | "no";
export type MessageBoxResult = MessageBoxButton;

export interface MessageBoxOptions {
    title?: string;
    message: string;
    buttons?: MessageBoxButton[];
    defaultButton?: MessageBoxButton;
    cancelButton?: MessageBoxButton;
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
    const [defaultButton, setDefaultButton] = React.useState<MessageBoxButton>("ok");
    const [cancelButton, setCancelButton] = React.useState<MessageBoxButton>("cancel");
    const [resolveCallback, setResolveCallback] = React.useState<((result: MessageBoxResult) => void) | null>(null);

    const showMessage = ({ defaultButton = "ok", cancelButton = "cancel", ...options }: MessageBoxOptions): Promise<MessageBoxResult> => {
        setTitle(options.title || "");
        setMessage(options.message);
        setButtons(options.buttons ?? ["ok"]);
        setDefaultButton(defaultButton);
        setCancelButton(cancelButton);
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

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter") {
            handleClose(defaultButton); // Default to "ok" on Enter key press
        } else if (event.key === "Escape") {
            handleClose(cancelButton); // Default to "cancel" on Escape key press
        }
    };

    return (
        <MessageBoxContext.Provider value={{ showMessage }}>
            {children}
            <ReactiveInputDialog open={open} onCancel={() => handleClose("cancel")} onKeyDown={handleKeyDown}>
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