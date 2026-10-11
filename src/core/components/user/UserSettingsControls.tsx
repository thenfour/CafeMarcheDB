import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";
import React from "react";
import { useSnackbar } from "../SnackbarContext";
import { useUserSettings } from "@/src/setting/client/useSettings";
import { useLocale } from "src/locale/components/useLocale";

export const CalendarUserSettingsControl = () => {
    const userSettings = useUserSettings();
    const locale = useLocale();
    const [saving, setSaving] = React.useState(false);
    const snackbar = useSnackbar();
    const descriptionId = React.useId();
    const invitationDescriptionId = React.useId();

    const save = async (proc: () => Promise<void>) => {
        setSaving(true);
        try {
            await proc();
            snackbar.showSuccess(locale.getPlainString("settings.preference.saved"));
        } catch {
            snackbar.showError(locale.getPlainString("settings.preference.failed"));
        } finally {
            setSaving(false);
        }
    };

    return <FormControl disabled={saving}>
        <FormControlLabel
            label={locale.getPlainString("settings.preference.showDeclined")}
            control={<Checkbox
                checked={userSettings.getValue("calendar.showDeclinedEvents")}
                name="calendar.showDeclinedEvents"
                disabled={!userSettings.getCapabilities("calendar.showDeclinedEvents").canEdit}
                inputProps={{ "aria-describedby": descriptionId }}
                onChange={(_, checked) => {
                    void save(() => userSettings.setValue("calendar.showDeclinedEvents", checked));
                }}
            />}
        />
        <FormHelperText id={descriptionId}>
            {locale.getPlainString("settings.preference.declinedHelp")}
        </FormHelperText>
        <FormControlLabel
            label={locale.getPlainString("settings.preference.showUninvited")}
            control={<Checkbox
                checked={userSettings.getValue("calendar.showUninvitedEvents")}
                name="calendar.showUninvitedEvents"
                disabled={!userSettings.getCapabilities("calendar.showUninvitedEvents").canEdit}
                inputProps={{ "aria-describedby": invitationDescriptionId }}
                onChange={(_, checked) => { void save(() => userSettings.setValue("calendar.showUninvitedEvents", checked)); }}
            />}
        />
        <FormHelperText id={invitationDescriptionId}>
            {locale.getPlainString("settings.preference.uninvitedHelp")}
        </FormHelperText>
        <FormHelperText>
            {locale.getPlainString("settings.preference.refreshHelp")}
        </FormHelperText>
    </FormControl>;
};
