// a react hook that manages accessing & editing wiki pages

import { useMutation, useQuery } from "@blitzjs/rpc";
import React from "react";
import { useInterval, useThrottle } from "shared/useGeneral";
import acquireLockOnWikiPage from "src/core/wiki/mutations/acquireLockOnWikiPage";
import updateWikiPage from "src/core/wiki/mutations/updateWikiPage";
import wikiAdminClearLock from "src/core/wiki/mutations/wikiAdminClearLock";
import wikiEditPing from "src/core/wiki/mutations/wikiEditPing";
import wikiReleaseYourLock from "src/core/wiki/mutations/wikiReleaseYourLock";
import wikiRenewYourLock from "src/core/wiki/mutations/wikiRenewYourLock";
import getWikiPage from "src/core/wiki/queries/getWikiPage";
import { GetWikiPageUpdatabilityResult, UpdateWikiPageResultOutcome } from "src/core/wiki/server/wikiServerCore";
import { gWikiEditPingIntervalMilliseconds, gWikiLockAutoRenewThrottleInterval, WikiPageApiPayload, WikiPageApiUpdatePayload, WikiPageData, wikiParseCanonicalWikiPath, WikiPath } from "src/core/wiki/shared/wikiUtils";
import { v4 as uuidv4 } from "uuid";
import { useDashboardContext } from "../DashboardContext";

// upon begin edit:
//     - try to acquire lock (with your client-generated uid)
//         - can't acquire lock: don't allow editing, show message ("this page is locked for editing by <xyz> until 21:19")
//         - upon success: store lock UID and base revision ID
//             - also check revision ID. if old, don't allow editing.
//             - otherwise, proceed to editing.

// once editing:
//     lock indicator
//         - lock icon; when clicked: small popup
//             "Being edited by Sarah."
//             admin option to forcibly remove lock
//             for debugging purposes i could have manual lock refresh / release options.
//         - color the lock based on status
//             - you don't have a lock on this page
//             - you have a lock on this page
//             - someone else has a lock on this page (alert styling as well)
//     conflict indicator - an indicator showing edit status
//         - up-to-date
//         - unsaved changes
//         - unsaved changes AND the page has been modified beneath -- this is a conflict and should be indicated as error

//     on timer, refresh lock status (in case something changed, it was stolen, an admin remove it etc)
//         - when you lose your lock, shall be indicated on the lock indicator.
//         - when the page is modified (latestRevisionId !== baseRevisionId), we need to indicate an error too.

//     on save progress:
//         - renew your lock, also refreshing lock & revision status

//     on close:
//         - release your lock (don't care about result)

// queries & mutations
//     - acquire or renew lock (client UID) => { success, lockUntil, lockedByUser, currentRevisionId }
//     - release lock
//     - admin release lock (or can reuse above?)

interface WikiApiUpdateArgs {
  revisionData: WikiPageApiUpdatePayload;
}

export interface WikiPageApi {
  wikiPath: WikiPath;

  // the latest known revision of this page as committed to the db. null if new or unknown
  // also contains the latest known lock info.
  currentPageData: WikiPageData | null;
  coalescedCurrentPageData: {
    title: string;
    content: string;
    visiblePermissionId: number | null;
  };

  basePage: WikiPageApiPayload | null; // the revision we started editing from, or null if we haven't started editing yet.
  yourLockId: string | null; // kinda just for debugging purposes.

  beginEditing: () => Promise<GetWikiPageUpdatabilityResult>;
  saveProgress: (args: WikiApiUpdateArgs) => Promise<GetWikiPageUpdatabilityResult>;
  releaseYourLock: () => Promise<void>;
  adminClearLock: () => Promise<void>;
  renewYourLockThrottled: () => void;
  refetch: () => void; // call if you knowingly make changes outside of this hook.
};

type UseWikiPageArgs = {
  canonicalWikiPath: string;
};

//////////////////////////////////
export function useWikiPageApi(args: UseWikiPageArgs): WikiPageApi {
  const dashboardContext = useDashboardContext();
  const [wikiPath, setWikiPath] = React.useState<WikiPath>(() => wikiParseCanonicalWikiPath(args.canonicalWikiPath));

  const [lockUid, setLockUid] = React.useState<string | null>(null);
  const [basePage, setBasePage] = React.useState<WikiPageApiPayload | null>(null);

  const [currentRevisionData, currentRevisionDataQueryExtras] = useQuery(getWikiPage, {
    canonicalWikiPath: args.canonicalWikiPath,
  }, { refetchInterval: 5000 });

  const [updateWikiPageMutation] = useMutation(updateWikiPage);
  const [acquireLockOnWikiPageMutation] = useMutation(acquireLockOnWikiPage);
  const [wikiAdminClearLockMutation] = useMutation(wikiAdminClearLock);
  const [wikiReleaseYourLockMutation] = useMutation(wikiReleaseYourLock);
  const [wikiRenewYourLockMutation] = useMutation(wikiRenewYourLock);
  const [wikiEditPingMutation] = useMutation(wikiEditPing);

  //////////////////////////////////
  async function beginEditing(): Promise<GetWikiPageUpdatabilityResult> {
    if (lockUid) throw new Error("Already editing");
    const newLockUid = uuidv4();
    const baseRevisionId = currentRevisionData.wikiPage?.currentRevision?.id ?? null; // when you start editing, we fork the current revision.

    const lockResult = await acquireLockOnWikiPageMutation({
      canonicalWikiPath: args.canonicalWikiPath,
      lockId: newLockUid,
      baseRevisionId,
    });

    if (lockResult.outcome !== UpdateWikiPageResultOutcome.success) {
      return lockResult;
    }

    void currentRevisionDataQueryExtras.refetch(); // refresh lock status et al

    setLockUid(newLockUid);
    setBasePage(lockResult.currentPage);

    return lockResult;
  }

  async function saveProgress(args: WikiApiUpdateArgs): Promise<GetWikiPageUpdatabilityResult> {
    const result = await updateWikiPageMutation({
      canonicalWikiPath: wikiPath.canonicalWikiPath,
      baseRevisionId: currentRevisionData.wikiPage?.currentRevision?.id ?? null,
      lockId: lockUid,
      title: args.revisionData.name,
      content: args.revisionData.content,
    });

    void currentRevisionDataQueryExtras.refetch(); // refresh lock status et al

    // when you save progress, we update the base revision to the latest revision.
    setBasePage(result.currentPage);

    return result;
  }

  async function releaseYourLock(): Promise<void> {
    if (!lockUid) return;
    await wikiReleaseYourLockMutation({
      canonicalWikiPath: args.canonicalWikiPath,
      lockId: lockUid,
    });
    setLockUid(null);
    setBasePage(null);
    void currentRevisionDataQueryExtras.refetch(); // refresh lock status et al
  }

  async function adminClearLock(): Promise<void> {
    setLockUid(null);
    setBasePage(null);
    const ret = await wikiAdminClearLockMutation({
      canonicalWikiPath: args.canonicalWikiPath,
    });
    void currentRevisionDataQueryExtras.refetch(); // refresh lock status et al
  }

  const renewYourLockThrottled = useThrottle(() => {
    void wikiRenewYourLockMutation({
      canonicalWikiPath: args.canonicalWikiPath,
      lockId: lockUid,
    });
  }, gWikiLockAutoRenewThrottleInterval);

  //Background ping sending on interval while editing
  useInterval(() => {
    void wikiEditPingMutation({
      canonicalWikiPath: args.canonicalWikiPath,
      lockId: lockUid,
    });
  }, !!lockUid ? gWikiEditPingIntervalMilliseconds : null);


  React.useEffect(() => {
    return () => {
      void releaseYourLock();
    }
  }, []);

  const MakeApi = (): WikiPageApi => ({
    wikiPath,
    basePage,
    currentPageData: currentRevisionData,
    yourLockId: lockUid,
    beginEditing,
    saveProgress,
    releaseYourLock,
    adminClearLock,
    renewYourLockThrottled,
    refetch: currentRevisionDataQueryExtras.refetch,
    coalescedCurrentPageData: {
      title: currentRevisionData.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
      content: currentRevisionData.wikiPage?.currentRevision?.content ?? "",
      visiblePermissionId: currentRevisionData.wikiPage ? currentRevisionData.wikiPage.visiblePermissionId : dashboardContext.getDefaultVisibilityPermission().id,
    },
  });

  return MakeApi();
};
