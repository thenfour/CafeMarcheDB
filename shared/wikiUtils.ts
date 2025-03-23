import db, { Prisma } from "db";
import { slugify } from "./rootroot";
import { z } from "zod";
import { AuxUserArgs } from "types";

export const enum SpecialWikiNamespace {
    EventDescription = "EventDescription",
};

const ZWikiSlug = z.string().min(1).transform((str) => str.toLowerCase().trim());
const ZWikiName = z.string().min(1);

export interface TGetWikiPageArgs {
    slug: string;
};

export interface TUpdateWikiPageArgs {
    slug: string;
    content: string;
    name: string;
    visiblePermissionId: number | null;
};

export const ZTUpdateWikiPageArgs = z.object({
    slug: ZWikiSlug,
    name: ZWikiName,
    content: z.string(),
    visiblePermissionId: z.number().nullable(),
});





export const WikiPageRevisionArgs = Prisma.validator<Prisma.WikiPageRevisionDefaultArgs>()({
    select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        createdByUserId: true,
        createdByUser: AuxUserArgs,
        wikiPageId: true,
    },
});


export type WikiPageRevisionInfo = Prisma.WikiPageRevisionGetPayload<typeof WikiPageRevisionArgs>;

export const WikiPageArgs = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        slug: true,
        id: true,
        visiblePermissionId: true,
    },
});

export type WikiPageRecordInfo = Prisma.WikiPageGetPayload<typeof WikiPageArgs>;

export const WikiPageArgsWithLatestRevision = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        ...WikiPageArgs.select,
        revisions: { // take only the 1st most recent revision
            take: 1,
            orderBy: {
                createdAt: 'desc'
            },
            ...WikiPageRevisionArgs,
        },
    },
});

//export type WikiPageRecordInfoWithLatestRevision = Prisma.WikiPageGetPayload<typeof WikiPageArgs>;

export const WikiPageEventContextArgs = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        name: true,
        id: true,
        typeId: true,
        statusId: true,
        uid: true,
        startsAt: true,
        endDateTime: true,
        isAllDay: true,
        durationMillis: true,
        segmentBehavior: true,
        segments: {
            select: {
                id: true,
                name: true,
                statusId: true,
                uid: true,
                startsAt: true,
                isAllDay: true,
                durationMillis: true,
            }
        }
    }
});

export type WikiPageEventContext = Prisma.EventGetPayload<typeof WikiPageEventContextArgs>;


// Wiki URIs look like:
// http://localhost:10455/backstage/wiki/EventDescription/542/the-big-festival
// * All wiki pages are under /backstage/wiki/ (the wiki root)
// * The "canonical wiki path" is the path recognized relative to the wiki root to fetch the right page. In this case, "EventDescription/542"
// wiki paths are not case-sensitive.

export type WikiPath = {
    namespace: string | null,
    slug: string, // without namespace
    aestheticSlug: string | null; // valid if the slug has an aesthetic slug after it, like /wiki/event/123/the-big-festival
    canonicalWikiPath: string; // combined slug + namespace
    uriRelativeToHost: string;
}


export type WikiPageData = {
    eventContext: WikiPageEventContext | null,
    wikiPage: WikiPageRecordInfo;
    latestRevision: WikiPageRevisionInfo;
    titleIsEditable: boolean;
    specialWikiNamespace: SpecialWikiNamespace | null;
    isExisting: boolean;
}





// used by the wiki page to convert path part params to wiki data.
export const wikiParsePathComponents = (components: string[]): WikiPath => {
    if (!components || components.length < 1) throw new Error(`no page specified`);
    // components is an array of path parts (/event/whatever/something = ['event', 'whatever', 'something'])
    // for nested pages, the 1st part of the path is considered a kind of "namespace", and the 2nd part is the actual slug.
    // whatever is AFTER the page slug is ignored (to accommodate aesthetic links like /wiki/event/123/the-big-festival)
    //
    // there could be confusion if you have an aesthitic slug after a top-level page, like /mypage/this-is-a-slug-to-be-ignored.
    // in that case, we'd parse it as namespace: mypage, and wiki slug "this-is-a-slug".
    //
    // in other words, only pages under namespaces can have aesthetic slugs.
    let namespace: string | null;
    let slug: string;

    if (components.length > 1) {
        namespace = components[0]!;
        slug = components[1]!;
    } else {
        namespace = null;
        slug = components[0]!;
    }

    const canonicalWikiPath = `${namespace ? `${namespace}/` : ''}${slug}`; // like "event/123" or "top-level-thing"
    const aestheticSlug = components.length > 2 ? components.slice(2).join('/') : null;

    return {
        namespace,
        slug,
        canonicalWikiPath,
        uriRelativeToHost: `/backstage/wiki/${canonicalWikiPath}`,
        aestheticSlug,
    }
};

export const wikiMakeRelativeURI = (canonicalWikiPath: string, aestheticSlug?: string | undefined) => {
    return `/backstage/wiki/${canonicalWikiPath}${aestheticSlug ? `/${slugify(aestheticSlug)}` : ''}`;
};

// returns a canonical wiki path from event.
export const wikiMakeWikiPathFromEventDescription = (event: Prisma.EventGetPayload<{ select: { name: true, id: true } }>): WikiPath => {
    const canonicalWikiPath = `EventDescription/${event.id}`;
    const aestheticSlug = slugify(event.name);
    return {
        namespace: "EventDescription",
        slug: `${event.id}`,
        canonicalWikiPath,
        aestheticSlug,
        uriRelativeToHost: wikiMakeRelativeURI(canonicalWikiPath),
    };
}

// parses the "slug" database column which is really the canonicalWikiPath.
export const wikiParseCanonicalWikiPath = (slug: string): WikiPath => {
    const parts = slug.split('/');
    return wikiParsePathComponents(parts);
};

