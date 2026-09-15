// a react hook that manages accessing & editing wiki pages

import { useMutation, useQuery } from "@blitzjs/rpc";
import React from "react";
import { useThrottle } from "shared/useGeneral";
import acquireLockOnWikiPage from "src/core/wiki/mutations/acquireLockOnWikiPage";
import updateWikiPage from "src/core/wiki/mutations/updateWikiPage";
import wikiAdminClearLock from "src/core/wiki/mutations/wikiAdminClearLock";
import wikiReleaseYourLock from "src/core/wiki/mutations/wikiReleaseYourLock";
import wikiRenewYourLock from "src/core/wiki/mutations/wikiRenewYourLock";
import getWikiPage from "src/core/wiki/queries/getWikiPage";
import { GetWikiPageUpdatabilityResult, gWikiLockAutoRenewThrottleInterval, UpdateWikiPageResultOutcome, WikiPageApiPayload, WikiPageApiUpdatePayload, WikiPageData, wikiParseCanonicalWikiPath, WikiPath } from "src/core/wiki/shared/wikiUtils";
import { v4 as uuidv4 } from "uuid";
import { useMessageBox } from "../MessageBoxContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";

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

  lockStatus: GetWikiPageUpdatabilityResult,
  networkPending: boolean;

  basePage: WikiPageApiPayload | null; // the revision we started editing from, or null if we haven't started editing yet.
  yourLockId: string | null; // kinda just for debugging purposes.

  reacquireLock: () => Promise<GetWikiPageUpdatabilityResult>;
  acceptLatestAsBase: (page: WikiPageApiPayload | null) => void;
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
  const messageBox = useMessageBox();
  const [wikiPath, setWikiPath] = React.useState<WikiPath>(() => wikiParseCanonicalWikiPath(args.canonicalWikiPath));
  const recordFeature = useFeatureRecorder();

  const [lockUid, setLockUid] = React.useState<string | null>(null);
  const [basePage, setBasePage] = React.useState<WikiPageApiPayload | null>(null);

  const [currentRevisionData, currentRevisionDataQueryExtras] = useQuery(getWikiPage, {
    canonicalWikiPath: args.canonicalWikiPath,
    baseRevisionId: basePage?.currentRevision?.id ?? null,
    baseContentVersion: basePage?.contentVersion ?? 0,
    lockId: lockUid,
  }, {
    refetchInterval: 5000,
  });

  const [updateWikiPageMutation, updateWikiPageMutationExtras] = useMutation(updateWikiPage);
  const [acquireLockOnWikiPageMutation, acquireLockOnWikiPageMutationExtras] = useMutation(acquireLockOnWikiPage);
  const [wikiAdminClearLockMutation, wikiAdminClearLockMutationExtras] = useMutation(wikiAdminClearLock);
  const [wikiReleaseYourLockMutation, wikiReleaseYourLockMutationExtras] = useMutation(wikiReleaseYourLock);
  const [wikiRenewYourLockMutation, wikiRenewYourLockMutationExtras] = useMutation(wikiRenewYourLock);

  // Refs keep asynchronous saves and cleanup attached to the actual editor session.
  const lockRef = React.useRef<string | null>(null);
  const baseRef = React.useRef<WikiPageApiPayload | null>(null);
  const busyRef = React.useRef(false);
  const setLock = (id: string | null) => { lockRef.current = id; setLockUid(id); };
  const setBase = (page: WikiPageApiPayload | null) => { baseRef.current = page; setBasePage(page); };

  async function acquire(base: WikiPageApiPayload | null): Promise<GetWikiPageUpdatabilityResult> {
    const lockId = uuidv4();
    const request = {
      canonicalWikiPath: args.canonicalWikiPath,
      lockId,
      baseRevisionId: base?.currentRevision?.id ?? null,
      baseContentVersion: base?.contentVersion ?? 0,
    };
    let result = await acquireLockOnWikiPageMutation(request);
    if (result.outcome === UpdateWikiPageResultOutcome.lockConflict &&
        result.currentPage?.lockedByUser?.id === dashboardContext.currentUser?.id) {
      const answer = await messageBox.showMessage({
        title: "Take over editing here?",
        message: "This page is open in another editor belonging to you. Taking over prevents that editor from saving until it reacquires the lock. Its unsaved text will remain there.",
        buttons: ["yes", "cancel"], defaultButton: "cancel",
      });
      if (answer === "yes") result = await acquireLockOnWikiPageMutation({
        ...request, takeOverLockId: result.currentPage?.lockId ?? undefined,
      });
    }
    if (result.outcome === UpdateWikiPageResultOutcome.success) setLock(lockId);
    void currentRevisionDataQueryExtras.refetch();
    return result;
  }

  async function beginEditing(): Promise<GetWikiPageUpdatabilityResult> {
    const result = await acquire(currentRevisionData.wikiPage);
    if (result.outcome === UpdateWikiPageResultOutcome.success) setBase(result.currentPage);
    return result;
  }

  async function reacquireLock(): Promise<GetWikiPageUpdatabilityResult> {
    return acquire(baseRef.current);
  }

  async function saveProgress(saveProgressArgs: WikiApiUpdateArgs): Promise<GetWikiPageUpdatabilityResult> {
    if (busyRef.current) throw new Error("A save is already in progress.");
    busyRef.current = true;
    try {
      // Reacquisition is explicit in the UI; a stale editor never takes ownership on save.
      const result = await updateWikiPageMutation({
        canonicalWikiPath: args.canonicalWikiPath,
        baseRevisionId: baseRef.current?.currentRevision?.id ?? null,
        baseContentVersion: baseRef.current?.contentVersion ?? 0,
        lockId: lockRef.current,
        title: saveProgressArgs.revisionData.name,
        content: saveProgressArgs.revisionData.content,
      });
      if (result.outcome === UpdateWikiPageResultOutcome.success) {
        setBase(result.currentPage);
        void recordFeature({ feature: ActivityFeature.wiki_edit, wikiPageId: result.currentPage?.id });
      }
      void currentRevisionDataQueryExtras.refetch();
      return result;
    } finally {
      busyRef.current = false;
    }
  }

  async function releaseYourLock(): Promise<void> {
    const lockId = lockRef.current;
    if (!lockId) return;
    await wikiReleaseYourLockMutation({ canonicalWikiPath: args.canonicalWikiPath, lockId });
    if (lockRef.current === lockId) setLock(null);
  }

  async function adminClearLock(): Promise<void> {
    await wikiAdminClearLockMutation({ canonicalWikiPath: args.canonicalWikiPath });
    setLock(null);
    void currentRevisionDataQueryExtras.refetch();
  }

  const renewYourLockThrottled = useThrottle(() => {
    const lockId = lockRef.current;
    if (!lockId) return;
    void wikiRenewYourLockMutation({ canonicalWikiPath: args.canonicalWikiPath, lockId })
      .then(() => currentRevisionDataQueryExtras.refetch())
      .catch(() => { /* Keep the draft. Polling or the next save will check ownership. */ });
  }, gWikiLockAutoRenewThrottleInterval);

  React.useEffect(() => {
    const canonicalWikiPath = args.canonicalWikiPath;
    return () => {
      const lockId = lockRef.current;
      if (lockId) void wikiReleaseYourLockMutation({ canonicalWikiPath, lockId }).catch(() => {});
    };
  }, [args.canonicalWikiPath]);

  const networkPending = currentRevisionDataQueryExtras.isFetching ||
    updateWikiPageMutationExtras.isLoading ||
    acquireLockOnWikiPageMutationExtras.isLoading ||
    wikiAdminClearLockMutationExtras.isLoading ||
    wikiReleaseYourLockMutationExtras.isLoading ||
    wikiRenewYourLockMutationExtras.isLoading;

  const MakeApi = (): WikiPageApi => ({
    wikiPath,
    basePage,
    currentPageData: currentRevisionData,
    yourLockId: lockUid,
    beginEditing,
    reacquireLock,
    acceptLatestAsBase: (page) => setBase(page),
    saveProgress,
    releaseYourLock,
    adminClearLock,
    renewYourLockThrottled,
    lockStatus: currentRevisionData.lockStatus,
    networkPending,
    refetch: currentRevisionDataQueryExtras.refetch,
    coalescedCurrentPageData: {
      title: currentRevisionData.wikiPage?.currentRevision?.name ?? wikiPath.slugWithoutNamespace,
      content: currentRevisionData.wikiPage?.currentRevision?.content ?? "",
      visiblePermissionId: currentRevisionData.wikiPage ? currentRevisionData.wikiPage.visiblePermissionId : dashboardContext.getDefaultVisibilityPermission().id,
    },
  });

  return MakeApi();
};
