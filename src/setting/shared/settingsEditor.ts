import { z } from "zod";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import {
    getSettingDefinition, type SettingCommand, type SettingsHive, type SettingsHiveSnapshot,
    type SettingsKey,
} from "./settingsContract";

export const settingLabelKeys = {
    global: {
        "global.dev.textPalette": "settings.field.textPalette",
        "global.files.upload.maxImageDimension": "settings.field.maxImageDimension",
        "global.ui.visiblePermission.selectStyle": "settings.field.visibilityStyle",
        "global.ui.event.expectedAttendanceUserTag.selectStyle": "settings.field.invitationStyle",
        "global.ui.event.status.selectStyle": "settings.field.eventStatusStyle",
        "global.ui.event.type.selectStyle": "settings.field.eventTypeStyle",
        "global.ui.event.attendance.selectStyle": "settings.field.attendanceStyle",
        "global.ui.event.tags.selectStyle": "settings.field.eventTagsStyle",
        "global.ui.songCredit.type.selectStyle": "settings.field.creditTypeStyle",
        "global.ui.user.role.selectStyle": "settings.field.roleStyle",
        "global.ui.song.tags.selectStyle": "settings.field.songTagsStyle",
    },
    band: {
        "siteCustomization.title": "settings.field.siteTitle",
        "siteCustomization.titlePrefix": "settings.field.titlePrefix",
        "siteCustomization.faviconUrl": "settings.field.faviconUrl",
        "siteCustomization.logoUrl": "settings.field.logoUrl",
        "siteCustomization.themeColors.primaryMain": "settings.field.primaryColor",
        "siteCustomization.themeColors.secondaryMain": "settings.field.secondaryColor",
        "siteCustomization.themeColors.backgroundDefault": "settings.field.backgroundColor",
        "siteCustomization.themeColors.backgroundPaper": "settings.field.paperColor",
        "siteCustomization.themeColors.contrastText": "settings.field.contrastColor",
        "dateTime.bandTimeZone": "settings.field.timeZone",
        "ical.calendarName": "settings.field.calendarName",
        "ical.calendarCompany": "settings.field.calendarCompany",
        "ical.calendarProduct": "settings.field.calendarProduct",
        "ical.calendarEventPrefix": "settings.field.eventPrefix",
    },
    user: {
        "calendar.showDeclinedEvents": "settings.field.showDeclined",
        "calendar.showUninvitedEvents": "settings.field.showUninvited",
    },
    bandUser: { "calendar.locale": "settings.field.calendarLocale" },
} as const satisfies { [H in SettingsHive]: { [K in SettingsKey<H>]: LocalizedPlainStringKey } };

export const settingsScopeLabelKeys = {
    global: "settings.scope.global", band: "settings.scope.band",
    user: "settings.scope.user", bandUser: "settings.scope.bandUser",
} as const satisfies { [H in SettingsHive]: LocalizedPlainStringKey };

export function getSettingsEditorLabelKey(hive: SettingsHive, key: string): LocalizedPlainStringKey {
    const labels = Object.entries(settingLabelKeys[hive]);
    const label = labels.find(([registeredKey]) => registeredKey === key);
    if (!label) {
        throw new Error(`No editor label for ${hive}/${key}.`);
    }
    return label[1];
}

const clipboardEntrySchema = z.object({ key: z.string().min(1), value: z.unknown() }).strict();

/** Clipboard values belong only to the currently selected scope. No scope IDs come from pasted text. */
export function parseSettingsClipboard(hive: SettingsHive, snapshot: SettingsHiveSnapshot, text: string): SettingCommand[] {
    const entries = z.array(clipboardEntrySchema).min(1).parse(JSON.parse(text));
    const seen = new Set<string>();
    return entries.map(({ key, value }) => {
        if (seen.has(key)) {
            throw new Error(`Duplicate setting: ${key}`);
        }
        seen.add(key);
        const definition = getSettingDefinition(hive, key);
        if (!snapshot[key]?.capabilities.canEdit) {
            throw new Error(`Cannot edit ${hive}/${key}.`);
        }
        return { hive, key, operation: { kind: "set", value: definition.schema.parse(value) } };
    });
}

export function serializeSettingsClipboard(snapshot: SettingsHiveSnapshot): string {
    return JSON.stringify(Object.entries(snapshot).filter(([, entry]) => entry.capabilities.canView)
        .map(([key, entry]) => ({ key, value: entry.value })), null, 2);
}
