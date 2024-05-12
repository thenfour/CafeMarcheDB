import Alert, { AlertProps } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import React, { createContext } from 'react';

type SnackbarProps = Pick<AlertProps, 'children' | 'severity'> | null;

export type SnackbarContextType = {
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

