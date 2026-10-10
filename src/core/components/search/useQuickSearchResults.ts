import React from "react";
import type { QuickSearchItemMatch, QuickSearchItemType } from "shared/quickFilter";
import type { QuickSearchPermissionPolicy } from "src/core/db3/shared/quickSearchTypes";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { fetchObjectQuery } from "./quickSearchClient";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

/** Reset suggestion input without changing the caller's saved association or editor draft. */
export function useQuickSearchScopeKey(): string {
    const dashboard = useDashboardContext();
    return JSON.stringify([dashboard.authorizationContext, dashboard.localePreferences]);
}

interface QuickSearchOptions<TItemType extends QuickSearchItemType> {
    query: string;
    allowedItemTypes: readonly TItemType[];
    permissionPolicy: QuickSearchPermissionPolicy;
    minimumCharacters: number;
    enabled: boolean;
}

/** Every result and pending selection belongs to one query, presentation and authority snapshot. */
export function useQuickSearchResults<TItemType extends QuickSearchItemType>(options: QuickSearchOptions<TItemType>) {
    const dashboard = useDashboardContext();
    const { data: snapshot } = usePresentation();
    const bandPublicId = dashboard.authorizationContext?.bandPublicId;
    const { routeLocale, browserLanguages } = dashboard.localePreferences;
    const requestKey = JSON.stringify([options, bandPublicId, routeLocale, browserLanguages, dashboard.authorizationContext]);
    const canSearch = options.enabled && !!bandPublicId && options.query.trim().length > 0 && options.query.length >= options.minimumCharacters;
    const latest = React.useRef({ key: requestKey, snapshot });
    const mounted = React.useRef(false);
    latest.current = { key: requestKey, snapshot };
    const [response, setResponse] = React.useState<{
        key: string; snapshot: typeof snapshot;
        results: QuickSearchItemMatch<TItemType>[]; failed: boolean
    } | null>(null);

    React.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    React.useEffect(() => {
        setResponse(null);
        if (!canSearch || !bandPublicId) {
            return;
        }
        const controller = new AbortController();
        void fetchObjectQuery(options.query,
            options.allowedItemTypes,
            {
                bandPublicId,
                routeLocale,
                browserLanguages: [...browserLanguages]
            },
            options.permissionPolicy,
            controller.signal
        )
            .then(results => {
                if (!controller.signal.aborted) {
                    setResponse({ key: requestKey, snapshot, results, failed: false });
                }
            }).catch(() => {
                if (!controller.signal.aborted) {
                    setResponse({ key: requestKey, snapshot, results: [], failed: true });
                }
            });
        return () => controller.abort();
        // Content keys keep equivalent inline arrays from restarting an unchanged request.
    }, [requestKey, snapshot, canSearch]);

    const current = canSearch && response?.key === requestKey && response.snapshot === snapshot ? response : null;
    const status: "idle" | "loading" | "error" | "ready" = !canSearch ? "idle" : !current ? "loading" : current.failed ? "error" : "ready";
    return {
        results: current?.results ?? [],
        status,
        isCurrent: () => mounted.current && latest.current.key === requestKey && latest.current.snapshot === snapshot,
    };
}
