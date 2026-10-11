import React from "react";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Alert, Checkbox, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { GlobalRolePublicId, UserPublicId } from "shared/publicId";
import assignUserRole from "src/auth/mutations/assignUserRole";
import getUserManagementCapabilities from "src/auth/queries/getUserManagementCapabilities";
import { kContinuityAcknowledgementErrorPrefix } from "src/auth/server/userManagementPolicy";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton, CMButtonGroup } from "../CMCoreComponents2";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

type AccountRoleCapabilities = Awaited<ReturnType<typeof getUserManagementCapabilities>>;
interface AccountRoleProps {
    readonly userId: UserPublicId;
    readonly onChanged: () => Promise<unknown> | void;
}

export function AccountRoleControl({ userId, capabilities, onChanged, initiallyOpen = false, onClosed }: AccountRoleProps & {
    readonly capabilities: AccountRoleCapabilities;
    readonly initiallyOpen?: boolean;
    readonly onClosed?: () => void;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const dashboard = useDashboardContext();
    const [assign] = useMutation(assignUserRole);
    const [open, setOpen] = React.useState(initiallyOpen);
    const [draft, setDraft] = React.useState<GlobalRolePublicId | null>(capabilities.currentRoleId);
    const [warnings, setWarnings] = React.useState<string[]>([]);
    const [acknowledged, setAcknowledged] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const pending = React.useRef(false);
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);
    const close = () => {
        if (!pending.current) {
            setOpen(false);
            onClosed?.();
        }
    };
    const save = async () => {
        if (pending.current || !capabilities.canAssignRole || (warnings.length > 0 && !acknowledged)) {
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        let committed = false;
        try {
            await assign({ userId, roleId: draft, acknowledgeContinuityRisk: acknowledged });
            committed = true;
            if (!alive.current) {
                return;
            }
            setOpen(false);
            await Promise.all([onChanged(), dashboard.refreshCachedData(), presentation.invalidate()]);
            onClosed?.();
        } catch (reason) {
            if (!alive.current) {
                return;
            }
            const message = reason instanceof Error ? reason.message : String(reason);
            const index = message.indexOf(kContinuityAcknowledgementErrorPrefix);
            if (!committed && index >= 0) {
                setWarnings(message.slice(index + kContinuityAcknowledgementErrorPrefix.length).split(",").filter(Boolean));
                setAcknowledged(false);
            } else {
                console.error(reason);
                setError(locale.getPlainString(committed ? "roles.refreshFailed" : "roles.failed"));
            }
        } finally {
            pending.current = false;
            if (alive.current) {
                setSaving(false);
            }
        }
    };
    const current = capabilities.assignableRoles.find(role => role.publicId === capabilities.currentRoleId);
    return <Stack spacing={1} alignItems="flex-start">
        <Typography>{locale.getPlainString("roles.account")}: {capabilities.currentRoleId === null
            ? locale.getPlainString("roles.noAccountRole") : current?.name ?? locale.getPlainString("membership.roles.unavailable")}</Typography>
        {capabilities.canAssignRole && <CMButton disabled={saving} onClick={() => {
            setDraft(capabilities.currentRoleId); setWarnings([]); setAcknowledged(false); setError(null); setOpen(true);
        }}>{locale.getPlainString("roles.editAccount")}</CMButton>}
        {error && !open && <Alert severity="error">{error}</Alert>}
        <ResponsiveDialog open={open} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>{locale.getPlainString("roles.editAccount")}</DialogTitle>
            <DialogContent><Stack spacing={2}>
                <Typography>{locale.getPlainString("roles.accountDescription")}</Typography>
                <TextField select label={locale.getPlainString("roles.account")} value={draft ?? ""} disabled={saving}
                    onChange={event => {
                        setDraft(event.target.value ? capabilities.assignableRoles.find(role => role.publicId === event.target.value)?.publicId ?? null : null);
                        setWarnings([]); setAcknowledged(false);
                    }}>
                    <MenuItem value="">{locale.getPlainString("roles.noAccountRole")}</MenuItem>
                    {capabilities.assignableRoles.map(role => <MenuItem key={role.publicId} value={role.publicId}>{role.name}</MenuItem>)}
                </TextField>
                {warnings.length > 0 && <Alert severity="warning">{locale.getPlainString("roles.continuity")}
                    <ul>{warnings.map(permission => <li key={permission}>{permission}</li>)}</ul>
                    <FormControlLabel label={locale.getPlainString("roles.acknowledge")} control={<Checkbox checked={acknowledged} disabled={saving}
                        onChange={(_, checked) => setAcknowledged(checked)} />} />
                </Alert>}
                {error && <Alert severity="error">{error}</Alert>}
                {saving && <Typography role="status">{locale.getPlainString("roles.saving")}</Typography>}
                <CMButtonGroup><CMButton disabled={saving || !capabilities.canAssignRole || (warnings.length > 0 && !acknowledged)} onClick={() => void save()}>{locale.getPlainString("roles.save")}</CMButton>
                    <CMButton disabled={saving} onClick={close}>{locale.getPlainString("common.action.cancel")}</CMButton></CMButtonGroup>
            </Stack></DialogContent>
        </ResponsiveDialog>
    </Stack>;
}

function LoadedAccountRoleAction({ userId, onChanged, onClosed }: AccountRoleProps & { readonly onClosed: () => void }) {
    const context = useDB3QueryContext();
    const { bandPublicId: _band, ...locale } = context;
    const [capabilities, { refetch }] = useQuery(getUserManagementCapabilities, { ...locale, userId },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const localeStrings = useLocale();
    if (!capabilities.canAssignRole) {
        return <Stack spacing={1}><Alert severity="info">{localeStrings.getPlainString("roles.accountUnavailable")}</Alert>
            <CMButton onClick={onClosed}>{localeStrings.getPlainString("common.action.cancel")}</CMButton></Stack>;
    }
    return <AccountRoleControl key={`${userId}:${context.bandPublicId}:${context.routeLocale}:${context.browserLanguages?.join(",")}`}
        userId={userId} capabilities={capabilities} initiallyOpen={true} onClosed={onClosed} onChanged={() => Promise.all([refetch(), onChanged()])} />;
}

/** The account grid loads role choices only when its row's action is opened. */
export function AccountRoleAction(props: AccountRoleProps) {
    const locale = useLocale();
    const [editing, setEditing] = React.useState(false);
    return editing ? <React.Suspense fallback={<Typography>{locale.getPlainString("roles.account")}</Typography>}>
        <LoadedAccountRoleAction {...props} onClosed={() => setEditing(false)} />
    </React.Suspense> : <CMButton onClick={() => setEditing(true)}>{locale.getPlainString("roles.editAccount")}</CMButton>;
}
