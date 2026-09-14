import { useSession } from "@blitzjs/auth";
import { setQueryData, useMutation } from "@blitzjs/rpc";
import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";
import React from "react";
import updateMyUserSettings from "src/auth/mutations/updateMyUserSettings";
import getDashboardData from "src/auth/queries/getDashboardData";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";

export const CalendarUserSettingsControl = () => {
    const dashboardContext = useDashboardContext();
    const session = useSession();
    const [updateSettings] = useMutation(updateMyUserSettings);
    const [saving, setSaving] = React.useState(false);
    const snackbar = useSnackbar();
    const descriptionId = React.useId();

    const save = async (showDeclinedEvents: boolean) => {
        setSaving(true);
        try {
            const userSettings = await updateSettings({ "calendar.showDeclinedEvents": showDeclinedEvents });
            await setQueryData(getDashboardData, { userId: session.userId ?? null }, previous => previous ? {
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

    return <FormControl disabled={saving || !session.userId}>
        <FormControlLabel
            label="Show declined events in my calendar feed"
            control={<Checkbox
                checked={dashboardContext.userSettings["calendar.showDeclinedEvents"]}
                inputProps={{ "aria-describedby": descriptionId }}
                onChange={(_, checked) => { void save(checked); }}
            />}
        />
        <FormHelperText id={descriptionId}>
            When disabled, events are hidden if you aren't going.
            Changes appear when your calendar app next refreshes.
        </FormHelperText>
    </FormControl>;
};
