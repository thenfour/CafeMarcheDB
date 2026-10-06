import { z } from "zod";
import { stringSetting } from "./settingsHelpers";
import { freezeRegistry } from "./registryHelpers";
import { BandTimeZoneSchema, DEFAULT_BAND_TIME_ZONE } from "@/shared/dateTimePolicy";
import { DefaultDbBrandConfig } from "shared/brandConfigBase";
import { BrandAssetUrlSchema, OptionalBrandColorSchema } from "shared/brandingValidation";
import { Permission } from "shared/permissions";

// TO BAND-scoped SETTING ---------------------------------------------
// - Dashboard_SiteTitle -> band.siteTitle
// - Dashboard_SiteTitlePrefix -> band.siteTitlePrefix
// - Dashboard_SiteFaviconUrl -> band.siteFaviconUrl
// - Dashboard_Theme_PrimaryMain -> band.theme.primaryMainColor
// - Dashboard_Theme_SecondaryMain -> band.theme.secondaryMainColor
// - Dashboard_Theme_BackgroundDefault -> band.theme.backgroundDefaultColor
// - Dashboard_Theme_BackgroundPaper -> band.theme.backgroundPaperColor
// - Dashboard_Theme_ContrastText -> band.theme.contrastTextColor
//    BandTimeZone = "BandTimeZone", -> band.dateTime.bandTimeZone
// - Ical_CalendarName -> band.ical.calendarName
// - Ical_CalendarCompany -> band.ical.calendarCompany
// - Ical_CalendarProduct -> band.ical.calendarProduct
// - Ical_CalendarEventPrefix -> band.ical.calendarEventPrefix


export const kBandSettingsRegistry = freezeRegistry({
    // site config / branding
    "siteCustomization.title": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteTitle,
        writePermission: Permission.manage_site_branding,
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "siteCustomization.titlePrefix": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteTitlePrefix,
        writePermission: Permission.manage_site_branding,
        schema: z.string().max(8),
        stringFormat: "plain",
    }),
    "siteCustomization.faviconUrl": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteFaviconUrl,
        writePermission: Permission.manage_site_branding,
        schema: BrandAssetUrlSchema,
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.primaryMain": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.primaryMain!,
        writePermission: Permission.manage_site_branding,
        // Colors must be usable by MUI; an empty value selects the presentation default.
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.secondaryMain": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.secondaryMain!,
        writePermission: Permission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.backgroundDefault": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.backgroundDefault!,
        writePermission: Permission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.backgroundPaper": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.backgroundPaper!,
        writePermission: Permission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.contrastText": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.contrastText!,
        writePermission: Permission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
    }),

    //    BandTimeZone = "BandTimeZone", -> band.dateTime.bandTimeZone
    "dateTime.bandTimeZone": stringSetting({
        defaultValue: DEFAULT_BAND_TIME_ZONE,
        // A timezone write reanchors only this band's all-day events in the same transaction.
        schema: BandTimeZoneSchema,
        stringFormat: "plain",
    }),

    // - Ical_CalendarName -> band.ical.calendarName
    // - Ical_CalendarCompany -> band.ical.calendarCompany
    // - Ical_CalendarProduct -> band.ical.calendarProduct
    // - Ical_CalendarEventPrefix -> band.ical.calendarEventPrefix

    "ical.calendarName": stringSetting({
        writePermission: Permission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarCompany": stringSetting({
        writePermission: Permission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarProduct": stringSetting({
        writePermission: Permission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarEventPrefix": stringSetting({
        writePermission: Permission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
});

export type BandSettingsRegistryKey = keyof typeof kBandSettingsRegistry;