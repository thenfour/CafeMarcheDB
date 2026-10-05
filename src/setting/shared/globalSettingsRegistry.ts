
import { z } from "zod";
import { enumSetting, stringSetting } from "./settingsHelpers";
import { freezeRegistry } from "./registryHelpers";

// registry = things that can change during runtime.
// environment = things that require restart of app, which don't make sense to change at runtime.

// TO GLOBAL-scoped SETTING ---------------------------------------------
// - textPalette -> global.dev.textPalette
//    maxImageDimension = "maxImageDimension", -- for image uploads -> global.files.upload.maxImageDimension

// ending with "visiblePermission.SelectStyle" => can be removed, and we will use the default value of "global.ui.visiblePermission.selectStyle" instead.
// - File.visiblePermission.SelectStyle
// - Song.visiblePermission.SelectStyle
// - event.visiblePermission.SelectStyle
// - MenuLink.visiblePermission.SelectStyle

// - event.expectedAttendanceUserTag.SelectStyle -> global.ui.event.expectedAttendanceUserTag.selectStyle
// - event.status.SelectStyle -> global.ui.event.status.selectStyle
// - event.type.SelectStyle -> global.ui.event.type.selectStyle

// - eventSegmentUserResponse.attendance.SelectStyle -> global.ui.event.attendance.selectStyle
// - EventSegment.status.SelectStyle --> merge with global.ui.event.status.selectStyle
// - Event.tags.SelectStyle

// - songCredit.type.SelectStyle
// - user.role.SelectStyle
// - Song.tags.SelectStyle

const SelectStyleSchema = z.enum(["inline", "dialog"]);

export const kGlobalSettingsRegistry = freezeRegistry({
    "global.dev.textPalette": stringSetting({
        defaultValue: "",
        schema: z.string(),
        stringFormat: "plain",
    }),

    "global.files.upload.maxImageDimension": stringSetting({
        defaultValue: "",
        schema: z.string(),
        stringFormat: "plain",
    }),

    // general UI
    "global.ui.visiblePermission.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),

    // event ui
    "global.ui.event.expectedAttendanceUserTag.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    "global.ui.event.status.selectStyle": enumSetting({ // also for 
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    "global.ui.event.type.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    "global.ui.event.attendance.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    "global.ui.event.tags.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),

    // songCredit.type.selectStyle
    "global.ui.songCredit.type.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    // user.role.selectStyle
    "global.ui.user.role.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
    // Song.tags.selectStyle
    "global.ui.song.tags.selectStyle": enumSetting({
        defaultValue: "inline",
        schema: SelectStyleSchema,
    }),
});

export type GlobalSettingKey = keyof typeof kGlobalSettingsRegistry;

// TO ENVIRONMENT VARIABLE ---------------------------------------------
// - Dashboard_HostingMode // CafeMarche or GenericSingleTenant --> this should migrate to .env

// TO DELETE (unused/obsolete) ---------------------------------------------
// - EnableNewPublicHomepageBackstageLink
// - EnableOldPublicHomepageBackstageLink
// - info_text
// - CustomLinkRedirectTypeDescriptionMarkdown_Temporary
// - MarkdownHelpPage
// - EventSegment
// - Event.workflowDef.SelectStyle --> obsolete

