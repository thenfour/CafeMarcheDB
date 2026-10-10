import React from "react";
import type { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import type { QuickSearchPermissionPolicy } from "src/core/db3/shared/quickSearchTypes";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { fetchObjectQuery } from "./quickSearchClient";
import { useQuickSearchScopeKey } from "./useQuickSearchResults";

/** Callback-based controls must guard both delivered results and later selection. */
export function useQuickSearchProvider(enabled: boolean) {
    const dashboard = useDashboardContext();
    const { data: snapshot } = usePresentation();
    const scopeKey = useQuickSearchScopeKey();
    const latest = React.useRef({ scopeKey, snapshot, enabled });
    latest.current = { scopeKey, snapshot, enabled };
    const pending = React.useRef<AbortController | null>(null);

    const invalidate = React.useCallback(() => {
        pending.current?.abort();
        pending.current = null;
    }, []);
    React.useEffect(() => invalidate, [scopeKey, snapshot, enabled, invalidate]);

    async function search<TItemType extends QuickSearchItemType>(query: string,
        allowedItemTypes: readonly TItemType[], permissionPolicy: QuickSearchPermissionPolicy,
    ): Promise<{ results: QuickSearchItemMatch<TItemType>[]; isCurrent: () => boolean } | null> {
        invalidate();
        const controller = new AbortController();
        pending.current = controller;
        const isCurrent = () => pending.current === controller && !controller.signal.aborted
            && latest.current.enabled && latest.current.scopeKey === scopeKey && latest.current.snapshot === snapshot;
        const bandPublicId = dashboard.authorizationContext?.bandPublicId;
        if (!enabled || !bandPublicId || !query.trim()) {
            return { results: [], isCurrent };
        }
        const { routeLocale, browserLanguages } = dashboard.localePreferences;
        try {
            const results = await fetchObjectQuery(query, allowedItemTypes,
                { bandPublicId, routeLocale, browserLanguages: [...browserLanguages] }, permissionPolicy, controller.signal);
            return isCurrent() ? { results, isCurrent } : null;
        } catch {
            return isCurrent() ? { results: [], isCurrent } : null;
        }
    }

    return { search, invalidate, scopeKey, snapshot };
}
