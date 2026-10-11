import { Prisma } from "db";
import { diffChars, diffLines } from 'diff';
import { z } from "zod";
import { isPublicId, type BandPublicId, type EventPublicId, type PermissionPublicId, type UserPublicId, type WikiPagePublicId, type WikiPageRevisionPublicId } from "shared/publicId";
import { slugify } from "../../../../shared/rootroot";
import type { EventWikiPageContextDto } from "../../db3/shared/entities/event/eventViews";
import type { WikiPageApiDto } from "../../db3/shared/entities/wiki/wikiViews";
import * as db3 from "../../db3/db3";


export const enum SpecialWikiNamespace {
    EventDescription = "EventDescription",
};

// Returns file tag context for uploads based on wiki namespace/slug
export function getFileUploadContext(wikiPageId: WikiPagePublicId | undefined, wikiPath: WikiPath): {
    taggedEventId: EventPublicId | undefined;
    taggedWikiPageId: WikiPagePublicId | undefined;
    // Add more tags as needed for other namespaces
} {
    if (wikiPath.namespace === SpecialWikiNamespace.EventDescription) {
        if (isPublicId(wikiPath.slugWithoutNamespace)) {
            return {
                taggedWikiPageId: wikiPageId,
                taggedEventId: db3.xEvent.parseIdentity(wikiPath.slugWithoutNamespace),
            };
        }
    }
    return {
        taggedWikiPageId: wikiPageId,
        taggedEventId: undefined,
    };
}
// Activity and successful saves renew the lease; presence does not revoke it.
export const gWikiPageLockDurationSeconds = 15 * 60; // 15 minutes
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

export type WikiPageApiPayload = WikiPageApiDto;

////////////////////////////////////////////////////////////////
export type WikiPageApiUpdatePayload = Prisma.WikiPageRevisionGetPayload<{
    select: {
        name: true,
        content: true,
    }
}>;


////////////////////////////////////////////////////////////////
const normalizeCanonicalWikiPath = (value: string): string => {
    const trimmed = value.trim();
    const [namespace, slug] = trimmed.split('/');
    if (namespace?.toLowerCase() === SpecialWikiNamespace.EventDescription.toLowerCase()
        && isPublicId(slug)) {
        // Event public IDs are case-sensitive, so the canonical wiki path must preserve them.
        return `${SpecialWikiNamespace.EventDescription}/${slug}`;
    }
    return trimmed.toLowerCase();
};

const ZWikiSlug = z.string().min(1).transform(normalizeCanonicalWikiPath);
const ZWikiTitle = z.string().min(1);
export const ZWikiBand = z.custom<BandPublicId>(isPublicId);

export const ZTGetUserWikiContributionsArgs = z.object({
    userId: db3.xUser.identitySchema,
    bandPublicId: ZWikiBand,
}).strict();
export type GetUserWikiContributionsInputType = z.infer<typeof ZTGetUserWikiContributionsArgs>;

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
    baseContentVersion: z.number().int().nonnegative(),
    baseRevisionId: db3.xWikiPageRevision.identitySchema.nullable(), // used to return updateability status.
    lockId: z.string().nullable(), // used to return updateability status
}).strict();

export type TGetWikiPageArgs = z.infer<typeof ZTGetWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageRevisionsArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
}).strict();

export type TGetWikiPageRevisionsArgs = z.infer<typeof ZTGetWikiPageRevisionsArgs>;

////////////////////////////////////////////////////////////////
export const ZTGetWikiPageRevisionArgs = z.object({
    bandPublicId: ZWikiBand,
    revisionId: db3.xWikiPageRevision.identitySchema.nullable(), // if null, returns null.
}).strict();

export type TGetWikiPageRevisionArgs = z.infer<typeof ZTGetWikiPageRevisionArgs>;

////////////////////////////////////////////////////////////////
export const ZTSetWikiPageVisibilityArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
    visiblePermissionId: z.custom<PermissionPublicId>(isPublicId).nullable(),
}).strict();

export type TSetWikiPageVisibilityArgs = z.infer<typeof ZTSetWikiPageVisibilityArgs>;

////////////////////////////////////////////////////////////////
export const ZTUpdateWikiPageArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
    title: ZWikiTitle,
    content: z.string(),
    baseContentVersion: z.number().int().nonnegative(),
    baseRevisionId: db3.xWikiPageRevision.identitySchema.nullable(),
    lockId: z.string().nullable(), // you should always have a lock, but some weird cases like admin forcibly removing locks may cancel them.
}).strict();

export type TUpdateWikiPageArgs = z.infer<typeof ZTUpdateWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTAcquireLockOnWikiPageArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
    baseContentVersion: z.number().int().nonnegative(),
    baseRevisionId: db3.xWikiPageRevision.identitySchema.nullable(),
    lockId: z.string().min(1),
    takeOverLockId: z.string().optional(),
}).strict();
export type TAcquireLockOnWikiPageArgs = z.infer<typeof ZTAcquireLockOnWikiPageArgs>;

////////////////////////////////////////////////////////////////
export const ZTWikiReleaseYourLockArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
    lockId: z.string(),
}).strict();
export type TWikiReleaseYourLockArgs = z.infer<typeof ZTWikiReleaseYourLockArgs>;


////////////////////////////////////////////////////////////////
export const ZTAdminClearPageLockArgs = z.object({
    bandPublicId: ZWikiBand,
    canonicalWikiPath: ZWikiSlug,
}).strict();
export type TAdminClearPageLockArgs = z.infer<typeof ZTAdminClearPageLockArgs>;

// Wiki URIs look like:
// http://localhost:10455/backstage/wiki/EventDescription/AbCdEf0123456789/the-big-festival
// * All wiki pages are under /backstage/wiki/ (the wiki root)
// * The "canonical wiki path" is the path recognized relative to the wiki root to fetch the right page.
// wiki paths are not case-sensitive.

export type WikiPath = {
    namespace: string | null,
    slugWithoutNamespace: string, // without namespace
    aestheticSlug: string | null; // valid if the slug has an aesthetic slug after it, like /wiki/event/123/the-big-festival
    canonicalWikiPath: string; // combined slug + namespace
    uriRelativeToHost: string;
}


export type WikiPageData = {
    eventContext: EventWikiPageContextDto | null,
    wikiPage: WikiPageApiPayload | null; // new pages = null
    titleIsEditable: boolean;
    specialWikiNamespace: SpecialWikiNamespace | null;
    isExisting: boolean;
    lockStatus: GetWikiPageUpdatabilityResult;
}





// used by the wiki page to convert path part params to wiki data.
export const wikiParsePathComponents = (components: readonly string[]): WikiPath => {
    const [first, second] = components;
    if (first === undefined) {
        throw new Error("no page specified");
    }

    // Namespaced pages use namespace/page; any remaining text is an aesthetic name.
    const namespaceInput = second === undefined ? null : first;
    const slugInput = second ?? first;
    const isEventDescription = namespaceInput?.toLowerCase() === SpecialWikiNamespace.EventDescription.toLowerCase()
        && isPublicId(slugInput);
    const namespace = isEventDescription ? SpecialWikiNamespace.EventDescription
        : namespaceInput === null ? null : slugify(namespaceInput);
    // Event public IDs are references, so preserve their case and underscores.
    const slugWithoutNamespace = isEventDescription ? slugInput : slugify(slugInput);
    const canonicalWikiPath = namespace === null ? slugWithoutNamespace : `${namespace}/${slugWithoutNamespace}`;
    const aestheticSlug = components.length > 2 ? slugify(components.slice(2).join(' ')) : null;

    return {
        namespace,
        slugWithoutNamespace,
        canonicalWikiPath,
        uriRelativeToHost: `/backstage/wiki/${canonicalWikiPath}`,
        aestheticSlug,
    }
};

export const wikiMakeRelativeURI = (canonicalWikiPath: string, aestheticSlug?: string | undefined) => {
    const wikiPath = wikiParseCanonicalWikiPath(canonicalWikiPath);
    return `${wikiPath.uriRelativeToHost}${aestheticSlug ? `/${slugify(aestheticSlug)}` : ''}`;
};

// returns a canonical wiki path from event.
export const wikiMakeWikiPathFromEventDescription = (event: { publicId: EventPublicId; name: string }): WikiPath => {
    const canonicalWikiPath = `${SpecialWikiNamespace.EventDescription}/${event.publicId}`;
    const aestheticSlug = slugify(event.name);
    return {
        namespace: SpecialWikiNamespace.EventDescription,
        slugWithoutNamespace: event.publicId,
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





export enum UpdateWikiPageResultOutcome {
    success = "success",
    lockConflict = "lockConflict",
    revisionConflict = "revisionConflict",
};

type GetWikiPageLockStatusArgs = {
    currentPage: WikiPageApiPayload | null;
    currentUserPublicId: UserPublicId | null;
    userClientLockId: string | null;
    baseRevisionId: WikiPageRevisionPublicId | null;
    baseContentVersion: number;
}

export type GetWikiPageUpdatabilityResult = {
    isLocked: boolean;
    isLockExpired: boolean;
    isLockConflict: boolean;
    isLockedInThisContext: boolean;
    isRevisionConflict: boolean;
    outcome: UpdateWikiPageResultOutcome;

    lockExpiresAt: Date | null;
    lockId: string | null;

    currentPage: WikiPageApiPayload | null;
};

export const GetWikiPageUpdatability = ({ currentPage, currentUserPublicId, userClientLockId, baseRevisionId, baseContentVersion }: GetWikiPageLockStatusArgs): GetWikiPageUpdatabilityResult => {
    if (!currentPage || !currentUserPublicId) {
        const isRevisionConflict = baseRevisionId !== null || baseContentVersion !== 0;
        return {
            isLocked: false,
            isLockExpired: false,
            isLockConflict: false,
            isLockedInThisContext: false,
            isRevisionConflict,
            lockId: userClientLockId,
            outcome: isRevisionConflict ? UpdateWikiPageResultOutcome.revisionConflict : UpdateWikiPageResultOutcome.success,

            lockExpiresAt: null,
            currentPage: null,
        };
    }

    const isLockExpired = currentPage.lockExpiresAt != null && currentPage.lockExpiresAt <= new Date();
    const isLocked = currentPage.lockId != null && currentPage.lockExpiresAt != null && !isLockExpired;
    const isLockedInThisContext = isLocked && currentPage.lockedByUser?.publicId === currentUserPublicId && currentPage.lockId === userClientLockId;
    const isRevisionCompatible = (currentPage.currentRevision?.publicId ?? null) === baseRevisionId && currentPage.contentVersion === baseContentVersion;
    const isLockConflict = isLocked && !isLockedInThisContext;

    return {
        isLocked,
        isLockExpired,
        isLockConflict,
        isLockedInThisContext,
        isRevisionConflict: !isRevisionCompatible,
        outcome: isLockConflict ? UpdateWikiPageResultOutcome.lockConflict : (isRevisionCompatible ? UpdateWikiPageResultOutcome.success : UpdateWikiPageResultOutcome.revisionConflict),
        lockId: userClientLockId,
        lockExpiresAt: currentPage.lockExpiresAt ?? null,
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
