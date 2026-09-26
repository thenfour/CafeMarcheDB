import { setQueryData, useMutation } from "@blitzjs/rpc";
import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";
import React from "react";
import type { UserSettingsPatch } from "shared/userSettings";
import updateMyUserSettings from "src/auth/mutations/updateMyUserSettings";
import getDashboardData from "src/auth/queries/getDashboardData";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";

export const CalendarUserSettingsControl = () => {
    const dashboardContext = useDashboardContext();
    const [updateSettings] = useMutation(updateMyUserSettings);
    const [saving, setSaving] = React.useState(false);
    const snackbar = useSnackbar();
    const descriptionId = React.useId();
    const invitationDescriptionId = React.useId();

    const save = async (patch: UserSettingsPatch) => {
        setSaving(true);
        try {
            const userSettings = await updateSettings(patch);
            await setQueryData(getDashboardData, {}, previous => previous ? {
                ...previous,
                userSettings,
            } : previous, { refetch: false });
            snackbar.showSuccess("Calendar preference saved");
        } catch {
            snackbar.showError("Could not save your calendar preference. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return <FormControl disabled={saving || !dashboardContext.currentUser}>
        <FormControlLabel
            label="Show declined events in my calendar feed"
            control={<Checkbox
                checked={dashboardContext.userSettings["calendar.showDeclinedEvents"]}
                name="calendar.showDeclinedEvents"
                inputProps={{ "aria-describedby": descriptionId }}
                onChange={(_, checked) => { void save({ "calendar.showDeclinedEvents": checked }); }}
            />}
        />
        <FormHelperText id={descriptionId}>
            When disabled, events are hidden if you aren't going.
        </FormHelperText>
        <FormControlLabel
            label="Show events I'm not invited to in my calendar feed"
            control={<Checkbox
                checked={dashboardContext.userSettings["calendar.showUninvitedEvents"]}
                name="calendar.showUninvitedEvents"
                inputProps={{ "aria-describedby": invitationDescriptionId }}
                onChange={(_, checked) => { void save({ "calendar.showUninvitedEvents": checked }); }}
            />}
        />
        <FormHelperText id={invitationDescriptionId}>
            When disabled, events you're not explicitly attending are hidden if you aren't invited.
        </FormHelperText>
        <FormHelperText>
            Changes appear when your calendar app next refreshes.
        </FormHelperText>
    </FormControl>;
};
