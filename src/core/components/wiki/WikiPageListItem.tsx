import { Article } from "@mui/icons-material";
import React from "react";
import { StandardVariationSpec } from "shared/color";
import { CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import { DashboardContext } from "src/core/components/DashboardContext";
import { getAbsoluteUrl } from "src/core/db3/clientAPILL";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { DateValue } from "../DateTime/DateTimeComponents";
import { GenericSearchListItem } from "../search/SearchListItem";
import { UserChip } from "../user/userChip";
import { EnrichedVerboseWikiPage, WikiPagesFilterSpec } from "./WikiClientBaseTypes";

export interface WikiPageListItemProps {
    index: number;
    wikiPage: EnrichedVerboseWikiPage;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: WikiPagesFilterSpec;
}

export const WikiPageListItem = (props: WikiPageListItemProps) => {
    const { wikiPage } = props;
    const dashboardContext = React.useContext(DashboardContext);

    const wikiUrl = getAbsoluteUrl(`/backstage/wiki/${wikiPage.slug}`);
    const visInfo = dashboardContext.getVisibilityInfo(wikiPage);

    return <GenericSearchListItem<EnrichedVerboseWikiPage>
        index={props.index}
        item={props.wikiPage}
        icon={<Article />}
        refetch={props.refetch}
        href={getAbsoluteUrl(`/backstage/wiki/${props.wikiPage.slug}`)}
        title={props.wikiPage.slug}
        credits={[
            props.wikiPage.createdAt && <DateValue key="createdAt" value={props.wikiPage.createdAt} format={(dateStr) => `Created on ${dateStr}`} />,
            props.wikiPage.createdByUser && <UserChip key="createdByUser" value={props.wikiPage.createdByUser} />
        ]}
        bodyContent={
            <CMChipContainer className="wikiTags">
                {props.wikiPage.tags?.map(tagAssignment => (
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
        }
    />
};
