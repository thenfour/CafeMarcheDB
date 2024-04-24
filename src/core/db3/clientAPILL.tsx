// stuff that clientAPI uses which doesn't require DB3ClientBasicFields to avoid a dependency cycle.

import { IsNullOrWhitespace } from "shared/utils";

export const getAbsoluteUrl = (slug: string): string => {
    if (!slug.startsWith('/')) {
        slug = '/' + slug;
    }
    return `${window.location.origin}${encodeURI(slug)}`;
}


export const getURIForEvent = (eventId: number | string, eventSlug?: string, tabSlug?: string) => {
    const parts: string[] = [eventId.toString()];
    if (!IsNullOrWhitespace(eventSlug)) parts.push(eventSlug || "");
    if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
    return getAbsoluteUrl(`/backstage/event/${parts.join("/")}`);
};



export const getURIForSong = (songId: number | string, songSlug?: string, tabSlug?: string) => {
    const parts: string[] = [songId.toString()];

    if (!IsNullOrWhitespace(songSlug)) parts.push(songSlug || "");
    if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
    return getAbsoluteUrl(`/backstage/song/${parts.join("/")}`);
};
