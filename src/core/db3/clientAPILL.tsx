// stuff that clientAPI uses which doesn't require DB3ClientBasicFields to avoid a dependency cycle.

import { Prisma } from "db";
import { slugify } from "shared/rootroot";

import { IsNullOrWhitespace } from "shared/utils";

export const getAbsoluteUrl = (slug: string): string => {
    if (!slug.startsWith('/')) {
        slug = '/' + slug;
    }
    return `${window.location.origin}${encodeURI(slug)}`;
}

export const getURIForEvent = (event: Prisma.EventGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) => {
    const parts: string[] = [event.id.toString()];
    //if (!IsNullOrWhitespace(eventSlug)) parts.push(eventSlug || "");
    parts.push(slugify(event.name));
    if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
    return getAbsoluteUrl(`/backstage/event/${parts.join("/")}`);
};

export const getURIForSong = (song: Prisma.SongGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) => {
    const parts: string[] = [song.id.toString()];
    parts.push(slugify(song.name));
    if (!IsNullOrWhitespace(tabSlug)) parts.push(tabSlug || "");
    return getAbsoluteUrl(`/backstage/song/${parts.join("/")}`);
};

export const getURIForUser = (song: Prisma.UserGetPayload<{ select: { id: true, name: true } }>) => {
    const parts: string[] = [song.id.toString()];
    parts.push(slugify(song.name));
    return getAbsoluteUrl(`/backstage/user/${parts.join("/")}`);
};

// yea this is just for completeness so i don't miss something one day when i actually add an instrument landing page.
export const getURIForInstrument = (instrument: Prisma.InstrumentGetPayload<{ select: { id: true, name: true } }>) => {
    const parts: string[] = [instrument.id.toString()];
    parts.push(slugify(instrument.name));
    return getAbsoluteUrl(`/backstage/instrument/${parts.join("/")}`);
};

export function getURLClass(url: string, baseDomain: string = window.location.hostname): "internalPage" | "internalAPI" | "external" {
    try {
        const parsedUrl = new URL(url, window.location.origin);
        if (parsedUrl.hostname !== baseDomain) {
            return "external";
        }
        if (parsedUrl.pathname.includes('/api/')) {
            return "internalAPI";
        }
        return "internalPage";
    } catch (error) {
        // Handling relative URLs
        if (url.includes('/api/')) {
            return "internalAPI";
        } else if (url.startsWith('http') || url.startsWith('//')) {
            return "external";
        }
        return "internalPage";
    }
}

// export function getFormattedBPM(song: Prisma.SongGetPayload<{ select: { startBPM: true, endBPM: true } }>) {
//     if (!song.startBPM) {
//         if (!song.endBPM) {
//             return "";// neither specified
//         }
//         return `⇢${song.endBPM}`; // only end bpm
//     }
//     if (!song.endBPM) {
//         return `${song.startBPM}⇢`; // only start bpm
//     }
//     if ((song.startBPM | 0) === (song.endBPM | 0)) {
//         return `${song.startBPM}`; // both BPMs the same: just show 1.
//     }
//     return `${song.startBPM}⇢${song.endBPM}`;
// }


export function getFormattedBPM(song: Prisma.SongGetPayload<{ select: { startBPM: true } }>) {
    if (!song.startBPM) {
        return "";
    }
    return `${song.startBPM}`;
}

