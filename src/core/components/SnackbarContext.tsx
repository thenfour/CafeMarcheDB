import Alert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import React, { createContext } from 'react';

type SnackbarProps = Pick<AlertProps, 'children' | 'severity'> | null;

export type SnackbarContextType = {
    showMessage: (snackbarProps: SnackbarProps) => void;
    showSuccess: (message: React.ReactNode) => void;
    showError: (message: React.ReactNode) => void;
    invokeAsync: (
        asyncFunction: () => Promise<any>,
        successMessage?: React.ReactNode,
        errorMessage?: React.ReactNode
    ) => Promise<void>;
};

export const SnackbarContext = createContext<SnackbarContextType>({
    showMessage: () => { },
    showSuccess: () => { },
    showError: () => { },
    invokeAsync: async () => { },
});

export const useSnackbar = () => React.useContext(SnackbarContext);

export const SnackbarProvider = ({ children }) => {
    const [snackbar, setSnackbar] = React.useState<SnackbarProps>(null);

    const showMessage = (props: SnackbarProps) => {
        setSnackbar(props);
    };

    const showSuccess = (message: React.ReactNode) => {
        showMessage({ children: message, severity: 'success' });
    };

    const showError = (message: React.ReactNode) => {
        showMessage({ children: message, severity: 'error' });
    };

    const invokeAsync = async (
        asyncFunction: () => Promise<any>,
        successMessage?: React.ReactNode,
        errorMessage?: React.ReactNode
    ) => {
        try {
            await asyncFunction();
            showSuccess(successMessage || "Success");
        } catch (error) {
            console.error(error);
            showError(errorMessage || "error; see console");
        }
    };

    return (
        <SnackbarContext.Provider value={{ showMessage, showSuccess, showError, invokeAsync }}>
            {children}
            {/* Add your Snackbar component here */}
            {snackbar &&
                <Snackbar open onClose={() => setSnackbar(null)} autoHideDuration={6000}>
                    <Alert {...snackbar} onClose={() => setSnackbar(null)} />
                </Snackbar>
            }


        </SnackbarContext.Provider>
    );
};

