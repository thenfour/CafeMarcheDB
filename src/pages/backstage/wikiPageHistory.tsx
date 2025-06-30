import { CMLink } from "@/src/core/components/CMLink";
import { BlitzPage, useRouterQuery } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button, DialogContent, DialogTitle, Tooltip } from "@mui/material";
import { Prisma } from "db";
import React, { Suspense } from "react";
import ReactDiffViewer from 'react-diff-viewer';
import { toSorted } from "shared/arrayUtils";
import { Permission } from "shared/permissions";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { CMSmallButton, DialogActionsCM } from "src/core/components/CMCoreComponents2";
import { useMessageBox } from "src/core/components/context/MessageBoxContext";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown } from "src/core/components/markdown/Markdown";
import { ReactiveInputDialog } from "src/core/components/ReactiveInputDialog";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { UserChip } from "src/core/components/userChip";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import deleteWikiRevision from "src/core/wiki/mutations/deleteWikiRevision";
import rebuildWikiPageRevisionStats from "src/core/wiki/mutations/rebuildWikiPageRevisionStats";
import getWikiPageRevision from "src/core/wiki/queries/getWikiPageRevision";
import getWikiPageRevisions from "src/core/wiki/queries/getWikiPageRevisions";
import { wikiParseCanonicalWikiPath } from "src/core/wiki/shared/wikiUtils";

export type EnrichedVerboseUser = db3.EnrichedUser<db3.UserPayload>;

interface WikiDiffViewerProps {
    revisionIdLeft: number | null;
    revisionIdRight: number;
};

const WikiDiffViewer = (props: WikiDiffViewerProps) => {
    const [left, leftX] = useQuery(getWikiPageRevision, { revisionId: props.revisionIdLeft });
    const [right, rightX] = useQuery(getWikiPageRevision, { revisionId: props.revisionIdRight });

    return <ReactDiffViewer
        styles={{
            wordDiff: {
                padding: "0",
            },
            splitView: {
                margin: "0",
                fontSize: "13px",
            }
        }}
        oldValue={left?.content || ""}
        newValue={right?.content || ""}
        splitView={true}
        leftTitle={left ? `"${left?.name}" ${left?.createdAt.toLocaleString()}` : ""}
        rightTitle={`"${right?.name}" ${right?.createdAt.toLocaleString()}`}
        hideLineNumbers={true}
    />;
};

const WikiRevisionPreviewDialog = (props: { revisionId: number, onClose: () => void }) => {
    const [revision, revisionX] = useQuery(getWikiPageRevision, { revisionId: props.revisionId });
    return <ReactiveInputDialog onCancel={props.onClose} defaultAction={props.onClose}>
        <DialogTitle>Previewing {revision?.name} @ {revision?.createdAt.toLocaleString()}</DialogTitle>
        <DialogContent>
            <Markdown markdown={revision?.content || ""} />
            <DialogActionsCM>
                <Button onClick={props.onClose} color="primary">
                    Close
                </Button>
            </DialogActionsCM>
        </DialogContent>
    </ReactiveInputDialog>;
};

const WikiRevisionPreviewButton = (props: { revisionId: number }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return <>
        <CMSmallButton onClick={() => setIsOpen(!isOpen)}>
            <span>{gIconMap.Visibility()}</span>
        </CMSmallButton>
        <Suspense>
            {isOpen && <WikiRevisionPreviewDialog revisionId={props.revisionId} onClose={() => setIsOpen(false)} />}
        </Suspense>
    </>;
};

const WikiRevisionDeleteButton = (props: { revision: Prisma.WikiPageRevisionGetPayload<{}>, onChanged: () => void }) => {
    const messageBox = useMessageBox();
    const snackbar = useSnackbar();
    const [deleteMutation] = useMutation(deleteWikiRevision);

    const handleClickDelete = async () => {
        if ("yes" === await messageBox.showMessage({
            message: `Are you sure you want to delete the revision "${props.revision.name}" from ${props.revision.createdAt.toLocaleString()}?`,
            buttons: ["yes", "cancel"]
        })) {
            await snackbar.invokeAsync(async () => {
                await deleteMutation({ revisionId: props.revision.id });
            });
        }
    };
    return <CMSmallButton onClick={handleClickDelete} >Delete this revision</CMSmallButton>
};

const RebuildStatsButton = (props: { onChanged: () => void }) => {
    const snackbar = useSnackbar();
    const messageBox = useMessageBox();
    const [rebuildStats] = useMutation(rebuildWikiPageRevisionStats);
    const handleClick = async () => {
        if ("yes" !== await messageBox.showMessage({
            message: "Are you sure you want to rebuild all wiki page stats?",
            buttons: ["yes", "cancel"]
        })) {
            return;
        }
        await snackbar.invokeAsync(async () => {
            await rebuildStats({});
            props.onChanged();
        });
    };
    return <Button onClick={handleClick}>Rebuild all stats</Button>;
};

const WikiRevisionHistoryPageContent = () => {
    const canonicalWikiPath = (useRouterQuery()["path"] || "") as string;
    const wikiPath = wikiParseCanonicalWikiPath(canonicalWikiPath);
    const dashboardContext = useDashboardContext();
    const [pageWithRevisions, qExtra] = useQuery(getWikiPageRevisions, { canonicalWikiPath });
    if (!pageWithRevisions || !pageWithRevisions.currentRevision) {
        return <div>Page not found</div>;
    }

    const currentRevision = pageWithRevisions.currentRevision!;
    const revisions = toSorted(pageWithRevisions?.revisions || [], (a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const [selectedRevisionA, setSelectedRevisionA] = React.useState<Prisma.WikiPageRevisionGetPayload<{}> | null>(null);
    const [selectedRevisionB, setSelectedRevisionB] = React.useState<Prisma.WikiPageRevisionGetPayload<{}>>(currentRevision);

    return <div className="contentSection fullWidth wikiRevisionHistoryPage">
        {dashboardContext.isAuthorized(Permission.admin_wiki_pages) && <RebuildStatsButton onChanged={() => {
            void qExtra.refetch();
        }} />}
        <h1>
            <CMLink href={wikiPath.uriRelativeToHost} rel="noreferrer">{currentRevision.name || pageWithRevisions.slug}</CMLink>
        </h1>
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Compare</th>
                    <th>Changed lines</th>
                    <th>User</th>
                    <th>When</th>
                </tr>
            </thead>
            <tbody>
                {revisions.map((rev, index) => {
                    // find the prev revision (the next in the array)
                    const prevRev = revisions[index + 1] || null;
                    const timing = CalcRelativeTiming(new Date(), new DateTimeRange({ startsAtDateTime: rev.createdAt, isAllDay: false, durationMillis: 0 }));
                    const timeLabel = rev.createdAt.toLocaleString();
                    return <tr
                        key={rev.id}
                        className={`revisionItem ${rev.id === selectedRevisionA?.id ? "selected selectedA" : ""} ${rev.id === selectedRevisionB?.id ? "selected selectedB" : ""}`}
                    >
                        <td>
                            <WikiRevisionPreviewButton revisionId={rev.id} />
                            {dashboardContext.isAuthorized(Permission.admin_wiki_pages) && <WikiRevisionDeleteButton revision={rev} onChanged={() => {
                                void qExtra.refetch();
                            }} />}
                        </td>
                        <td>
                            <CMSmallButton onClick={() => setSelectedRevisionA(rev)} >Left</CMSmallButton>
                            <CMSmallButton onClick={() => setSelectedRevisionB(rev)} >Right</CMSmallButton>
                            <CMSmallButton
                                style={{ visibility: rev.id === currentRevision.id ? "hidden" : "visible" }}
                                onClick={() => {
                                    setSelectedRevisionA(rev);
                                    setSelectedRevisionB(currentRevision);
                                }}
                            >
                                Compare with current
                            </CMSmallButton>
                            <CMSmallButton onClick={() => {
                                setSelectedRevisionA(prevRev);
                                setSelectedRevisionB(rev);
                            }}>
                                Compare with prev
                            </CMSmallButton>
                        </td>
                        <td>
                            <Tooltip title={
                                <div>
                                    {(rev.linesAdded || rev.linesRemoved) && <div className="changeStatsRow">
                                        {rev.linesRemoved ? <span className="removed">-{rev.linesRemoved}</span> : ""}
                                        {rev.linesAdded ? <span className="added">+{rev.linesAdded}</span> : ""}
                                        lines
                                    </div>}
                                    {(rev.charsAdded || rev.charsRemoved) && <div className="changeStatsRow">
                                        {rev.charsRemoved ? <span className="removed">-{rev.charsRemoved}</span> : ""}
                                        {rev.charsAdded ? <span className="added">+{rev.charsAdded}</span> : ""}
                                        chars
                                    </div>}
                                    <div className="changeStatsRow">
                                        {rev.sizeChars ? <>{rev.sizeChars?.toLocaleString()} chars</> : ""}
                                    </div>
                                </div>
                            } disableInteractive>
                                <div>
                                    {(rev.linesAdded || rev.linesRemoved) && <div className="changeStatsRow">
                                        {rev.linesRemoved ? <span className="removed">-{rev.linesRemoved}</span> : ""}
                                        {rev.linesAdded ? <span className="added">+{rev.linesAdded}</span> : ""}
                                    </div>}
                                </div>
                            </Tooltip>
                        </td>
                        <td>
                            <UserChip userId={rev.createdByUserId} />
                        </td>
                        <td>
                            <Tooltip title={<div>{timeLabel} -- {rev.consolidationKey}</div>} disableInteractive><span>{timeLabel} {timing.label}</span></Tooltip>
                            {rev.id === currentRevision.id ? <i>(Current version)</i> : ""}
                        </td>
                    </tr>;
                })}
            </tbody>
        </table>
        <div className="WikiRevisionDiffContainer">
            <div className="header">Comparing 2 versions:</div>
            <div className="diffContainer">
                <Suspense>
                    <WikiDiffViewer
                        revisionIdLeft={selectedRevisionA?.id || null}
                        revisionIdRight={selectedRevisionB.id}
                    />
                </Suspense>
            </div>
        </div>
    </div>
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const WikiPageHistoryPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Wiki revision history" basePermission={Permission.view_wiki_page_revisions}>
            <WikiRevisionHistoryPageContent {...props} />
        </DashboardLayout>
    )
}

export default WikiPageHistoryPage;
