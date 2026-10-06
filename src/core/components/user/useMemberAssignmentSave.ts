import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";

/** Both membership editors retain drafts on failure and distinguish committed writes from failed refreshes. */
export function useMemberAssignmentSave<TEdit>(args: {
    readonly execute: (edit: TEdit) => Promise<unknown>;
    readonly refetch: () => Promise<unknown>;
    readonly onCommitted: (edit: TEdit) => void;
    readonly messages: {
        readonly saved: LocalizedPlainStringKey;
        readonly failed: LocalizedPlainStringKey;
        readonly refreshFailed: LocalizedPlainStringKey
    };
}) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const snackbar = useSnackbar();
    const pending = React.useRef(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const save = async (edit: TEdit) => {
        if (pending.current) {
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        let didSave = false;
        try {
            await args.execute(edit);
            didSave = true;
            args.onCommitted(edit);
            await Promise.all([args.refetch(), dashboard.refreshCachedData()]);
            snackbar.showMessage({ severity: "success", children: locale.getPlainString(args.messages.saved) });
        } catch (reason) {
            setError(locale.getPlainString(didSave ? args.messages.refreshFailed : args.messages.failed));
            console.error(reason);
        } finally {
            pending.current = false;
            setSaving(false);
        }
    };
    return { save, saving, error, isPending: () => pending.current };
}
