import { z } from "zod";

export enum ActivityFeature {
    global_ical_digest = "global_ical_digest",
    event_ical_digest = "event_ical_digest",
    song_view = "song_view",
    event_view = "event_view",
    file_download = "file_download",
    metronome_persistent = "metronome_persistent", // metronome playing longer than 1 minute
    // note that link clicks are not 100% reliable;
    // for example right-clicking a link and opening in a new tab will not trigger this event.
    main_search_link_click = "main_search_link_click",
    song_search_link_click = "song_search_link_click",
    event_search_link_click = "event_search_link_click",
    relevant_event_link_click = "relevant_event_link_click",
    big_calendar_event_link_click = "big_calendar_event_link_click",
    setlist_song_link_click = "setlist_song_link_click",
    dashboard_menu_link_click = "dashboard_menu_link_click",
    general_link_click = "general_link_click",
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
};

export const ZTRecordActionArgs = z.object({
    uri: z.string().optional(), // for server side this may not be available.
    userId: z.number().optional(), // optional for client-side actions
    feature: z.nativeEnum(ActivityFeature),
    context: z.string().optional(),

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
