// stuff that clientAPI uses which doesn't require DB3ClientBasicFields to avoid a dependency cycle.

import * as db3 from "src/core/db3/db3";

export const getAbsoluteUrl = (slug: string): string => {
    return `${window.location.origin}${slug}`;
}


export const getURIForEvent = (eventOrEventIdOrSlug: number | string | db3.EventPayloadMinimum, tabSlug?: string) => {
    const tabPart = tabSlug ? `/${tabSlug}` : "";

    if (typeof eventOrEventIdOrSlug === 'object') {
        if (eventOrEventIdOrSlug.slug) {
            return getAbsoluteUrl(`/backstage/event/${eventOrEventIdOrSlug.slug}${tabPart}`);
        }
    }
    return getAbsoluteUrl(`/backstage/event/${eventOrEventIdOrSlug}${tabPart}`);
};
