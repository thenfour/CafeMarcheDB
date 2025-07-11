import React from "react";
import { StandardVariationSpec } from "shared/color";
import { CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { AdminInspectObject } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { getAbsoluteUrl } from "src/core/db3/clientAPILL";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { UserChip } from "../user/userChip";
import { DateValue } from "../DateTime/DateTimeComponents";
import { CMLink } from "../CMLink";
import { EnrichedVerboseWikiPage, WikiPagesFilterSpec } from "./WikiClientBaseTypes";

export interface WikiPageListItemProps {
    index: number;
    wikiPage: EnrichedVerboseWikiPage;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: WikiPagesFilterSpec;
}

export function WikiPageListItem(props: WikiPageListItemProps) {
    const { wikiPage } = props;
    const dashboardContext = React.useContext(DashboardContext);

    const wikiUrl = getAbsoluteUrl(`/backstage/wiki/${wikiPage.slug}`);
    const visInfo = dashboardContext.getVisibilityInfo(wikiPage);

    return (
        <div className={`songListItem ${visInfo.className}`}>
            <div className="titleLine">
                <div className="topTitleLine">
                    <CMLink className="nameLink" href={wikiUrl}>
                        {wikiPage.slug}
                    </CMLink>
                    <div style={{ flexGrow: 1 }}>
                        <AdminInspectObject src={wikiPage} label="Obj" />
                    </div>
                    <span className="resultIndex">#{props.index + 1}</span>
                </div>
            </div>

            <div className="credits">
                <div className="credit row">
                    {wikiPage.createdAt && (
                        <div className="fieldItem">Created on <DateValue value={wikiPage.createdAt} /></div>
                    )}
                    {wikiPage.createdByUser && (
                        <div className="fieldItem">by <UserChip value={wikiPage.createdByUser} /></div>
                    )}
                </div>
            </div>

            <div className="chips">
                <CMChipContainer>
                    {wikiPage.tags?.map(tagAssignment => (
                        <CMStandardDBChip
                            key={tagAssignment.id}
                            size="small"
                            model={tagAssignment.tag}
                            variation={{
                                ...StandardVariationSpec.Weak,
                                selected: props.filterSpec.tagFilter.options.includes(tagAssignment.tag.id)
                            }}
                            getTooltip={() => tagAssignment.tag.description}
                        />
                    )) || []}

                </CMChipContainer>
            </div>
        </div>
    );
}
