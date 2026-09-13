import { z } from "zod";
import {
    BrandAssetUrlSchema,
    OptionalBrandColorSchema,
    RequiredBrandColorSchema,
} from "./brandingValidation";
import { BandTimeZoneSchema, resolveBandTimeZone } from "./dateTimePolicy";
import { Setting } from "./settingKeys";

// Branding is a single delegated configuration capability even though its
// values continue to use the general Setting storage. This strict schema is
// the server boundary: platform settings such as Dashboard_HostingMode cannot
// be smuggled into a branding update by supplying an arbitrary setting name.
export const SiteBrandingSettingsSchema = z.object({
    siteTitle: z.string(),
    siteTitlePrefix: z.string(),
    siteFaviconUrl: BrandAssetUrlSchema,
    siteLogoUrl: BrandAssetUrlSchema,
    bandTimeZone: BandTimeZoneSchema,
    calendarName: z.string(),
    calendarCompany: z.string(),
    calendarProduct: z.string(),
    calendarEventPrefix: z.string(),
    themePrimaryMain: RequiredBrandColorSchema,
    themeSecondaryMain: RequiredBrandColorSchema,
    themeBackgroundDefault: RequiredBrandColorSchema,
    themeBackgroundPaper: RequiredBrandColorSchema,
    themeTextPrimary: OptionalBrandColorSchema,
    themeContrastText: RequiredBrandColorSchema,
}).strict();

export type SiteBrandingSettings = z.infer<typeof SiteBrandingSettingsSchema>;

export const siteBrandingSettingByField = {
    siteTitle: Setting.Dashboard_SiteTitle,
    siteTitlePrefix: Setting.Dashboard_SiteTitlePrefix,
    siteFaviconUrl: Setting.Dashboard_SiteFaviconUrl,
    siteLogoUrl: Setting.Dashboard_SiteLogoUrl,
    bandTimeZone: Setting.BandTimeZone,
    calendarName: Setting.Ical_CalendarName,
    calendarCompany: Setting.Ical_CalendarCompany,
    calendarProduct: Setting.Ical_CalendarProduct,
    calendarEventPrefix: Setting.Ical_CalendarEventPrefix,
    themePrimaryMain: Setting.Dashboard_Theme_PrimaryMain,
    themeSecondaryMain: Setting.Dashboard_Theme_SecondaryMain,
    themeBackgroundDefault: Setting.Dashboard_Theme_BackgroundDefault,
    themeBackgroundPaper: Setting.Dashboard_Theme_BackgroundPaper,
    themeTextPrimary: Setting.Dashboard_Theme_TextPrimary,
    themeContrastText: Setting.Dashboard_Theme_ContrastText,
} as const satisfies Record<keyof SiteBrandingSettings, Setting>;

export const siteBrandingSettingNames = Object.values(siteBrandingSettingByField);

export const siteBrandingSettingsFromValues = (
    values: ReadonlyMap<string, string>,
): SiteBrandingSettings => Object.fromEntries(
    Object.entries(siteBrandingSettingByField).map(([field, settingName]) => [
        field,
        field === "bandTimeZone"
            ? resolveBandTimeZone(values.get(settingName))
            : values.get(settingName) ?? "",
    ]),
) as SiteBrandingSettings;
