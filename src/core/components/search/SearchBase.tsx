import superjson from 'superjson';
import { GetSearchResultsInput, SearchResultsRet } from "../../db3/shared/apiTypes";

export async function fetchSearchResultsApi(args: GetSearchResultsInput): Promise<SearchResultsRet> {
    const serializedArgs = superjson.stringify(args);
    const encodedArgs = encodeURIComponent(serializedArgs);

    const response = await fetch(
        `/api/search/getSearchResultsApi?args=${encodedArgs}`
    );

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return superjson.parse(await response.text());
}

