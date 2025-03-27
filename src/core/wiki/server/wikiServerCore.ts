

import { gWikiEditAbandonedThresholdMilliseconds, WikiPageApiPayload } from '../shared/wikiUtils';

export enum UpdateWikiPageResultOutcome {
    success = "success",
    lockConflict = "lockConflict",
    revisionConflict = "revisionConflict",
};

type GetWikiPageLockStatusArgs = {
    currentPage: WikiPageApiPayload | null;
    currentUserId: number;
    userClientLockId: string | null;
    baseRevisionId: number | null;
}

export type GetWikiPageUpdatabilityResult = {
    isLocked: boolean;
    isLockConflict: boolean;
    isLockedInThisContext: boolean;
    isRevisionConflict: boolean;
    outcome: UpdateWikiPageResultOutcome;
    lockId: string | null;

    currentPage: WikiPageApiPayload | null;
};

export const GetWikiPageUpdatability = ({ currentPage, currentUserId, userClientLockId, baseRevisionId }: GetWikiPageLockStatusArgs): GetWikiPageUpdatabilityResult => {
    if (!currentPage) {
        // non-existent page
        return {
            isLocked: false,
            isLockConflict: false,
            isLockedInThisContext: false,
            isRevisionConflict: false,
            lockId: userClientLockId,
            outcome: UpdateWikiPageResultOutcome.success,

            currentPage: null,
        };
    }

    const isLocked = currentPage.lockId != null && currentPage.lockExpiresAt != null && currentPage.lockExpiresAt > new Date();
    const isLockedInThisContext = isLocked && currentPage.lockedByUser?.id == currentUserId && currentPage.lockId == userClientLockId;
    const isLockAbandoned = isLocked && (currentPage.lastEditPingAt && (Date.now() - currentPage.lastEditPingAt.valueOf()) > gWikiEditAbandonedThresholdMilliseconds);
    const isRevisionCompatible = currentPage.currentRevision?.id == baseRevisionId;
    const isLockConflict = !isLockAbandoned && isLocked && !isLockedInThisContext;

    return {
        isLocked,
        isLockConflict,
        isLockedInThisContext,
        isRevisionConflict: !isRevisionCompatible,
        outcome: isLockConflict ? UpdateWikiPageResultOutcome.lockConflict : (isRevisionCompatible ? UpdateWikiPageResultOutcome.success : UpdateWikiPageResultOutcome.revisionConflict),
        lockId: userClientLockId,
        currentPage,
    };
};
