import React, { createContext, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertProps } from '@mui/material/Alert';

type SnackbarProps = Pick<AlertProps, 'children' | 'severity'> | null;

type SnackbarContextType = {
    //showMessage: (message: string, severity: string) => void;
    showMessage: (snackbarProps: SnackbarProps) => void;
};

export const SnackbarContext = createContext<SnackbarContextType>({
    showMessage: () => { },
});


export const SnackbarProvider = ({ children }) => {
    const [snackbar, setSnackbar] = React.useState<SnackbarProps>(null);

    const showMessage = (props: SnackbarProps) => {
        setSnackbar(props);
    };
    // //setSnackbar({ children: 'Role successfully created', severity: 'success' });

    return (
        <SnackbarContext.Provider value={{ showMessage }}>
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

