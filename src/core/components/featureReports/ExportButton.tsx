import { invoke } from "@blitzjs/rpc";
import { Alert, CircularProgress } from "@mui/material";
import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton } from "../CMCoreComponents2";
import { CMDialog } from "../CMDialog";
import type { FacetedBreakdownInput } from "./activityReportTypes";
import { downloadActivityCsv } from "./activityCsvDownload";
import getDetailCsv from "./queries/getDetailCsv";

type ActivityExportState = { readonly status: "idle" | "exporting" | "error" }
    | { readonly status: "success"; readonly rowCount: number; readonly total: number; readonly rowLimit: number };

export function ExportButton({ input, refetchTrigger }: { readonly input: FacetedBreakdownInput; readonly refetchTrigger: number }) {
    const locale = useLocale();
    const [open, setOpen] = React.useState(false);
    const [state, setState] = React.useState<ActivityExportState>({ status: "idle" });
    const requestKey = JSON.stringify([input, refetchTrigger]);
    const request = React.useRef({ key: requestKey, attempt: 0 });
    request.current.key = requestKey;
    React.useEffect(() => {
        setOpen(false);
        setState({ status: "idle" });
        return () => { request.current.attempt += 1; };
    }, [requestKey]);

    const close = () => {
        if (state.status === "exporting") {
            return;
        }
        request.current.attempt += 1;
        setOpen(false);
        setState({ status: "idle" });
    };
    const exportCsv = async () => {
        const attempt = ++request.current.attempt;
        const isCurrent = () => request.current.key === requestKey && request.current.attempt === attempt;
        setState({ status: "exporting" });
        try {
            const result = await invoke(getDetailCsv, input);
            if (!isCurrent()) {
                return;
            }
            downloadActivityCsv(result);
            setState({ status: "success", rowCount: result.rowCount, total: result.metrics.totalRowCount, rowLimit: result.rowLimit });
        } catch {
            if (isCurrent()) {
                setState({ status: "error" });
            }
        }
    };
    return <>
        <CMButton onClick={() => setOpen(true)}>{locale.getPlainString("activityReports.export")}</CMButton>
        <CMDialog open={open} onClose={close} maxWidth="sm" fullWidth title={locale.getPlainString("activityReports.exportTitle")}
            aria-label={locale.getPlainString("activityReports.exportTitle")} data-activity-export actions={<>
                <CMButton enabled={state.status !== "exporting"} onClick={close}>
                    {locale.getPlainString(state.status === "success" ? "activityReports.close" : "activityReports.cancel")}
                </CMButton>
                {(state.status === "idle" || state.status === "error") && <CMButton onClick={exportCsv}>
                    {locale.getPlainString(state.status === "error" ? "activityReports.retryExport" : "activityReports.exportCsv")}
                </CMButton>}
            </>}>
            {state.status === "idle" && <p>{locale.getPlainString("activityReports.exportDescription")}</p>}
            {state.status === "exporting" && <div role="status" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CircularProgress size={24} />{locale.getPlainString("activityReports.exporting")}
            </div>}
            {state.status === "error" && <Alert severity="error">{locale.getPlainString("activityReports.exportFailed")}</Alert>}
            {state.status === "success" && <>
                <Alert severity="success">{locale.getPlainString("activityReports.exported", { shown: state.rowCount, total: state.total })}</Alert>
                {state.total > state.rowLimit && <Alert severity="info">{locale.getPlainString("activityReports.exportTruncated", { limit: state.rowLimit })}</Alert>}
            </>}
        </CMDialog>
    </>;
}
