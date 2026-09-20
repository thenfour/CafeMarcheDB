import superjson from 'superjson';
import { GetSearchResultsInput, SearchResultsRet } from "../../db3/shared/apiTypes";
import type { TAnyModel } from 'shared/rootroot';

export async function fetchSearchResultsApi<TResult extends TAnyModel>(args: GetSearchResultsInput, signal?: AbortSignal): Promise<SearchResultsRet<TResult>> {
    const serializedArgs = superjson.stringify(args);
    const encodedArgs = encodeURIComponent(serializedArgs);

    const response = await fetch(
        `/api/search/getSearchResultsApi?args=${encodedArgs}`,
        { signal },
    );

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return superjson.parse(await response.text()) as SearchResultsRet<TResult>;
}

