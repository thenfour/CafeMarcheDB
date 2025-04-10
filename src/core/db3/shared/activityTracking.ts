
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
};

// activity tracking for feature usage
export type ClientActivityParams = {
    feature: ActivityFeature;

    // eventId?: number;
    // fileId?: number;
    // songId?: number;
    // wikiPageId?: number;
    // queryText?: string;

    eventId?: never;
    fileId?: never;
    songId?: never;
    wikiPageId?: never;
    queryText?: never;


    // context is derived from the current stack of AppContextMarkers.
    context?: never;
};


// activity tracking for feature usage
export type UseFeatureUseClientActivityParams = {
    feature: ActivityFeature;

    eventId?: number;
    fileId?: number;
    songId?: number;
    wikiPageId?: number;
    queryText?: string;

    // context is derived from the current stack of AppContextMarkers.
    context?: never;
};

