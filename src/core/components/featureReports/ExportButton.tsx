import { invoke } from "@blitzjs/rpc";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import * as React from 'react';
//
import getDetailCsv from "./queries/getDetailCsv";
import { FeatureReportFilterSpec } from './server/facetProcessor';


const downloadFile = (content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};


interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    filterSpec: FeatureReportFilterSpec;
}

const ExportDialog = ({ open, onClose, filterSpec }: ExportDialogProps) => {
    const [status, setStatus] = React.useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = React.useState<string>('');

    const handleExport = async () => {
        setStatus('exporting');
        setErrorMessage('');

        try {
            // Call the CSV export query
            const result = await invoke(getDetailCsv, {
                refreshTrigger: Date.now(),
                filterSpec,
            });

            if (result) {
                // Create and download the file
                downloadFile(result.csvContent, result.filename);

                setStatus('success');
            } else {
                setStatus('error');
                setErrorMessage('Export failed: No data returned');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleClose = () => {
        if (status !== 'exporting') {
            onClose();
            setStatus('idle');
            setErrorMessage('');
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Export Activity Data</DialogTitle>
            <DialogContent>
                {status === 'idle' && (
                    <div>
                        <p>This will export activity records to a file.</p>
                        <p>The file will include all activity details with related entities (events, songs, files, etc.) in a format suitable for analysis in Excel or other tools.</p>
                    </div>
                )}
                {status === 'exporting' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <CircularProgress size={24} />
                        <span>Preparing export...</span>
                    </div>
                )}
                {status === 'success' && (
                    <div style={{ color: 'green' }}>
                        ✅ Export completed! The file should start downloading automatically.
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ color: 'red' }}>
                        ❌ {errorMessage}
                    </div>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={status === 'exporting'}>
                    {status === 'success' ? 'Close' : 'Cancel'}
                </Button>
                {status === 'idle' && (
                    <Button onClick={handleExport} variant="contained" color="primary">
                        Export CSV
                    </Button>
                )}
                {status === 'error' && (
                    <Button onClick={handleExport} variant="contained" color="primary">
                        Retry
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};



interface ExportButtonProps {
    filterSpec: FeatureReportFilterSpec;
}

export const ExportButton = ({ filterSpec }: ExportButtonProps) => {
    const [showDialog, setShowDialog] = React.useState(false);

    return (
        <>
            <Button
                // variant="outlined"
                // size="small"
                onClick={() => setShowDialog(true)}
                style={{ margin: '8px' }}
            >
                📊 Export Data...
            </Button>
            <ExportDialog
                open={showDialog}
                onClose={() => setShowDialog(false)}
                filterSpec={filterSpec}
            />
        </>
    );
};
