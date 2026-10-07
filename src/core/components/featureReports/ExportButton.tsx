export {};

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/ExportButton.tsx:1-136
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: 2aaa052829d50338695930be14ca59aa53a41ce7e3cc1b671aa414de319b94db
// MIGRATION_REFERENCE_BEGIN
// import { invoke } from "@blitzjs/rpc";
// import { Button, CircularProgress } from '@mui/material';
// import * as React from 'react';
// //
// import { CMDialog } from "../CMDialog";
// import { CMButton } from "../CMCoreComponents2";
// import getDetailCsv from "./queries/getDetailCsv";
// import { FeatureReportFilterSpec } from './server/facetProcessor';
//
//
// const downloadFile = (content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') => {
//     const blob = new Blob([content], { type: mimeType });
//     const link = document.createElement('a');
//     const url = URL.createObjectURL(blob);
//     link.setAttribute('href', url);
//     link.setAttribute('download', filename);
//     link.style.visibility = 'hidden';
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     URL.revokeObjectURL(url);
// };
//
//
// interface ExportDialogProps {
//     open: boolean;
//     onClose: () => void;
//     filterSpec: FeatureReportFilterSpec;
// }
//
// const ExportDialog = ({ open, onClose, filterSpec }: ExportDialogProps) => {
//     const [status, setStatus] = React.useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
//     const [errorMessage, setErrorMessage] = React.useState<string>('');
//
//     const handleExport = async () => {
//         setStatus('exporting');
//         setErrorMessage('');
//
//         try {
//             // Call the CSV export query
//             const result = await invoke(getDetailCsv, {
//                 refreshTrigger: Date.now(),
//                 filterSpec,
//             });
//
//             if (result) {
//                 // Create and download the file
//                 downloadFile(result.csvContent, result.filename);
//
//                 setStatus('success');
//             } else {
//                 setStatus('error');
//                 setErrorMessage('Export failed: No data returned');
//             }
//         } catch (error) {
//             setStatus('error');
//             setErrorMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//         }
//     };
//
//     const handleClose = () => {
//         if (status !== 'exporting') {
//             onClose();
//             setStatus('idle');
//             setErrorMessage('');
//         }
//     };
//
//     return (
//         <CMDialog
//             open={open}
//             onClose={handleClose}
//             maxWidth="sm"
//             fullWidth
//             title="Export Activity Data"
//             actions={<>
//                 <CMButton onClick={handleClose} disabled={status === 'exporting'}>
//                     {status === 'success' ? 'Close' : 'Cancel'}
//                 </CMButton>
//                 {status === 'idle' && <CMButton onClick={handleExport}>Export CSV</CMButton>}
//                 {status === 'error' && <CMButton onClick={handleExport}>Retry</CMButton>}
//             </>}
//         >
//                 {status === 'idle' && (
//                     <div>
//                         <p>This will export activity records to a file.</p>
//                         <p>The file will include all activity details with related entities (events, songs, files, etc.) in a format suitable for analysis in Excel or other tools.</p>
//                     </div>
//                 )}
//                 {status === 'exporting' && (
//                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
//                         <CircularProgress size={24} />
//                         <span>Preparing export...</span>
//                     </div>
//                 )}
//                 {status === 'success' && (
//                     <div style={{ color: 'green' }}>
//                         ✅ Export completed! The file should start downloading automatically.
//                     </div>
//                 )}
//                 {status === 'error' && (
//                     <div style={{ color: 'red' }}>
//                         ❌ {errorMessage}
//                     </div>
//                 )}
//         </CMDialog>
//     );
// };
//
//
//
// interface ExportButtonProps {
//     filterSpec: FeatureReportFilterSpec;
// }
//
// export const ExportButton = ({ filterSpec }: ExportButtonProps) => {
//     const [showDialog, setShowDialog] = React.useState(false);
//
//     return (
//         <>
//             <Button
//                 // variant="outlined"
//                 // size="small"
//                 onClick={() => setShowDialog(true)}
//                 style={{ margin: '8px' }}
//             >
//                 📊 Export Data...
//             </Button>
//             <ExportDialog
//                 open={showDialog}
//                 onClose={() => setShowDialog(false)}
//                 filterSpec={filterSpec}
//             />
//         </>
//     );
// };
// MIGRATION_REFERENCE_END
