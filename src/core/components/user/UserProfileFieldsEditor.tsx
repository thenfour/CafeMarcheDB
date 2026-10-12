import React from "react";
import { Alert, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import type { UserPublicId } from "shared/publicId";
import { xUserMinimum } from "src/core/db3/shared/schema/user";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton } from "../CMCoreComponents2";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { useMemberAssignmentSave } from "./useMemberAssignmentSave";

export interface UserProfileFields {
    readonly name: string;
    readonly phone?: string | null;
}

/** The caller chooses account or membership authority; the dialog edits shared person fields. */
export function UserProfileFieldsEditor({ person, canEdit, saveProfile, refetch }: {
    readonly person: { readonly publicId: UserPublicId; readonly name?: string; readonly phone?: string | null };
    readonly canEdit: boolean;
    readonly saveProfile: (fields: UserProfileFields) => Promise<unknown>;
    readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const recordFeature = useFeatureRecorder();
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState(person.name ?? "");
    const [phone, setPhone] = React.useState(person.phone ?? "");
    const { save, saving, error, isPending } = useMemberAssignmentSave<UserProfileFields>({
        execute: saveProfile, refetch, refreshRelatedData: presentation.invalidate,
        onCommitted: () => {
            setOpen(false);
            void recordFeature({ feature: ActivityFeature.profile_edit, context: `profile/${person.publicId}` })
                .catch(reason => console.error("Error recording profile edit", reason));
        },
        messages: { saved: "membership.profile.saved", failed: "membership.profile.failed", refreshFailed: "membership.profile.refreshFailed" },
    });
    const close = () => {
        if (!isPending()) {
            setOpen(false);
        }
    };
    return <Stack spacing={1} alignItems="flex-start">
        {error && !open && <Alert severity="error">{error}</Alert>}
        {canEdit && person.name !== undefined && <CMButton disabled={saving} onClick={() => {
            setName(person.name ?? "");
            setPhone(person.phone ?? "");
            setOpen(true);
        }}>{locale.getPlainString("membership.profile.edit")}</CMButton>}
        <ResponsiveDialog open={open && canEdit} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>{locale.getPlainString("membership.profile.edit")}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>{locale.getPlainString("membership.profile.shared")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField label={locale.getPlainString("membership.profile.name")} value={name} disabled={saving}
                    inputProps={{ maxLength: xUserMinimum.fields.name.maxLength }} onChange={event => setName(event.target.value)} />
                {person.phone !== undefined && <TextField label={locale.getPlainString("membership.profile.phone")} value={phone} disabled={saving}
                    inputProps={{ maxLength: xUserMinimum.fields.phone.maxLength }} onChange={event => setPhone(event.target.value)} />}
            </Stack></DialogContent>
            <DialogActions>
                <CMButton disabled={saving} onClick={close}>{locale.getPlainString("common.action.cancel")}</CMButton>
                <CMButton disabled={saving || !canEdit || !name.trim()} onClick={() => { void save({
                    name: name.trim(), ...(person.phone !== undefined ? { phone: phone.trim() || null } : {}),
                }); }}>{locale.getPlainString("membership.profile.save")}</CMButton>
            </DialogActions>
        </ResponsiveDialog>
    </Stack>;
}
