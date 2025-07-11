import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { StandardVariationSpec } from "shared/color";
import * as db3 from "src/core/db3/db3";
import { API } from '../../db3/clientAPI';
import getUserCredits from "../../db3/queries/getUserCredits";
import getUserEventAttendance from "../../db3/queries/getUserEventAttendance";
import getUserMassAnalysis from "../../db3/queries/getUserMassAnalysis";
import getUserWikiContributions from "../../db3/queries/getUserWikiContributions";
import { CMChip, CMChipContainer } from "../CMChip";
import { AttendanceChip, InstrumentChip, SongChip } from "../CMCoreComponents";
import { AdminInspectObject, KeyValueTable } from "../CMCoreComponents2";
import { CMLink } from "../CMLink";
import { CMTable } from "../CMTable";
import { useDashboardContext } from "../DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { EventChip } from "../event/EventChips";
import { Markdown } from "../markdown/Markdown";
import { useSongsContext } from "../song/SongsContext";
import { AddUserButton } from "./UserComponents";
import { CompareArrows } from "@mui/icons-material";
import { SettingMarkdown } from "../SettingMarkdown";
import { UserChip } from "./userChip";

////////////////////////////////////////////////////////////////
type UserAttendanceTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserAttendanceTabContent = (props: UserAttendanceTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [take, setTake] = React.useState<number>(50);

    const [qr, refetch] = useQuery(getUserEventAttendance, { userId: props.user.id, take });
    const agg = qr.events.reduce((acc, event) => {
        const segAgg = event.segments.reduce((segAcc, seg) => {
            const hasResponse = seg.attendanceId != null;
            const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
            return {
                responseCount: segAcc.responseCount + (hasResponse ? 1 : 0),
                goingCount: segAcc.goingCount + ((att?.strength || 0) > 50 ? 1 : 0),
            };
        }, { responseCount: 0, goingCount: 0 });
        return {
            totalSegmentCount: acc.totalSegmentCount + event.segments.length,
            responseCount: acc.responseCount + segAgg.responseCount,
            goingCount: acc.goingCount + segAgg.goingCount,
        };
    }, { totalSegmentCount: 0, responseCount: 0, goingCount: 0 });

    const sortedQr = API.events.sortEvents(qr.events);
    const sortedQrWithIndex = sortedQr.map((event, index) => ({
        ...event,
        index: index + 1, // add an index for display purposes
    }));

    return <div className="UserAttendanceTabContent">
        <AdminInspectObject src={qr} label="results" />


        {agg.totalSegmentCount > 0 &&
            <KeyValueTable data={{
                "Show": <CMChipContainer>
                    <CMChip shape="rectangle" size="small" variation={{ ...StandardVariationSpec.Strong, selected: take === 50 }} onClick={() => setTake(50)}>50</CMChip>
                    <CMChip shape="rectangle" size="small" variation={{ ...StandardVariationSpec.Strong, selected: take === 100 }} onClick={() => setTake(100)}>100</CMChip>
                    <CMChip shape="rectangle" size="small" variation={{ ...StandardVariationSpec.Strong, selected: take === 250 }} onClick={() => setTake(250)}>250</CMChip>
                    <CMChip shape="rectangle" size="small" variation={{ ...StandardVariationSpec.Strong, selected: take === 500 }} onClick={() => setTake(500)}>500</CMChip>
                    <CMChip shape="rectangle" size="small" variation={{ ...StandardVariationSpec.Strong, selected: take === 1000 }} onClick={() => setTake(1000)}>1000</CMChip>
                    <span>items</span>
                </CMChipContainer>,
                ...agg,
                "Response rate": <>{(agg.responseCount * 100 / agg.totalSegmentCount).toFixed(1)}%</>,
                "Attendance rate (overall)": <>{(agg.goingCount * 100 / agg.totalSegmentCount).toFixed(1)}%</>,
                "Attendance rate (when responding)": <>{(agg.goingCount * 100 / agg.responseCount).toFixed(1)}%</>,
            }} />}

        <CMTable
            className="userAttendanceTable"
            getRowStyle={(row) => {
                const now = new Date();
                const eventDate = row.row.startsAt ? new Date(row.row.startsAt) : null;
                const month = eventDate ? eventDate.getMonth() : 0;
                let isFuture = !eventDate || eventDate > now;
                // Past color scheme
                const pastColors = ["#fff", "#f7f7f7"];
                // Future color scheme
                const futureColors = ["#e6f7ff", "#d0ebff"];
                const colorSet = isFuture ? futureColors : pastColors;
                return {
                    backgroundColor: colorSet[month % 2],
                }
            }}
            rows={sortedQrWithIndex} columns={[
                {
                    allowSort: true,
                    memberName: "index",
                    render: (row) => {
                        return <span className="pre">#{row.row.index}</span>;
                    }
                },
                {
                    allowSort: false,
                    header: "Event",
                    //render: (row) => <EventTextLink event={row.row} />,
                    render: (row) => <EventChip value={row.row} size="small" showDate={false} />,
                    compareFn: (a, b) => {
                        const aName = a.name || "";
                        const bName = b.name || "";
                        return aName.localeCompare(bName);
                    },
                },
                {
                    allowSort: true,
                    memberName: "startsAt",
                    header: "Date",
                    render: (row) => {
                        return <DateValue value={row.row.startsAt} />;
                    }
                },
                {
                    allowSort: true,
                    memberName: "instrumentId",
                    header: "Instrument",
                    render: (row) => {
                        const inst = dashboardContext.instrument.getById(row.row.instrumentId);
                        return inst ? <InstrumentChip size="small" value={inst} /> : <span>--</span>;
                    },
                    compareFn: (a, b) => {
                        const aInst = dashboardContext.instrument.getById(a.instrumentId);
                        const bInst = dashboardContext.instrument.getById(b.instrumentId);
                        const aName = aInst ? aInst.name : "";
                        const bName = bInst ? bInst.name : "";
                        return aName.localeCompare(bName);
                    }

                },
                {
                    allowSort: false,
                    header: "Response(s)",
                    render: (row) => {
                        const segs = API.events.sortEvents(row.row.segments);
                        return <CMChipContainer>
                            {segs.map(seg => {
                                const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
                                return <AttendanceChip
                                    key={seg.id}
                                    size={"small"}
                                    fadeNoResponse={true}
                                    showLabel={false}
                                    value={att}

                                    event={row.row}
                                    eventSegment={seg}
                                // todo: eventSegmentResponse and eventResponse.
                                />
                            })}
                        </CMChipContainer>;
                    }
                },
                {
                    allowSort: true,
                    memberName: "userComment",
                    header: "Comments",
                    render: (row) => <Markdown markdown={row.row.userComment || ""} />,
                }
            ]} />

    </div>;
};


////////////////////////////////////////////////////////////////
type UserCreditsTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserCreditsTabContent = (props: UserCreditsTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const allSongs = useSongsContext().songs;
    const [qr, refetch] = useQuery(getUserCredits, { userId: props.user.id, take: 100 });

    const songCreditsWithAddl = qr.songCredits.map((credit, index) => ({
        ...credit,
        rowIndex: index,
        songYear: allSongs.find(s => s.id === credit.songId)?.introducedYear,
        songName: allSongs.find(s => s.id === credit.songId)?.name || `#${credit.songId}`,
    }));

    return <CMTable
        rows={songCreditsWithAddl}
        columns={[
            {
                header: "#",
                allowSort: false,
                memberName: "rowIndex",
                render: (row) => {
                    return <span className="pre">#{row.rowIndex + 1}</span>;
                },
            },
            {
                header: "Song",
                memberName: "songName",
                allowSort: true,
                render: (row) => {
                    return <SongChip value={allSongs.find(s => s.id === row.row.songId) || { id: row.row.songId, name: `#${row.row.songId}` }} />;
                },
            },
            {
                header: "Song year",
                allowSort: true,
                memberName: "songYear",
                render: (row) => {
                    const song = allSongs.find(s => s.id === row.row.songId)!;
                    return <span>{song?.introducedYear}</span>;
                },
            },
            {
                header: "Credit type",
                memberName: "typeId",
                render: (row) => {
                    return <span>{dashboardContext.songCreditType.getById(row.row.typeId)?.text}</span>;
                },
            },
            {
                header: "Credit year",
                memberName: "year",
            },
            {
                memberName: "comment",
                render: (row) => {
                    return <Markdown markdown={row.row.comment} />;
                }
            }
        ]}
    />;
};


////////////////////////////////////////////////////////////////
type UserWikiContributionsTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserWikiContributionsTabContent = (props: UserWikiContributionsTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [qr, refetch] = useQuery(getUserWikiContributions, { userId: props.user.id });

    const wikiContributionsWithAddl = qr.wikiContributions.map((contribution, index) => ({
        ...contribution,
        rowIndex: index,
        totalRevisions: contribution.revisions.length,
        lastRevisionDate: contribution.revisions[0]?.createdAt,
        firstRevisionDate: contribution.revisions[contribution.revisions.length - 1]?.createdAt,
    }));

    return <div className="UserWikiContributionsTabContent">
        <AdminInspectObject src={qr} label="wiki contributions" />

        <CMTable
            rows={wikiContributionsWithAddl}
            columns={[
                {
                    header: "#",
                    allowSort: false,
                    memberName: "rowIndex",
                    render: (row) => {
                        return <span className="pre">#{row.rowIndex + 1}</span>;
                    },
                },
                {
                    header: "Wiki Page",
                    memberName: "slug",
                    allowSort: true,
                    render: (row) => {
                        return <CMLink href={`/backstage/wiki/${row.row.slug}`}>{row.row.slug}</CMLink>;
                    },
                },
                {
                    header: "Revisions",
                    memberName: "totalRevisions",
                    allowSort: true,
                    render: (row) => {
                        return <span>{row.row.totalRevisions}</span>;
                    },
                    valueBar: {
                        getValue: (row) => row.totalRevisions,
                    }
                }, {
                    header: "First Contribution",
                    memberName: "firstRevisionDate",
                    allowSort: true,
                    render: (row) => {
                        if (!row.row.firstRevisionDate) return <span>-</span>;
                        const date = new Date(row.row.firstRevisionDate);
                        return <span>{date.toLocaleDateString()}</span>;
                    },
                },
                {
                    header: "Last Contribution",
                    memberName: "lastRevisionDate",
                    allowSort: true,
                    render: (row) => {
                        if (!row.row.lastRevisionDate) return <span>-</span>;
                        const date = new Date(row.row.lastRevisionDate);
                        return <span>{date.toLocaleDateString()}</span>;
                    },
                },
            ]}
        />
    </div>;
};

////////////////////////////////////////////////////////////////
type UserMassAnalysisTabContentProps = {
    user: db3.EnrichedVerboseUser;
};

export const UserMassAnalysisTabContent = (props: UserMassAnalysisTabContentProps) => {
    const [qr, refetch] = useQuery(getUserMassAnalysis, { userId: props.user.id });
    const [compareWithUser, setCompareWithUser] = React.useState<db3.UserPayload | null>(null);

    const getRiskColor = (level: 'low' | 'medium' | 'high') => {
        switch (level) {
            case 'low': return '#28a745';
            case 'medium': return '#ffc107';
            case 'high': return '#dc3545';
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString();
    };

    const totalContentItems = Object.values(qr.contentCounts).reduce((sum, count) => sum + count, 0);
    const totalParticipationItems = Object.values(qr.participationCounts).reduce((sum, count) => sum + count, 0);
    const totalSystemItems = Object.values(qr.systemCounts).reduce((sum, count) => sum + count, 0);

    return <div className="UserMassAnalysisTabContent">
        <AdminInspectObject src={qr} label="mass analysis" />

        <div style={{ display: 'flex', margin: 10 }}>
            <AddUserButton
                onSelect={setCompareWithUser}
                buttonChildren={<><CompareArrows /> Compare with user...</>}
                title={"Compare with user"}
            />
            <UserChip value={compareWithUser} />
        </div>

        {/* Risk Assessment */}
        <div style={{
            marginBottom: '20px',
            padding: '15px',
            border: `2px solid ${getRiskColor(qr.riskAssessment.riskLevel)}`,
            borderRadius: '8px',
            backgroundColor: `${getRiskColor(qr.riskAssessment.riskLevel)}20`
        }}>
            <h3 style={{ color: getRiskColor(qr.riskAssessment.riskLevel), margin: '0 0 10px 0' }}>
                Risk Assessment: {qr.riskAssessment.riskLevel.toUpperCase()}
            </h3>
            <div style={{ marginBottom: '10px' }}>
                <strong>Safe to Delete:</strong> {qr.riskAssessment.safeToDelete ? '✅ Yes' : '❌ No'}
            </div>

            {qr.riskAssessment.blockers.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <strong>Blockers:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        {qr.riskAssessment.blockers.map((blocker, index) => (
                            <li key={index} style={{ color: '#dc3545' }}>{blocker}</li>
                        ))}
                    </ul>
                </div>
            )}

            {qr.riskAssessment.warnings.length > 0 && (
                <div>
                    <strong>Warnings:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        {qr.riskAssessment.warnings.map((warning, index) => (
                            <li key={index} style={{ color: '#856404' }}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>

        {/* Summary Statistics */}
        <KeyValueTable data={{
            "Total Content Items": totalContentItems,
            "Total Participation Items": totalParticipationItems,
            "Total System Items": totalSystemItems,
            "Account Age": `${qr.activityMetrics.accountAgeInDays} days`,
            "Has Ever Logged In": qr.activityMetrics.hasEverLoggedIn ? 'Yes' : 'No',
            "Last Activity": formatDate(qr.activityMetrics.lastActivityDate),
            "Days Since Last Activity": qr.activityMetrics.daysSinceLastActivity || 'Unknown',
        }} />

        {/* Content Creation Details */}
        {totalContentItems > 0 && (
            <div style={{ marginTop: '20px' }}>
                <h4>Content Created</h4>
                <CMTable
                    rows={Object.entries({
                        "Songs": qr.contentCounts.createdSongs,
                        "Events": qr.contentCounts.createdEvents,
                        "Wiki Pages": qr.contentCounts.createdWikiPages,
                        "Gallery Items": qr.contentCounts.createdGalleryItems,
                        "Uploaded Files": qr.contentCounts.uploadedFiles,
                        "Menu Links": qr.contentCounts.createdMenuLinks,
                        "Custom Links": qr.contentCounts.createdCustomLinks,
                        "Song Credits": qr.contentCounts.songCredits,
                        "Setlist Plans": qr.contentCounts.setlistPlans,
                        "Wiki Revisions": qr.contentCounts.wikiPageRevisions,
                    })}
                    columns={[
                        {
                            header: "Content Type",
                            memberName: "0",
                            render: (row) => <span>{row.row[0]}</span>,
                        },
                        {
                            header: "Count",
                            memberName: "1",
                            render: (row) => <span>{row.row[1].toLocaleString()}</span>,
                            valueBar: {
                                getValue: (row) => row[1],
                            },
                        }
                    ]}
                />
            </div>
        )}

        {/* Participation Details */}
        {totalParticipationItems > 0 && (
            <div style={{ marginTop: '20px' }}>
                <h4>Participation & Engagement</h4>
                <CMTable
                    rows={Object.entries({
                        "Event Responses": qr.participationCounts.eventResponses,
                        "Event Segment Responses": qr.participationCounts.eventSegmentResponses,
                        "Workflow Assignments": qr.participationCounts.workflowAssignments,
                        "Workflow Log Items": qr.participationCounts.workflowLogItems,
                        "Tagged Files": qr.participationCounts.taggedFiles,
                        "Instruments": qr.participationCounts.instruments,
                        "User Tags": qr.participationCounts.userTags,
                    })}
                    columns={[
                        {
                            header: "Participation Type",
                            memberName: "0",
                            render: (row) => <span>{row.row[0]}</span>,
                        },
                        {
                            header: "Count",
                            memberName: "1",
                            render: (row) => <span>{row.row[1].toLocaleString()}</span>,
                            valueBar: {
                                getValue: (row) => row[1],
                            },
                        }
                    ]}
                />
            </div>
        )}

        {/* System Data */}
        {totalSystemItems > 0 && (
            <div style={{ marginTop: '20px' }}>
                <h4>System Data</h4>
                <CMTable
                    rows={Object.entries({
                        "Actions": qr.systemCounts.actions,
                        "Sessions": qr.systemCounts.sessions,
                        "Tokens": qr.systemCounts.tokens,
                        "Changes": qr.systemCounts.changes,
                    })}
                    columns={[
                        {
                            header: "System Item",
                            memberName: "0",
                            render: (row) => <span>{row.row[0]}</span>,
                        },
                        {
                            header: "Count",
                            memberName: "1",
                            render: (row) => <span>{row.row[1].toLocaleString()}</span>,
                            valueBar: {
                                getValue: (row) => row[1],
                            },
                        }
                    ]}
                />
            </div>
        )}

        {/* User Info */}
        <div style={{ marginTop: '20px' }}>
            <h4>User Information</h4>
            <KeyValueTable data={{
                "ID": qr.userInfo.id,
                "Name": qr.userInfo.name,
                "Email": qr.userInfo.email,
                "Role": qr.userInfo.roleName || 'No Role',
                "System Admin": qr.userInfo.isSysAdmin ? 'Yes' : 'No',
                "Is Deleted": qr.userInfo.isDeleted ? 'Yes' : 'No',
                "Google ID": qr.userInfo.googleId ? 'Yes' : 'No',
                "Created": formatDate(qr.userInfo.createdAt),
            }} />
        </div>
    </div>;
};
