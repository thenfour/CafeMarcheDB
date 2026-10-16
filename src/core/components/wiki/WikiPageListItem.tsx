import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { Article } from "@mui/icons-material";
import { CMChipContainer, CMStandardDBChip } from "src/core/components/CMChip";
import * as db3 from "src/core/db3/db3";
import { SearchResultsRet } from "src/core/db3/shared/apiTypes";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
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
    const dashboardContext = useDashboardContext();
    const router = useCmdbRouter();

    const wikiUrl = router.getAbsoluteUri(router.href(`/backstage/wiki/${wikiPage.slug}`));
    //const visInfo = dashboardContext.getVisibilityInfo(wikiPage);

    return <GenericSearchListItem<EnrichedVerboseWikiPage>
        index={props.index}
        item={props.wikiPage}
        icon={<Article />}
        refetch={props.refetch}
        href={wikiUrl}
        title={props.wikiPage.slug}
        credits={[
            props.wikiPage.createdAt && <DateValue
                key="createdAt"
                value={props.wikiPage.createdAt}
                formattingLocale={dashboardContext.formattingLocale}
                timeZone={dashboardContext.localTimeZone}
                format={(dateStr) => `Created on ${dateStr}`} />,
            props.wikiPage.createdByUser && <UserChip key="createdByUser" value={props.wikiPage.createdByUser} />
        ]}
        bodyContent={
            <CMChipContainer className="wikiTags">
                {props.wikiPage.tags?.map(tagAssignment => (
                    <CMStandardDBChip
                        key={db3.xWikiPageTagAssignment.getIdentity(tagAssignment)}
                        size="small"
                        model={tagAssignment.tag}
                        getText={tag => tag?.name ?? ""}
                        variation={{
                            ...StandardVariationSpec.Weak,
                            selected: props.filterSpec.tagFilter.options.includes(
                                db3.xBandWikiPageTag.getIdentity(tagAssignment.tag),
                            )
                        }}
                        getTooltip={() => tagAssignment.tag.description}
                    />
                )) || []}
            </CMChipContainer>
        }
    />
};
