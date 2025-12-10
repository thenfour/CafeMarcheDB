// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

// clipboard custom formats
// https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/

import { Tooltip } from "@mui/material";
import React from "react";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { StandardVariationSpec } from "./color/palette";
import { GetStyleVariablesForColor } from "./color/ColorClientUtils";
import { useDashboardContext } from "./dashboardContext/DashboardContext";

// Aligned version that shows all possible tags with consistent spacing
// Tags with the same sort order can share the same lane
export const SongTagIndicatorContainer = ({ tagIds, allPossibleTags }: {
    tagIds: number[],
    allPossibleTags: number[]
}) => {
    const dashboardContext = useDashboardContext();

    // Get all possible tags that have indicators
    const allTags = allPossibleTags
        .map(tagId => dashboardContext.songTag.getById(tagId))
        .filter(t => !!t && !IsNullOrWhitespace(t.indicator)) as db3.SongTagPayload[];

    // Create a set of current song's tag IDs for quick lookup
    const currentTagIds = new Set(tagIds);
    const getGroupKey = (tag: db3.SongTagPayload) => tag.group || `_5e25847d_${tag.sortOrder.toString()}`;

    // Group tags
    const groupedTags = new Map<string, db3.SongTagPayload[]>();
    allTags.forEach(tag => {
        const groupKey = getGroupKey(tag);
        if (!groupedTags.has(groupKey)) {
            groupedTags.set(groupKey, []);
        }
        groupedTags.get(groupKey)!.push(tag);
    });

    // Get unique sort orders and sort them
    const sortedGroups = Array
        .from(groupedTags.keys())
        .sort((a, b) => groupedTags.get(a)![0]!.sortOrder - groupedTags.get(b)![0]!.sortOrder);

    if (!sortedGroups.length) return null;

    // Render tags grouped by sort order
    const renderElements: React.ReactNode[] = [];
    let keyCounter = 0;

    sortedGroups.forEach(group => {
        const tagsForThisSortOrder = groupedTags.get(group)!;
        const visibleTagsForThisSortOrder = tagsForThisSortOrder.filter(tag => currentTagIds.has(tag.id));

        if (visibleTagsForThisSortOrder.length > 0) {
            // Show all visible tags for this sort order
            visibleTagsForThisSortOrder.forEach(tag => {
                const style = GetStyleVariablesForColor({ color: tag.color, ...StandardVariationSpec.Strong });
                renderElements.push(
                    <Tooltip title={tag.text} key={keyCounter++} disableInteractive>
                        <div
                            className={`songTagIndicator ${tag.indicatorCssClass} ${style.cssClass}`}
                            style={style.style}
                        >
                            {tag.indicator}
                        </div>
                    </Tooltip>
                );
            });
        } else {
            // Show one hidden tag to maintain spacing
            const firstTag = tagsForThisSortOrder[0]!; // We know this exists since we put it in the map
            renderElements.push(
                <div
                    className={`songTagIndicator ${firstTag.indicatorCssClass}`}
                    key={keyCounter++}
                    style={{
                        visibility: 'hidden'
                    }}
                >
                    {firstTag.indicator}
                </div>
            );
        }
    });

    return <div className='songTagIndicatorContainer'>
        {renderElements}
    </div>;
};
