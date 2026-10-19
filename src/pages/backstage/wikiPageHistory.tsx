import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { defineCmdbPage } from "src/route/cmdbPage";
import { useCmdbRouter } from "src/route/useCmdbRouter";
import { Alert } from "@mui/material";
import { useLocale } from "src/locale/components/useLocale";
import { CMLink } from "@/src/route/CMLink";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { UserChip } from "@/src/core/components/user/userChip";
import { BlitzPage, useRouterQuery } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Tooltip } from "@mui/material";
import React, { Suspense } from "react";
import ReactDiffViewer from 'react-diff-viewer';
import { toSorted } from "shared/arrayUtils";
import type { WikiPageRevisionPublicId } from "shared/publicId";
import { CalcRelativeTiming, DateTimeRange } from "shared/time";
import { CMDialog } from "src/core/components/CMDialog";
import { CMButton, CMSmallButton } from "src/core/components/CMCoreComponents2";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useMessageBox } from "src/core/components/MessageBoxContext";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { gIconMap } from "src/core/db3/components/IconMap";
import deleteWikiRevision from "src/core/wiki/mutations/deleteWikiRevision";
import rebuildWikiPageRevisionStats from "src/core/wiki/mutations/rebuildWikiPageRevisionStats";
import getWikiPageRevision from "src/core/wiki/queries/getWikiPageRevision";
import getWikiPageRevisions from "src/core/wiki/queries/getWikiPageRevisions";
import { wikiParseCanonicalWikiPath } from "src/core/wiki/shared/wikiUtils";

type RevisionHistoryItem = NonNullable<
    NonNullable<Awaited<ReturnType<typeof getWikiPageRevisions>>>["revisions"]
>[number];

interface WikiDiffViewerProps {
    revisionIdLeft: WikiPageRevisionPublicId | null;
    revisionIdRight: WikiPageRevisionPublicId;
};

const WikiDiffViewer = (props: WikiDiffViewerProps) => {
    const dashboard = useDashboardContext();
    const bandPublicId = dashboard.requireBandPublicId();
    const [left, leftX] = useQuery(getWikiPageRevision, { bandPublicId, revisionId: props.revisionIdLeft });
    const [right, rightX] = useQuery(getWikiPageRevision, { bandPublicId, revisionId: props.revisionIdRight });

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

const WikiRevisionPreviewDialog = (props: { revisionId: WikiPageRevisionPublicId, onClose: () => void }) => {
    const dashboard = useDashboardContext();
    const bandPublicId = dashboard.requireBandPublicId();
    const [revision, revisionX] = useQuery(getWikiPageRevision, { bandPublicId, revisionId: props.revisionId });
    return <CMDialog
        open
        onClose={props.onClose}
        title={<>Previewing {revision?.name} @ {revision?.createdAt.toLocaleString()}</>}
        actions={<CMButton onClick={props.onClose}>Close</CMButton>}
        onKeyDown={event => {
            if (event.key === "Enter") {
                event.preventDefault();
                props.onClose();
            }
        }}
    >
        <Markdown markdown={revision?.content || ""} />
    </CMDialog>;
};

const WikiRevisionPreviewButton = (props: { revisionId: WikiPageRevisionPublicId }) => {
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

const WikiRevisionDeleteButton = (props: { revision: RevisionHistoryItem, onChanged: () => void }) => {
    const dashboard = useDashboardContext();
    const bandPublicId = dashboard.requireBandPublicId();
    const messageBox = useMessageBox();
    const snackbar = useSnackbar();
    const [deleteMutation] = useMutation(deleteWikiRevision);

    const handleClickDelete = async () => {
        if ("yes" === await messageBox.showMessage({
            message: `Are you sure you want to delete the revision "${props.revision.name}" from ${props.revision.createdAt.toLocaleString()}?`,
            buttons: ["yes", "cancel"]
        })) {
            await snackbar.invokeAsync(async () => {
                await deleteMutation({ bandPublicId, revisionId: props.revision.publicId });
                props.onChanged();
            });
        }
    };
    return <CMSmallButton onClick={handleClickDelete} >Delete this revision</CMSmallButton>
};

const RebuildStatsButton = (props: { onChanged: () => void }) => {
    const dashboard = useDashboardContext();
    const bandPublicId = dashboard.requireBandPublicId();
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
            await rebuildStats({ bandPublicId });
            props.onChanged();
        });
    };
    return <CMButton onClick={handleClick}>Rebuild all stats</CMButton>;
};

const WikiRevisionHistoryPageContent = () => {
    const cmdbRouter = useCmdbRouter();
    const canonicalWikiPath = (useRouterQuery()["path"] || "") as string;
    const wikiPath = wikiParseCanonicalWikiPath(canonicalWikiPath);
    const dashboardContext = useDashboardContext();
    const [pageWithRevisions, qExtra] = useQuery(getWikiPageRevisions, { bandPublicId: dashboardContext.requireBandPublicId(), canonicalWikiPath });
    if (!pageWithRevisions || !pageWithRevisions.currentRevision) {
        return <div>Page not found</div>;
    }

    const currentRevision = pageWithRevisions.currentRevision!;
    const revisions = toSorted(pageWithRevisions?.revisions || [], (a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const [selectedRevisionA, setSelectedRevisionA] = React.useState<RevisionHistoryItem | null>(null);
    const [selectedRevisionB, setSelectedRevisionB] = React.useState<RevisionHistoryItem>(currentRevision);

    return <div className="contentSection fullWidth wikiRevisionHistoryPage">
        {dashboardContext.isAuthorized(BandPermission.admin_wiki_pages) && <RebuildStatsButton onChanged={() => {
            void qExtra.refetch();
        }} />}
        <h1>
            <CMLink href={cmdbRouter.href(wikiPath.uriRelativeToHost)} rel="noreferrer">{currentRevision.name || pageWithRevisions.slug}</CMLink>
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
                    const timing = CalcRelativeTiming(
                        new Date(),
                        new DateTimeRange({
                            startsAtDateTime: rev.createdAt,
                            isAllDay: false,
                            durationMillis: 0,
                        }),
                        dashboardContext.eventDatePresentation // this function is kinda being co-opted; band's tz is not really relevant here but easier to reuse CalcRelativeTiming for this too.
                    );
                    const timeLabel = rev.createdAt.toLocaleString();
                    return <tr
                        key={rev.publicId}
                        className={`revisionItem ${rev.publicId === selectedRevisionA?.publicId ? "selected selectedA" : ""} ${rev.publicId === selectedRevisionB?.publicId ? "selected selectedB" : ""}`}
                    >
                        <td>
                            <WikiRevisionPreviewButton revisionId={rev.publicId} />
                            {rev.publicId !== currentRevision.publicId && dashboardContext.isAuthorized(BandPermission.admin_wiki_pages) && <WikiRevisionDeleteButton revision={rev} onChanged={() => {
                                void qExtra.refetch();
                            }} />}
                        </td>
                        <td>
                            <CMSmallButton onClick={() => setSelectedRevisionA(rev)} >Left</CMSmallButton>
                            <CMSmallButton onClick={() => setSelectedRevisionB(rev)} >Right</CMSmallButton>
                            <CMSmallButton
                                style={{ visibility: rev.publicId === currentRevision.publicId ? "hidden" : "visible" }}
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
                            <UserChip value={rev.createdByUser ?? null} />
                        </td>
                        <td>
                            <Tooltip title={<div>{timeLabel} -- {rev.consolidationKey}</div>} disableInteractive><span>{timeLabel} {timing.label}</span></Tooltip>
                            {rev.publicId === currentRevision.publicId ? <i>(Current version)</i> : ""}
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
                        revisionIdLeft={selectedRevisionA?.publicId || null}
                        revisionIdRight={selectedRevisionB.publicId}
                    />
                </Suspense>
            </div>
        </div>
    </div>
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// these "band context" component wrappers can  probably just be unified.
const WikiHistoryBandContent = () => {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const band = dashboard.memberPresentation.bandPublicId;
    if (!band) {
        return <Alert severity="info">{locale.getPlainString("wiki.selectBand")}</Alert>;
    }
    return <WikiRevisionHistoryPageContent key={band} />;
};

const WikiPageHistoryPage: BlitzPage = () => (
    <DashboardLayout title="Wiki revision history">
        <WikiHistoryBandContent />
    </DashboardLayout>
);

defineCmdbPage("bandWikiPageHistory", WikiPageHistoryPage);
export default WikiPageHistoryPage;
