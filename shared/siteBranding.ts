import { z } from "zod";
import { BandSettingsRegistryKey, kBandSettingsRegistry } from "src/setting/shared/bandSettingsRegistry";

// The form edits only registered band settings; shared platform settings are excluded.
export const siteBrandingSettingByField = {
    siteTitle: "siteCustomization.title" satisfies BandSettingsRegistryKey,
    siteTitlePrefix: "siteCustomization.titlePrefix" satisfies BandSettingsRegistryKey,

    siteFaviconUrl: "siteCustomization.faviconUrl" satisfies BandSettingsRegistryKey,
    siteLogoUrl: "siteCustomization.logoUrl" satisfies BandSettingsRegistryKey,
    bandTimeZone: "dateTime.bandTimeZone" satisfies BandSettingsRegistryKey,

    calendarName: "ical.calendarName" satisfies BandSettingsRegistryKey,

    calendarCompany: "ical.calendarCompany" satisfies BandSettingsRegistryKey,
    calendarProduct: "ical.calendarProduct" satisfies BandSettingsRegistryKey,
    calendarEventPrefix: "ical.calendarEventPrefix" satisfies BandSettingsRegistryKey,
    themePrimaryMain: "siteCustomization.themeColors.primaryMain" satisfies BandSettingsRegistryKey,
    themeSecondaryMain: "siteCustomization.themeColors.secondaryMain" satisfies BandSettingsRegistryKey,
    themeBackgroundDefault: "siteCustomization.themeColors.backgroundDefault" satisfies BandSettingsRegistryKey,
    themeBackgroundPaper: "siteCustomization.themeColors.backgroundPaper" satisfies BandSettingsRegistryKey,
    themeTextPrimary: "siteCustomization.themeColors.textPrimary" satisfies BandSettingsRegistryKey,
    themeContrastText: "siteCustomization.themeColors.contrastText" satisfies BandSettingsRegistryKey,
} as const;

export const SiteBrandingSettingsSchema = z.object({
    siteTitle: kBandSettingsRegistry[siteBrandingSettingByField.siteTitle].schema,
    siteTitlePrefix: kBandSettingsRegistry[siteBrandingSettingByField.siteTitlePrefix].schema,
    siteFaviconUrl: kBandSettingsRegistry[siteBrandingSettingByField.siteFaviconUrl].schema,
    siteLogoUrl: kBandSettingsRegistry[siteBrandingSettingByField.siteLogoUrl].schema,
    bandTimeZone: kBandSettingsRegistry[siteBrandingSettingByField.bandTimeZone].schema,
    calendarName: kBandSettingsRegistry[siteBrandingSettingByField.calendarName].schema,
    calendarCompany: kBandSettingsRegistry[siteBrandingSettingByField.calendarCompany].schema,
    calendarProduct: kBandSettingsRegistry[siteBrandingSettingByField.calendarProduct].schema,
    calendarEventPrefix: kBandSettingsRegistry[siteBrandingSettingByField.calendarEventPrefix].schema,
    themePrimaryMain: kBandSettingsRegistry[siteBrandingSettingByField.themePrimaryMain].schema,
    themeSecondaryMain: kBandSettingsRegistry[siteBrandingSettingByField.themeSecondaryMain].schema,
    themeBackgroundDefault: kBandSettingsRegistry[siteBrandingSettingByField.themeBackgroundDefault].schema,
    themeBackgroundPaper: kBandSettingsRegistry[siteBrandingSettingByField.themeBackgroundPaper].schema,
    themeTextPrimary: kBandSettingsRegistry[siteBrandingSettingByField.themeTextPrimary].schema,
    themeContrastText: kBandSettingsRegistry[siteBrandingSettingByField.themeContrastText].schema,
}).strict();

export type SiteBrandingSettings = z.infer<typeof SiteBrandingSettingsSchema>;
