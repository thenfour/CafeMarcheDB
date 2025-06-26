import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DashboardContext } from "src/core/components/DashboardContext";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as db3 from "src/core/db3/db3";
import { MakeEmptySearchResultsRet, SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { fetchSearchResultsApi } from './SearchBase';
import { EnrichedVerboseFile, FilesFilterSpec } from './FileComponentsBase';

const gPageSize = 20;

function GetSearchResultsQueryArgs(filterSpec: FilesFilterSpec, offset: number, take: number) {
    return {
        offset,
        take,
        tableID: db3.xFile.tableID,
        refreshSerial: filterSpec.refreshSerial,
        sort: [{
            db3Column: filterSpec.orderByColumn,
            direction: filterSpec.orderByDirection,
        }],
        quickFilter: filterSpec.quickFilter,
        discreteCriteria: [
            //filterSpec.typeFilter,
            filterSpec.tagFilter,
            // filterSpec.uploaderFilter,
            // filterSpec.sizeFilter,
            // filterSpec.taggedUserFilter,
            // filterSpec.taggedEventFilter,
            // filterSpec.taggedSongFilter,
            filterSpec.taggedInstrumentFilter,
        ],
    };
}

export function useFileListData(filterSpec: FilesFilterSpec, pageSize: number = gPageSize) {
    const dashboardContext = useContext(DashboardContext);
    const snackbarContext = useContext(SnackbarContext);

    const filterSpecHash = JSON.stringify(filterSpec);

    const [enrichedFiles, setEnrichedFiles] = useState<EnrichedVerboseFile[]>([]);
    const [results, setResults] = useState<SearchResultsRet>(MakeEmptySearchResultsRet());

    const isFetchingRef = useRef(false);
    const totalFilesFetchedRef = useRef(0);

    const fetchData = async (offset: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            const searchResult = await fetchSearchResultsApi(GetSearchResultsQueryArgs(filterSpec, offset, pageSize));

            const newFiles = searchResult.results.map(e =>
                db3.enrichFile(e as db3.FilePayload, dashboardContext)
            );

            const overlaps: EnrichedVerboseFile[] = [];

            setEnrichedFiles(prevFiles => {
                const newItems: EnrichedVerboseFile[] = [];

                for (const file of newFiles) {
                    const foundIndex = prevFiles.findIndex(e => e.id === file.id);
                    if (foundIndex === -1) {
                        newItems.push(file);
                    } else {
                        // the item already exists; just leave it.
                        overlaps.push(file);
                    }
                }

                const ret = [...prevFiles, ...newItems];
                return ret;
            });

            setResults(searchResult);
        } catch (error) {
            snackbarContext.showMessage({
                severity: 'error',
                children: 'Failed to load more files.',
            });
        } finally {
            isFetchingRef.current = false;
        }
    };

    useEffect(() => {
        setEnrichedFiles([]);
        setResults(MakeEmptySearchResultsRet());
        totalFilesFetchedRef.current = 0;
        // Fetch the first page
        void fetchData(0);
    }, [filterSpecHash]);

    const loadMoreData = useCallback(() => {
        if (isFetchingRef.current) return;
        void fetchData(enrichedFiles.length);
    }, [enrichedFiles]);

    return { enrichedFiles, results, loadMoreData };
}
