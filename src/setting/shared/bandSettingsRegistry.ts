import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { z } from "zod";
import { stringSetting } from "./settingsHelpers";
import { freezeRegistry } from "./registryHelpers";
import { BandTimeZoneSchema, DEFAULT_BAND_TIME_ZONE } from "@/shared/dateTimePolicy";
import { DefaultDbBrandConfig } from "shared/brandConfigBase";
import { BrandAssetUrlSchema, OptionalBrandColorSchema } from "shared/brandingValidation";

// TO BAND-scoped SETTING ---------------------------------------------
// - Dashboard_SiteTitle -> band.siteTitle
// - Dashboard_SiteTitlePrefix -> band.siteTitlePrefix
// - Dashboard_SiteFaviconUrl -> band.siteFaviconUrl
// - Dashboard_Theme_PrimaryMain -> band.theme.primaryMainColor
// - Dashboard_Theme_SecondaryMain -> band.theme.secondaryMainColor
// - Dashboard_Theme_BackgroundDefault -> band.theme.backgroundDefaultColor
// - Dashboard_Theme_BackgroundPaper -> band.theme.backgroundPaperColor
// - Dashboard_Theme_TextPrimary -> band.siteCustomization.themeColors.textPrimary
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
        writePermission: BandPermission.manage_site_branding,
        schema: z.string().max(100),
        stringFormat: "plain",

        // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
        // but actually the CORRECT solution is  to just specify explicit permissions and use a proper
        // db3 query. that resolves access and fallback system.
        isBranding: true,
    }),
    "siteCustomization.titlePrefix": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteTitlePrefix,
        writePermission: BandPermission.manage_site_branding,
        schema: z.string().max(8),
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.faviconUrl": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteFaviconUrl,
        writePermission: BandPermission.manage_site_branding,
        schema: BrandAssetUrlSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.logoUrl": stringSetting({
        defaultValue: DefaultDbBrandConfig.siteLogoUrl ?? "",
        writePermission: BandPermission.manage_site_branding,
        schema: BrandAssetUrlSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.primaryMain": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.primaryMain!,
        writePermission: BandPermission.manage_site_branding,
        // Colors must be usable by MUI; an empty value selects the presentation default.
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.secondaryMain": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.secondaryMain!,
        writePermission: BandPermission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.backgroundDefault": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.backgroundDefault!,
        writePermission: BandPermission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.backgroundPaper": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.backgroundPaper!,
        writePermission: BandPermission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.textPrimary": stringSetting({
        // Empty leaves primary text color to the application theme.
        defaultValue: DefaultDbBrandConfig.theme?.textPrimary ?? "",
        writePermission: BandPermission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),
    "siteCustomization.themeColors.contrastText": stringSetting({
        defaultValue: DefaultDbBrandConfig.theme!.contrastText!,
        writePermission: BandPermission.manage_site_branding,
        schema: OptionalBrandColorSchema,
        stringFormat: "plain",
        isBranding: true, // in order to know which settings to fetch when rendering simple branding-only (i.e. public)
    }),

    //    BandTimeZone = "BandTimeZone", -> band.dateTime.bandTimeZone
    "dateTime.bandTimeZone": stringSetting({
        defaultValue: DEFAULT_BAND_TIME_ZONE,
        // A timezone write reanchors only this band's all-day events in the same transaction.
        schema: BandTimeZoneSchema,
        stringFormat: "plain",
        isBranding: false,
    }),

    // - Ical_CalendarName -> band.ical.calendarName
    // - Ical_CalendarCompany -> band.ical.calendarCompany
    // - Ical_CalendarProduct -> band.ical.calendarProduct
    // - Ical_CalendarEventPrefix -> band.ical.calendarEventPrefix

    "ical.calendarName": stringSetting({
        writePermission: BandPermission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
        isBranding: false,
    }),
    "ical.calendarCompany": stringSetting({
        writePermission: BandPermission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
        isBranding: false,
    }),
    "ical.calendarProduct": stringSetting({
        writePermission: BandPermission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
        isBranding: false,
    }),
    "ical.calendarEventPrefix": stringSetting({
        writePermission: BandPermission.manage_site_branding,
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
        isBranding: false,
    }),
});

export type BandSettingsRegistryKey = keyof typeof kBandSettingsRegistry;
