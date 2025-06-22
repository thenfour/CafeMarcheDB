import { z } from "zod";

export enum ActivityFeature {
    global_ical_digest = "global_ical_digest",

    metronome_persistent = "metronome_persistent", // metronome playing longer than 1 minute
    // note that link clicks are not 100% reliable;
    // for example right-clicking a link and opening in a new tab will not trigger this event.
    link_follow_internal = "link_follow_internal",
    link_follow_external = "link_follow_external",

    attendance_response = "attendance_response",
    attendance_instrument = "attendance_instrument",
    attendance_comment = "attendance_comment",
    attendance_explicit_invite = "attendance_explicit_invite",
    event_change_invite_tag = "event_change_invite_tag",
    event_change_custom_field = "event_change_custom_field",
    menu_link_update = "menu_link_update",
    menu_link_create = "menu_link_create",
    menu_link_reorder = "menu_link_reorder",
    menu_link_delete = "menu_link_delete",
    custom_link_create = "custom_link_create",
    custom_link_update = "custom_link_update",
    custom_link_delete = "custom_link_delete",

    profile_view = "profile_view",
    profile_edit = "profile_edit",
    profile_change_instrument = "profile_change_instrument",
    profile_change_default_instrument = "profile_change_default_instrument",
    login_email = "login_email",
    login_google = "login_google",
    logout = "logout",
    signup_email = "signup_email",
    signup_google = "signup_google",
    forgot_password = "forgot_password",

    event_view = "event_view",
    event_edit = "event_edit",
    event_frontpage_edit = "event_frontpage_edit",
    event_create = "event_create",
    event_delete = "event_delete",

    event_segment_create = "event_segment_create",
    event_segment_edit = "event_segment_edit",
    event_segment_delete = "event_segment_delete",
    event_segment_reorder = "event_segment_reorder",

    wiki_page_view = "wiki_page_view",
    wiki_edit = "wiki_edit",
    wiki_change_visibility = "wiki_change_visibility",

    frontpagegallery_reorder = "frontpagegallery_reorder",
    frontpagegallery_item_create = "frontpagegallery_item_create",
    frontpagegallery_item_edit = "frontpagegallery_item_edit",
    frontpagegallery_item_delete = "frontpagegallery_item_delete",
    frontpagegallery_item_change_visibility = "frontpagegallery_item_change_visibility",

    file_download = "file_download",
    file_upload = "file_upload",
    file_upload_url = "file_upload_url",
    file_edit = "file_edit",
    file_delete = "file_delete",

    song_view = "song_view",
    song_edit = "song_edit",
    song_edit_description = "song_edit_description",
    song_delete = "song_delete",
    song_create = "song_create",
    song_credit_add = "song_credit_add",
    song_credit_edit = "song_credit_edit",
    song_credit_delete = "song_credit_delete",
    song_pin_recording = "song_pin_recording",

    setlist_plan_create = "setlist_plan_create",
    setlist_plan_save = "setlist_plan_save",
    setlist_plan_delete = "setlist_plan_delete",

    setlist_create = "setlist_create",
    setlist_edit = "setlist_edit",
    setlist_delete = "setlist_delete",
    setlist_reorder = "setlist_reorder",
};

export enum DeviceClasses {
    phone = "phone",
    tablet = "tablet",
    desktop = "desktop",
}

export const DeviceClassIconMap: Record<DeviceClasses, string> = {
    [DeviceClasses.phone]: "/images/icons/mobile.svg",
    [DeviceClasses.tablet]: "/images/icons/tablet.svg",
    [DeviceClasses.desktop]: "/images/icons/desktop.svg",
};

export enum PointerTypes {
    touch = "touch",
    cursor = "cursor",
}

export const PointerTypeIconMap: Record<PointerTypes, string> = {
    [PointerTypes.touch]: "/images/icons/touch.svg",
    [PointerTypes.cursor]: "/images/icons/mouse.svg",
};

export enum Browsers {
    safari = "safari",
    firefox = "firefox",
    chrome = "chrome",
    edge = "edge",
    opera = "opera",
    brave = "brave",
    ie = "ie",
}

export const BrowserIconMap: Record<Browsers, string> = {
    // from https://iconduck.com
    [Browsers.safari]: "/images/icons/safari-ios.svg",
    [Browsers.firefox]: "/images/icons/firefox.svg",
    [Browsers.chrome]: "/images/icons/chrome.svg",
    [Browsers.edge]: "/images/icons/edge.svg",
    [Browsers.opera]: "/images/icons/opera.svg",
    [Browsers.brave]: "/images/icons/brave.svg",
    [Browsers.ie]: "/images/icons/internet-explorer-9.svg",
}

export enum OperatingSystem {
    windows = "windows",
    macos = "macos",
    linux = "linux",
    android = "android",
    ios = "ios",
    chromeos = "chromeos",
};

export const OSIconMap: Record<OperatingSystem, string> = {
    windows: "/images/icons/windows-legacy.svg",
    macos: "/images/icons/macos.svg",
    chromeos: "/images/icons/chrome.svg",
    ios: "/images/icons/ios.svg",
    linux: "/images/icons/linux.svg",
    android: "/images/icons/android.svg",
};

export function detectOS(): OperatingSystem | undefined {
    const uaData = (navigator as any).userAgentData;
    const platform = uaData?.platform || navigator.platform || navigator.userAgent;

    if (/Win/i.test(platform)) return OperatingSystem.windows;
    if (/Mac/i.test(platform) && !/iPhone|iPad|iPod/i.test(platform)) return OperatingSystem.macos;
    if (/Linux/i.test(platform)) return OperatingSystem.linux;
    if (/Android/i.test(platform)) return OperatingSystem.android;
    if (/CrOS/i.test(platform)) return OperatingSystem.chromeos;
    if (/iPhone|iPad|iPod/i.test(platform)) return OperatingSystem.ios;

    return undefined;
}


export const ZDeviceInfo = z.object({
    //pointer: z.enum(['touch', 'cursor']).optional(),
    pointer: z.nativeEnum(PointerTypes).optional(), // touch or cursor
    screenWidth: z.number().optional(),
    screenHeight: z.number().optional(),

    //deviceClass: z.enum(['phone', 'tablet', 'desktop']).optional(),
    deviceClass: z.nativeEnum(DeviceClasses).optional(), // phone, tablet, or desktop

    //browser: z.enum(['safari', 'firefox', 'chrome', 'edge', 'opera', 'brave', 'ie']).optional(),
    browser: z.nativeEnum(Browsers).optional(), // safari, firefox, chrome, edge, opera, brave, ie

    operatingSystem: z.string().optional(), // e.g. "windows", "macos", "linux", "android", "ios"
    language: z.string().optional(), // the 2-letter language code, e.g. 'en', 'de', 'fr', etc.
    locale: z.string().optional(), // lowercase, e.g. "en-us", "de-de", etc.
    timezone: z.string().optional(), // lowercase; e.g. "europe/berlin", "america/new_york", etc.
});

export type DeviceInfo = z.infer<typeof ZDeviceInfo>;

/**
 * Collect the device information client-side.
 * Call inside useEffect(() => { … }, []) so it never runs on the server.
 */
export async function collectDeviceInfo(): Promise<DeviceInfo> {
    const info: DeviceInfo = {};

    /* -------- pointer -------------------------------------------------------- */
    // Media-queries describe input **capabilities** very reliably.
    if (matchMedia('(pointer: coarse)').matches) {
        info.pointer = PointerTypes.touch;
    } else if (matchMedia('(pointer: fine)').matches) {
        info.pointer = PointerTypes.cursor;
    }
    /* pointer/any-pointer are specced keywords: coarse = touch, fine = mouse :contentReference[oaicite:0]{index=0} */

    info.screenHeight = window.screen.height;
    info.screenWidth = window.screen.width;

    /* -------- device class --------------------------------------------------- */
    const uaData = (navigator as any).userAgentData as /*NavigatorUAData*/ any | undefined;
    if (uaData?.mobile) {
        // Use viewport size to split phone ↔ tablet
        const maxDim = Math.max(window.screen.width, window.screen.height);
        info.deviceClass = maxDim >= 768 ? DeviceClasses.tablet : DeviceClasses.phone;
    } else {
        info.deviceClass = DeviceClasses.desktop;
    }

    info.browser = detectBrowser(uaData);
    info.operatingSystem = detectOS();
    // info.operatingSystem = uaData?.platform || navigator.platform || undefined;
    // if (info.operatingSystem) {
    //     info.operatingSystem = info.operatingSystem.toLowerCase();
    // }

    info.language = navigator.language.split("-")[0] || undefined;
    if (info.language) {
        info.language = info.language.toLowerCase();
    }

    info.locale = navigator.language || undefined;
    if (info.locale) {
        info.locale = info.locale.toLowerCase();
    }

    info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    if (info.timezone) {
        info.timezone = info.timezone.toLowerCase();
    }

    return info;
}

/* -------------------------------------------------------------------------- */
/* 2) normalise UA-CH / UA-string into that type                                 */
function detectBrowser(uaData?: /* NavigatorUAData */ any): DeviceInfo['browser'] {
    /* ---- A. UA-CH branch ---------------------------------------------------- */
    /*  (Brave & Edge really do expose their own brand token in modern Chromium) */
    /*      see table lines 11-13 here …                                        */
    /*      Brave“Brave”;v=”124″, “Chromium”;v=”124″✅                          */
    /*      Edge “Microsoft Edge”;v=”124″, “Chromium”;v=”124″✅                 */
    /*      Opera“Opera”…                                                      */
    const brandMap: Record<string, DeviceInfo['browser']> = {
        'Microsoft Edge': Browsers.edge,
        'Opera': Browsers.opera,
        'Brave': Browsers.brave,
        'Firefox': Browsers.firefox,
        'Safari': Browsers.safari,
        'Chromium': Browsers.chrome,
        'Google Chrome': Browsers.chrome,
    };

    if (uaData?.brands?.length) {
        for (const { brand } of uaData.brands) {
            const canonical = brandMap[brand];
            if (canonical) return canonical;
        }
    }

    /* ---- B. Fallback: sniff the legacy user-agent string -------------------- */
    const ua = navigator.userAgent;

    /*  order matters – match the most specific first */
    if (/Edg/i.test(ua)) return Browsers.edge;
    if (/OPR|Opera/i.test(ua)) return Browsers.opera;

    /* Brave: two signals – “Brave” in UA (desktop) or the `navigator.brave` hook */
    if (/Brave/i.test(ua) ||
        (typeof navigator === 'object' && (navigator as any).brave)) return Browsers.brave;

    if (/Firefox/i.test(ua)) return Browsers.firefox;

    /* IE 6-10 → “MSIE”, IE11 → “Trident/… rv:11.0”  */  // Example UA strings: turn2search0
    if (/MSIE |Trident\//i.test(ua)) return Browsers.ie;

    /* Safari must come *after* the Chromium-based checks                       */
    if (/Safari/i.test(ua) &&
        !/Chrome|Chromium|Brave|Edg|OPR/i.test(ua)) return Browsers.safari;

    return Browsers.chrome;  // default
}

export const ZTRecordActionArgs = z.object({
    uri: z.string().optional(), // for server side this may not be available.
    userId: z.number().optional(), // optional for client-side actions
    feature: z.nativeEnum(ActivityFeature),
    context: z.string().optional(),
    deviceInfo: ZDeviceInfo.optional(),

    queryText: z.string().optional(),

    eventId: z.number().optional(),
    fileId: z.number().optional(),
    songId: z.number().optional(),
    wikiPageId: z.number().optional(),
    attendanceId: z.number().optional(),
    eventSegmentId: z.number().optional(),
    customLinkId: z.number().optional(),
    eventSongListId: z.number().optional(),
    frontpageGalleryItemId: z.number().optional(),
    menuLinkId: z.number().optional(),
    setlistPlanId: z.number().optional(),
    songCreditTypeId: z.number().optional(),
    instrumentId: z.number().optional(),
});

export type ActivityFeatureAssociations = {
    queryText?: string;

    eventId?: number;
    fileId?: number;
    songId?: number;
    wikiPageId?: number;
    attendanceId?: number;
    eventSegmentId?: number;

    customLinkId?: number;
    eventSongListId?: number;
    frontpageGalleryItemId?: number;
    menuLinkId?: number;
    setlistPlanId?: number;
    songCreditTypeId?: number;
    instrumentId?: number;
};

export type ClientActivityParams = ActivityFeatureAssociations & {
    feature: ActivityFeature;
    context?: string | undefined | null; // sometimes you have a feature recording in a control that has an app context marker; that would miss the context; this allows callers to sorta fake it.
};

export type UseFeatureUseClientActivityParams = ClientActivityParams;
