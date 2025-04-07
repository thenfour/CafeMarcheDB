
export enum ActivityFeature {
    global_ical_digest = "global_ical_digest",
    event_ical_digest = "event_ical_digest",
    wiki_page_view = "wiki_page_view",
    song_view = "song_view",
    event_view = "event_view",
    file_download = "file_download",
    // adding to this, consider seeding.
    //public_homepage_view = "public_homepage_view", <-- for this use something like ga

};

// activity tracking for feature usage
export type ClientActivityParams = {
    feature: ActivityFeature;

    eventId?: number;
    fileId?: number;
    songId?: number;
    wikiPageId?: number;
};

