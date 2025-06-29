import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";

//////////////////////////////////////////////////////////////////////////////////////////////////
// Generic Search Results List Component
//////////////////////////////////////////////////////////////////////////////////////////////////

export interface SearchResultsListProps<TItem, TFilterSpec> {
    // Data
    items: TItem[];
    results: SearchResultsRet;
    filterSpec: TFilterSpec;

    // Pagination
    loadMoreData: () => void;
    hasMore: boolean;

    // Actions
    refetch: () => void;
    onCopyCSV?: (items: TItem[]) => Promise<void>;

    // Rendering
    renderItem: (item: TItem, index: number) => React.ReactNode;
    getItemKey: (item: TItem) => string | number;

    // Configuration
    contextMarkerName?: string;
    contextMarkerQuery?: string;
    className?: string;

    // Auto-load configuration
    maxAutoLoads?: number;
    autoLoadSelector?: string; // CSS selector for checking viewport height
}

/**
 * Generic component for displaying search results with infinite scroll, copy functionality,
 * and auto-loading when content doesn't fill the viewport.
 * 
 * This component handles:
 * - Search result count display
 * - Dot menu with copy CSV functionality
 * - Infinite scroll
 * - Auto-loading when content height is less than viewport
 * - Load more button
 */
export const SearchResultsList = <TItem, TFilterSpec extends { quickFilter?: string }>({
    items,
    results,
    filterSpec,
    loadMoreData,
    hasMore,
    refetch,
    onCopyCSV,
    renderItem,
    getItemKey,
    contextMarkerName,
    contextMarkerQuery,
    className = "",
    maxAutoLoads = 15,
    autoLoadSelector = ".eventList.searchResults"
}: SearchResultsListProps<TItem, TFilterSpec>): React.JSX.Element => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbarContext = React.useContext(SnackbarContext);
    const [autoLoadCount, setAutoLoadCount] = React.useState(0);

    const handleCopy = async () => {
        if (onCopyCSV) {
            await onCopyCSV(items);
        }
    };

    // Auto-load effect to ensure content fills viewport
    React.useEffect(() => {
        const checkIfNeedsMoreData = () => {
            const contentElement = document.querySelector(autoLoadSelector);
            if (contentElement) {
                const contentHeight = contentElement.scrollHeight;
                const viewportHeight = window.innerHeight;

                if (contentHeight <= viewportHeight && hasMore && autoLoadCount < maxAutoLoads) {
                    setAutoLoadCount(prevCount => prevCount + 1);
                    console.log(`autoLoadCount = ${autoLoadCount}`);
                    loadMoreData();
                }
            }
        };

        // Delay the check to ensure the DOM has updated
        setTimeout(checkIfNeedsMoreData, 0);
    }, [items, hasMore, autoLoadCount, maxAutoLoads, loadMoreData, autoLoadSelector]);

    const content = (
        <>
            <div className="searchRecordCount">
                {results.rowCount === 0 ? "No items to show" : <>Displaying {items.length} items of {results.rowCount} total</>}
                {onCopyCSV && (
                    <>
                        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>
                            {gCharMap.VerticalEllipses()}
                        </CMSmallButton>
                        <Menu
                            id="menu-searchResults"
                            anchorEl={anchorEl}
                            keepMounted
                            open={Boolean(anchorEl)}
                            onClose={() => setAnchorEl(null)}
                        >
                            <MenuItem onClick={async () => { await handleCopy(); setAnchorEl(null); }}>
                                <ListItemIcon>
                                    {gIconMap.ContentCopy()}
                                </ListItemIcon>
                                Copy CSV
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </div>

            <InfiniteScroll
                dataLength={items.length}
                next={loadMoreData}
                hasMore={hasMore}
                loader={<h4>Loading...</h4>}
            >
                {items.map((item, i) => (
                    <React.Fragment key={getItemKey(item)}>
                        {renderItem(item, i + 1)}
                    </React.Fragment>
                ))}
            </InfiniteScroll>

            {hasMore && <Button onClick={loadMoreData}>Load more results...</Button>}
        </>
    );

    const wrappedContent = contextMarkerName ? (
        <AppContextMarker
            name={contextMarkerName}
            queryText={contextMarkerQuery || (filterSpec as any).quickFilter}
        >
            {content}
        </AppContextMarker>
    ) : content;

    return (
        <div className={`eventList searchResults ${className}`.trim()}>
            {wrappedContent}
        </div>
    );
};
