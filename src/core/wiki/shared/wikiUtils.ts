// Returns file tag context for uploads based on wiki namespace/slug
export function getFileTagsForNamespace(wikiPath: WikiPath): {
    taggedEventId?: number;
    // Add more tags as needed for other namespaces
} | undefined {
    if (wikiPath.namespace === SpecialWikiNamespace.EventDescription) {
        const eventId = Number(wikiPath.slugWithoutNamespace);
        if (!isNaN(eventId)) {
            return { taggedEventId: eventId };
        }
    }
    return undefined;
}
import { Prisma } from "db";
import { z } from "zod";
import { slugify } from "../../../../shared/rootroot";
import { diffChars, diffLines } from 'diff';

export const enum SpecialWikiNamespace {
    EventDescription = "EventDescription",
};

// lock refreshing is not a perfect science.
// it's tempting to have a kind of auto-renewal, but it defeats the purpose
// of expiration (auto renewal when you forget about a background tab would hold the lock forever).
//
// but on the other hand we wish to detect the scenario where the user innocently navigates away and their lock
// didn't have a chance to release. they come back to the edit the page again and they locked themselves out.
// it's too cumbersome to track that scenario; stick with the lock expiration and manual refresh (like dokuwiki)
// and in the "lock yourself out" scenario, make an exception and just give it up.
export const gWikiPageLockDurationSeconds = 15 * 60; // 15 minutes
export const gWikiEditPingIntervalMilliseconds = 10 * 1000;
export const gWikiEditAbandonedThresholdMilliseconds = 15 * 1000; // this should be longer than the ping interval
export const gWikiLockAutoRenewThrottleInterval = 60 * 1000; // renew at most once every 1 minute

////////////////////////////////////////////////////////////////
export const WikiPageApiRevisionPayloadArgs = Prisma.validator<Prisma.WikiPageRevisionDefaultArgs>()({
    select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        createdByUser: {
            select: {
                id: true,
                name: true,
            }
        },
    },
});
export type WikiPageApiRevisionPayload = Prisma.WikiPageRevisionGetPayload<typeof WikiPageApiRevisionPayloadArgs>;

export const WikiPageApiPayloadArgs = Prisma.validator<Prisma.WikiPageDefaultArgs>()({
    select: {
        slug: true,
        namespace: true,
        visiblePermissionId: true,
        id: true,
        lockId: true,
        lockAcquiredAt: true,
        lockExpiresAt: true,
        lastEditPingAt: true,
        lockedByUser: {
            select: {
                id: true,
                name: true,
            }
        },
        currentRevision: {
            ...WikiPageApiRevisionPayloadArgs,
        }
    }
});
export type WikiPageApiPayload = Prisma.WikiPageGetPayload<typeof WikiPageApiPayloadArgs>;

////////////////////////////////////////////////////////////////
export type WikiPageApiUpdatePayload = Prisma.WikiPageRevisionGetPayload<{
    select: {
        name: true,
        content: true,
    }
}>;


////////////////////////////////////////////////////////////////
const ZWikiSlug = z.string().min(1).transform((str) => str.toLowerCase().trim());
const ZWikiTitle = z.string().min(1);

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
    baseRevisionId: z.number().nullable(), // used to return updateability status.
    lockId: z.string().nullable(), // used to return updateability status
});

export type TGetWikiPageArgs = z.infer<typeof ZTGetWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageRevisionsArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
});

export type TGetWikiPageRevisionsArgs = z.infer<typeof ZTGetWikiPageRevisionsArgs>;

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageRevisionArgs = z.object({
    revisionId: z.number().nullable(), // if null, returns null.
});

export type TGetWikiPageRevisionArgs = z.infer<typeof ZTGetWikiPageRevisionArgs>;

////////////////////////////////////////////////////////////////
export const ZTSetWikiPageVisibilityArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
    visiblePermissionId: z.number().nullable(),
});

export type TSetWikiPageVisibilityArgs = z.infer<typeof ZTSetWikiPageVisibilityArgs>;

////////////////////////////////////////////////////////////////
export const ZTUpdateWikiPageArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
    title: ZWikiTitle,
    content: z.string(),
    baseRevisionId: z.number().nullable(),
    lockId: z.string().nullable(), // you should always have a lock, but some weird cases like admin forcibly removing locks may cancel them.
});

export type TUpdateWikiPageArgs = z.infer<typeof ZTUpdateWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTAcquireLockOnWikiPageArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
    baseRevisionId: z.number().nullable(),
    lockId: z.string(),
});
export type TAcquireLockOnWikiPageArgs = z.infer<typeof ZTAcquireLockOnWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTWikiReleaseYourLockArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
    lockId: z.string(),
});
export type TWikiReleaseYourLockArgs = z.infer<typeof ZTWikiReleaseYourLockArgs>;


////////////////////////////////////////////////////////////////
export const ZTAdminClearPageLockArgs = z.object({
    canonicalWikiPath: ZWikiSlug,
});
export type TAdminClearPageLockArgs = z.infer<typeof ZTAdminClearPageLockArgs>;

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
    slugWithoutNamespace: string, // without namespace
    aestheticSlug: string | null; // valid if the slug has an aesthetic slug after it, like /wiki/event/123/the-big-festival
    canonicalWikiPath: string; // combined slug + namespace
    uriRelativeToHost: string;
}


export type WikiPageData = {
    eventContext: WikiPageEventContext | null,
    wikiPage: WikiPageApiPayload | null; // new pages = null
    titleIsEditable: boolean;
    specialWikiNamespace: SpecialWikiNamespace | null;
    isExisting: boolean;
    lockStatus: GetWikiPageUpdatabilityResult;
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

    const canonicalWikiPath = slugify(`${namespace ? `${namespace}/` : ''}${slug}`); // like "event/123" or "top-level-thing"
    const aestheticSlug = components.length > 2 ? components.slice(2).join('/') : null;

    return {
        namespace,
        slugWithoutNamespace: slug,
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
        slugWithoutNamespace: `${event.id}`,
        canonicalWikiPath,
        aestheticSlug,
        uriRelativeToHost: wikiMakeRelativeURI(canonicalWikiPath),
    };
}

// parses the "slug" database column which is really the canonicalWikiPath.
export const wikiParseCanonicalWikiPath = (canonicalWikiPath: string): WikiPath => {
    const parts = canonicalWikiPath.split('/');
    return wikiParsePathComponents(parts);
};


export type WikiNamespacePlugin = (namespace: string, slugWithoutNamespace: string, inp: WikiPageData) => Promise<WikiPageData>;



export enum UpdateWikiPageResultOutcome {
    success = "success",
    lockConflict = "lockConflict",
    revisionConflict = "revisionConflict",
};

type GetWikiPageLockStatusArgs = {
    currentPage: WikiPageApiPayload | null;
    currentUserId: number | null;
    userClientLockId: string | null;
    baseRevisionId: number | null;
}

export type GetWikiPageUpdatabilityResult = {
    isLocked: boolean;
    isLockExpired: boolean;
    //isLockAbandoned: boolean;
    isLockConflict: boolean;
    isLockedInThisContext: boolean;
    isRevisionConflict: boolean;
    outcome: UpdateWikiPageResultOutcome;

    lockExpiresAt: Date | null;
    lockId: string | null;

    currentPage: WikiPageApiPayload | null;
};

export const GetWikiPageUpdatability = ({ currentPage, currentUserId, userClientLockId, baseRevisionId }: GetWikiPageLockStatusArgs): GetWikiPageUpdatabilityResult => {
    if (!currentPage || !currentUserId) {
        // non-existent page
        return {
            isLocked: false,
            isLockExpired: false,
            //isLockAbandoned: false,
            isLockConflict: false,
            isLockedInThisContext: false,
            isRevisionConflict: false,
            lockId: userClientLockId,
            outcome: UpdateWikiPageResultOutcome.success,

            lockExpiresAt: null,
            currentPage: null,
        };
    }

    const isLockExpired = currentPage.lockExpiresAt != null && currentPage.lockExpiresAt < new Date();
    const isLockAbandoned = currentPage.lockId != null && (!!currentPage.lastEditPingAt && (Date.now() - currentPage.lastEditPingAt.valueOf()) > gWikiEditAbandonedThresholdMilliseconds);
    const isLocked = currentPage.lockId != null && !isLockExpired && !isLockAbandoned;
    const isLockedInThisContext = isLocked && currentPage.lockedByUser?.id == currentUserId && currentPage.lockId == userClientLockId;
    const isRevisionCompatible = currentPage.currentRevision?.id == baseRevisionId;
    const isLockConflict = !isLockAbandoned && isLocked && !isLockedInThisContext;

    return {
        isLocked,
        isLockExpired,
        //isLockAbandoned,
        isLockConflict,
        isLockedInThisContext,
        isRevisionConflict: !isRevisionCompatible,
        outcome: isLockConflict ? UpdateWikiPageResultOutcome.lockConflict : (isRevisionCompatible ? UpdateWikiPageResultOutcome.success : UpdateWikiPageResultOutcome.revisionConflict),
        lockId: userClientLockId,
        lockExpiresAt: currentPage.lockExpiresAt,
        currentPage,
    };
};

export interface DiffStats {
    oldSize: number;
    newSize: number;
    sizeDiff: number;
    charsAdded: number;
    charsRemoved: number;

    oldLines: number;
    newLines: number;
    linesAdded: number;
    linesRemoved: number;
}

export function calculateDiff(oldContent: string, newContent: string): DiffStats {
    const ret = {
        oldSize: oldContent.length,
        newSize: newContent.length,
        sizeDiff: newContent.length - oldContent.length,
        oldLines: oldContent.split('\n').length,
        newLines: newContent.split('\n').length,
        linesAdded: 0,
        linesRemoved: 0,
        charsAdded: 0,
        charsRemoved: 0,
    };
    const charDiff = diffChars(oldContent, newContent);
    for (const part of charDiff) {
        if (part.added) {
            ret.charsAdded += part.count || 0;
        }
        if (part.removed) {
            ret.charsRemoved += part.count || 0;
        }
    }
    const lineDiff = diffLines(oldContent, newContent);
    for (const part of lineDiff) {
        if (part.added) {
            ret.linesAdded += part.count || 0;
        }
        if (part.removed) {
            ret.linesRemoved += part.count || 0;
        }
    }
    return ret;
}