import { z } from "zod";

export enum ActivityFeature {
    global_ical_digest = "global_ical_digest",
    event_ical_digest = "event_ical_digest",
    wiki_page_view = "wiki_page_view",
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

    // * [ ] change customlink
    // * [ ] create / update event / segment
    // * [ ] create / update setlist
    // * [ ] login
    // * [ ] create account
    // * [ ] upload file
    // * [ ] change file
    // * [ ] frontpage gallery item
    // * [ ] frontpage agenda
    // * [ ] create / update menulink
    // * [ ] create / update song
    // * [ ] create / update song credit
    // * [ ] change profile info
    // * [ ] create / update wiki page
    // * [ ] create / update setlistplan
};

export const ZTRecordActionArgs = z.object({
    uri: z.string(),
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

// export function CoalesceActivityFeatureAssociations<T, U>(
//     a: T,
//     b: U,
// ): T & U {
//     return { ...a, ...b };
// };

// activity tracking for feature usage
export type ClientActivityParams = ActivityFeatureAssociations & {
    feature: ActivityFeature;
};
//     // eventId?: number;
//     // fileId?: number;
//     // songId?: number;
//     // wikiPageId?: number;
//     // queryText?: string;
//     // attendanceId?: number;
//     // eventSegmentId?: number;

//     // customLinkId?: number;
//     // eventSongListId?: number;
//     // frontpageGalleryItemId?: number;
//     // menuLinkId?: number;
//     // setlistPlanId?: number;
//     // songCreditTypeId?: number;
//     // instrumentId?: number;

//     // context is derived from the current stack of AppContextMarkers.
//     context?: never;
// };


// activity tracking for feature usage
export type UseFeatureUseClientActivityParams = ClientActivityParams;
// {
//     feature: ActivityFeature;

//     eventId?: number;
//     fileId?: number;
//     songId?: number;
//     wikiPageId?: number;
//     queryText?: string;

//     // context is derived from the current stack of AppContextMarkers.
//     context?: never;
// };

