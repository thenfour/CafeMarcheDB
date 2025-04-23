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

    setlist_plan_create = "setlist_plan_create",
    setlist_plan_save = "setlist_plan_save",
    setlist_plan_delete = "setlist_plan_delete",

    setlist_create = "setlist_create",
    setlist_edit = "setlist_edit",
    setlist_delete = "setlist_delete",
    setlist_reorder = "setlist_reorder",
};


export const ZDeviceInfo = z.object({
    pointer: z.enum(['touch', 'cursor']).optional(),
    screenInfo: z.object({
        width: z.number(),
        height: z.number(),
    }).optional(),
    deviceClass: z.enum(['phone', 'tablet', 'desktop']).optional(),
    browser: z.enum(['safari', 'firefox', 'chrome', 'edge', 'opera']).optional(),
});

export type DeviceInfo = z.infer<typeof ZDeviceInfo>;

// export type DeviceInfo = {
//     pointer?: 'touch' | 'cursor';
//     screenInfo?: { width: number; height: number };
//     deviceClass?: 'phone' | 'tablet' | 'desktop';
//     browser?: 'safari' | 'firefox' | 'chrome' | 'edge' | 'opera';
// };

/**
 * Collect the device information client-side.
 * Call inside useEffect(() => { … }, []) so it never runs on the server.
 */
export async function collectDeviceInfo(): Promise<DeviceInfo> {
    const info: DeviceInfo = {};

    /* -------- pointer -------------------------------------------------------- */
    // Media-queries describe input **capabilities** very reliably.
    if (matchMedia('(pointer: coarse)').matches) {
        info.pointer = 'touch';
    } else if (matchMedia('(pointer: fine)').matches) {
        info.pointer = 'cursor';
    }
    /* pointer/any-pointer are specced keywords: coarse = touch, fine = mouse :contentReference[oaicite:0]{index=0} */

    /* -------- screen resolution --------------------------------------------- */
    info.screenInfo = {
        width: window.screen.width,
        height: window.screen.height,
    };

    /* -------- device class --------------------------------------------------- */
    const uaData = (navigator as any).userAgentData as /*NavigatorUAData*/ any | undefined;
    if (uaData?.mobile) {
        // Use viewport size to split phone ↔ tablet
        const maxDim = Math.max(info.screenInfo.width, info.screenInfo.height);
        info.deviceClass = maxDim >= 768 ? 'tablet' : 'phone';
    } else {
        info.deviceClass = 'desktop';
    }

    /* -------- browser -------------------------------------------------------- */
    info.browser = detectBrowser(uaData);

    return info;
}

/* -------------------------------------------------------------------------- */
/* Helper: normalise UA-CH / UA-string into your union type                   */
function detectBrowser(uaData?: /*NavigatorUAData*/ any): DeviceInfo['browser'] {
    /** Brand token → canonical name map (order matters) */
    const map: Record<string, DeviceInfo['browser']> = {
        'Microsoft Edge': 'edge',
        'Opera': 'opera',
        'Firefox': 'firefox',
        'Safari': 'safari',
        'Chromium': 'chrome',
        'Google Chrome': 'chrome',
    };

    // 1) Modern way: User-Agent Client Hints
    if (uaData?.brands?.length) {
        for (const { brand } of uaData.brands) {
            const canonical = map[brand];
            if (canonical) return canonical;
        }
    }

    // 2) Fallback: legacy userAgent parsing
    const ua = navigator.userAgent;
    if (/Edg/i.test(ua)) return 'edge';
    if (/OPR|Opera/i.test(ua)) return 'opera';
    if (/Firefox/i.test(ua)) return 'firefox';
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'safari';
    return 'chrome';
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
