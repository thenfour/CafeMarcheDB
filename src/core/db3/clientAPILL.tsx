// stuff that clientAPI uses which doesn't require DB3ClientBasicFields to avoid a dependency cycle.

import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";

export const getAbsoluteUrl = (slug: string): string => {
    return `${window.location.origin}${slug}`;
}


export const getURIForEvent = (eventOrEventIdOrSlug: number | string | db3.EventPayloadMinimum, tabSlug?: string) => {
    const tabPart = IsNullOrWhitespace(tabSlug) ? "" : `/${tabSlug}`;

    if (typeof eventOrEventIdOrSlug === 'object') {
        if (eventOrEventIdOrSlug.slug) {
            return getAbsoluteUrl(`/backstage/event/${eventOrEventIdOrSlug.slug}${tabPart}`);
        }
    }
    return getAbsoluteUrl(`/backstage/event/${eventOrEventIdOrSlug}${tabPart}`);
};


export const getURIForSong = (objOrIdOrSlug: number | string | db3.SongPayloadMinimum, tabSlug?: string) => {
    const tabPart = IsNullOrWhitespace(tabSlug) ? "" : `/${tabSlug}`;

    if (typeof objOrIdOrSlug === 'object') {
        if (objOrIdOrSlug.slug) {
            return getAbsoluteUrl(`/backstage/song/${objOrIdOrSlug.slug}${tabPart}`);
        }
    }
    return getAbsoluteUrl(`/backstage/song/${objOrIdOrSlug}${tabPart}`);
};
