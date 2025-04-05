import { BlitzPage, useRouterQuery } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import getWikiPageRevisions from "src/core/wiki/queries/getWikiPageRevisions";
export type EnrichedVerboseUser = db3.EnrichedUser<db3.UserPayload>;

const WikiRevisionHistoryPageContent = () => {
    const canonicalWikiPath = (useRouterQuery()["path"] || "") as string;
    const [pageWithRevisions, qExtra] = useQuery(getWikiPageRevisions, { canonicalWikiPath });
    return <div>
        <h1>Wiki Page Revision History</h1>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "row" }}>
                <div style={{ flexGrow: 1 }}><strong>Page:</strong> {pageWithRevisions?.currentRevision?.name || pageWithRevisions?.slug}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row" }}>
                <div style={{ flexGrow: 1 }}>
                    <strong>Updated by:</strong>
                    {pageWithRevisions?.currentRevision?.createdByUserId}
                    {pageWithRevisions?.revisions.map((rev) => {
                        return <div key={rev.id} style={{ display: "flex", flexDirection: "row" }}>
                            <div style={{ flexGrow: 1 }}>
                                <strong>{rev.name}</strong> by {rev.createdByUserId} on {rev.createdAt.toString()}
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <strong>Revision ID:</strong> {rev.id}
                            </div>
                        </div>;
                    })}
                </div>
            </div>
        </div>
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const WikiPageHistoryPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Wiki revision history" basePermission={Permission.view_wiki_pages}>
            <WikiRevisionHistoryPageContent {...props} />
        </DashboardLayout>
    )
}

export default WikiPageHistoryPage;
