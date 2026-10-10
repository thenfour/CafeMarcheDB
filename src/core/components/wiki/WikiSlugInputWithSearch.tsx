import React from "react";
import { useLocale } from "src/locale/components/useLocale";
import { wikiPageSearchView, type WikiPageSearchDto } from "src/core/db3/db3";
import { CMTextInputBase, type CMTextInputBaseProps } from "../CMTextField";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { fetchSearchResultsApi } from "../search/SearchBase";

export interface WikiSlugInputWithSearchProps extends CMTextInputBaseProps {
    allowSearch: boolean;
}

/** The original menu editor previews an existing slug; authored text remains editable. */
export function WikiSlugInputWithSearch({ allowSearch, ...inputProps }: WikiSlugInputWithSearchProps) {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const keyword = inputProps.value ?? "";
    const bandPublicId = dashboard.authorizationContext?.bandPublicId;
    const { routeLocale, browserLanguages } = dashboard.localePreferences;
    const scope = JSON.stringify([keyword, allowSearch, bandPublicId, routeLocale, browserLanguages]);
    const [match, setMatch] = React.useState<{ scope: string; slug: string | null } | null>(null);

    React.useEffect(() => {
        setMatch(null);
        if (!allowSearch || !bandPublicId || keyword.length < 2) {
            return;
        }
        const request = new AbortController();
        async function findMatch() {
            try {
                const result = await fetchSearchResultsApi<WikiPageSearchDto>({
                    tableID: wikiPageSearchView.tableID, viewID: wikiPageSearchView.viewID,
                    bandPublicId, routeLocale, browserLanguages: [...browserLanguages],
                    quickFilter: keyword, offset: 0, take: 1,
                    sort: [{ db3Column: "slug", direction: "asc" }], discreteCriteria: [],
                }, request.signal);
                const first = result.results[0];
                const page = first === undefined ? null : wikiPageSearchView.parseDto(first);
                if (!request.signal.aborted) {
                    setMatch({ scope, slug: page?.slug ?? null });
                }
            } catch {
                // A denied or failed lookup must never confirm a stale existing page.
                if (!request.signal.aborted) {
                    setMatch(null);
                }
            }
        }
        void findMatch();
        return () => request.abort();
    }, [scope]);

    const current = match?.scope === scope ? match : null;
    return <div className="searchableValueContainer">
        <CMTextInputBase {...inputProps} />
        <div className="searchableValueResult" aria-live="polite">
            {current && (current.slug === keyword ? <div>✅</div> : <>
                <div className="existingMatchLabel">{locale.getPlainString("menuLink.wikiBestMatch")}</div>
                <div className="existingMatchValue">{current.slug}</div>
            </>)}
        </div>
    </div>;
}
