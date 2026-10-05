import { Simplify } from "blitz";
import { z } from "zod";
import { stringSetting } from "./settingsHelpers";
import { freezeRegistry } from "./registryHelpers";
import { DEFAULT_BAND_TIME_ZONE } from "@/shared/dateTimePolicy";
import { AssertEqualTypes } from "@/shared/rootroot";

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
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "siteCustomization.titlePrefix": stringSetting({
        defaultValue: "",
        schema: z.string().max(8),
        stringFormat: "plain",
    }),
    "siteCustomization.faviconUrl": stringSetting({
        defaultValue: "",
        schema: z.string().max(500),
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.primaryMain": stringSetting({
        defaultValue: "",
        // a CSS color spec. either #rrggbbaa or longer variants like
        // device-cmyk(none none none none)
        // or even valid, compound color calcs like
        // color-mix(in cmyk longer hue, device-cmyk(none none none none) 100%, device-cmyk(none none none none) 100%)
        schema: z.string().max(150),
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.secondaryMain": stringSetting({
        defaultValue: "",
        schema: z.string().max(150),
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.backgroundDefault": stringSetting({
        defaultValue: "",
        schema: z.string().max(150),
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.backgroundPaper": stringSetting({
        defaultValue: "",
        schema: z.string().max(150),
        stringFormat: "plain",
    }),
    "siteCustomization.themeColors.contrastText": stringSetting({
        defaultValue: "",
        schema: z.string().max(150),
        stringFormat: "plain",
    }),

    //    BandTimeZone = "BandTimeZone", -> band.dateTime.bandTimeZone
    "dateTime.bandTimeZone": stringSetting({
        defaultValue: DEFAULT_BAND_TIME_ZONE,
        // https://stackoverflow.com/questions/38399465/how-to-get-list-of-all-timezones-in-javascript
        // Intl.supportedValuesOf('timeZone').sort((a, b) => a.length - b.length).reverse()
        // 0: "America/North_Dakota/New_Salem"
        // 1: "America/Argentina/Rio_Gallegos"
        // 2: "America/Argentina/Buenos_Aires"
        schema: z.string().max(100),
        stringFormat: "plain",
    }),

    // - Ical_CalendarName -> band.ical.calendarName
    // - Ical_CalendarCompany -> band.ical.calendarCompany
    // - Ical_CalendarProduct -> band.ical.calendarProduct
    // - Ical_CalendarEventPrefix -> band.ical.calendarEventPrefix

    "ical.calendarName": stringSetting({
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarCompany": stringSetting({
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarProduct": stringSetting({
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
    "ical.calendarEventPrefix": stringSetting({
        defaultValue: "",
        schema: z.string().max(100),
        stringFormat: "plain",
    }),
});

// const cp = kBandSettingsRegistry["ical.calendarProduct"];
// type cptype = Simplify<typeof cp>;
