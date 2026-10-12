import { withMemberPresentation } from "./bandMemberLinks";
import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { isAttendanceGoing } from "shared/eventAttendance";
import { CalendarDate } from "shared/dateTimePolicy";
import { eventPresentationTimeZone } from "shared/dateTimePresentation";
import { getEventSegmentDateTimeRange } from "src/core/db3/shared/schema/event";
import getUserEventAttendance from "../../db3/queries/getUserEventAttendance";
import getUserWikiContributions from "../../db3/queries/getUserWikiContributions";
import { sortEvents } from "../../db3/shared/apiTypes";
import { CMChip, CMChipContainer } from "../CMChip";
import { InstrumentChip } from "../CMCoreComponents";
import { AdminInspectObject, KeyValueTable } from "../CMCoreComponents2";
import { CMLink } from "../CMLink";
import { CMTable } from "../CMTable";
import { StandardVariationSpec } from "../color/palette";
import { DateValue } from "../DateTime/DateTimeComponents";
import { AttendanceChip } from "../event/AttendanceChips";
import { EventChip } from "../event/EventChips";
import { Markdown } from "../markdown/Markdown";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import type { UserPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import getUserCredits from "../../db3/queries/getUserCredits";
import { memberSongCreditView } from "src/core/db3/shared/entities/song/songViews";
import { SongChip } from "../song/SongChip";

type MemberAnalyticsIdentity = { readonly publicId: UserPublicId };

////////////////////////////////////////////////////////////////
type UserAttendanceTabContentProps = {
    user: MemberAnalyticsIdentity;
};
export const UserAttendanceTabContent = (props: UserAttendanceTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [take, setTake] = React.useState<number>(50);

    const [qr] = useQuery(getUserEventAttendance, { bandPublicId: dashboardContext.requireBandPublicId(), userId: props.user.publicId, take },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const agg = qr.events.reduce((acc, event) => {
        const segAgg = event.segments.reduce((segAcc, seg) => {
            const hasResponse = seg.attendanceId != null;
            const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
            return {
                responseCount: segAcc.responseCount + (hasResponse ? 1 : 0),
                goingCount: segAcc.goingCount + (isAttendanceGoing(att) ? 1 : 0),
            };
        }, { responseCount: 0, goingCount: 0 });
        return {
            totalSegmentCount: acc.totalSegmentCount + event.segments.length,
            responseCount: acc.responseCount + segAgg.responseCount,
            goingCount: acc.goingCount + segAgg.goingCount,
        };
    }, { totalSegmentCount: 0, responseCount: 0, goingCount: 0 });

    const sortedQr = sortEvents(qr.events);
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
                "Attendance rate (when responding)": agg.responseCount > 0 ? <>{(agg.goingCount * 100 / agg.responseCount).toFixed(1)}%</> : <>--</>,
            }} />}

        <CMTable
            className="userAttendanceTable"
            getRowStyle={(row) => {
                const now = new Date();
                const eventDate = row.row.startsAt ? new Date(row.row.startsAt) : null;
                const timeZone = eventPresentationTimeZone(getEventSegmentDateTimeRange(row.row), dashboardContext.eventDatePresentation);
                const month = eventDate ? Number(CalendarDate.fromInstant({ value: eventDate, timeZone }).date.slice(5, 7)) - 1 : 0;
                const isFuture = !eventDate || eventDate > now;
                // Past color scheme
                const pastColors = ["#fff", "#f7f7f7"];
                // Future color scheme
                const futureColors = ["#e6f7ff", "#d0ebff"];
                const colorSet = isFuture ? futureColors : pastColors;
                return {
                    backgroundColor: colorSet[month % 2],
                }
            }}
            rows={sortedQrWithIndex}
            columns={[
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
                        return <DateValue value={row.row.startsAt} formattingLocale={dashboardContext.formattingLocale}
                            timeZone={eventPresentationTimeZone(getEventSegmentDateTimeRange(row.row), dashboardContext.eventDatePresentation)} />;
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
                        const segs = sortEvents(row.row.segments);
                        return <CMChipContainer>
                            {segs.map(seg => {
                                const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
                                return <AttendanceChip
                                    key={seg.publicId}
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
    user: MemberAnalyticsIdentity;
};


////////////////////////////////////////////////////////////////
type UserWikiContributionsTabContentProps = {
    user: MemberAnalyticsIdentity;
};
export const UserWikiContributionsTabContent = (props: UserWikiContributionsTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [qr] = useQuery(getUserWikiContributions, { bandPublicId: dashboardContext.requireBandPublicId(), userId: props.user.publicId },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false });

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
                        return <CMLink href={withMemberPresentation(`/backstage/wiki/${row.row.slug}`, dashboardContext.memberPresentation)}>{row.row.slug}</CMLink>;
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
                        return <DateValue value={row.row.firstRevisionDate ?? null} formattingLocale={dashboardContext.formattingLocale}
                            timeZone={dashboardContext.localTimeZone} />;
                    },
                },
                {
                    header: "Last Contribution",
                    memberName: "lastRevisionDate",
                    allowSort: true,
                    render: (row) => {
                        return <DateValue value={row.row.lastRevisionDate ?? null} formattingLocale={dashboardContext.formattingLocale}
                            timeZone={dashboardContext.localTimeZone} />;
                    },
                },
            ]}
        />
    </div>;
};

////////////////////////////////////////////////////////////////
export { UserMassAnalysisTabContent } from "./UserMassAnalysisTab";




export const UserCreditsTabContent = ({ user }: UserCreditsTabContentProps) => {
    const dashboard = useDashboardContext();
    const context = useDB3QueryContext();
    const [result] = useQuery(getUserCredits, { ...context, bandPublicId: dashboard.requireBandPublicId(), userId: user.publicId, take: 100 },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const rows = result.songCredits.map((dto, index) => {
        const credit = memberSongCreditView.hydrate(dto, dashboard.referenceStore);
        return { ...credit, rowIndex: index + 1, songName: credit.song?.name ?? "", songYear: credit.song?.introducedYear };
    });
    return <div className="UserCreditsTabContent"><CMTable rows={rows} columns={[
        { header: "#", memberName: "rowIndex", allowSort: false, render: row => <span className="pre">#{row.row.rowIndex}</span> },
        { header: "Song", memberName: "songName", allowSort: true, render: row => row.row.song && <SongChip value={row.row.song} /> },
        { header: "Song year", memberName: "songYear", allowSort: true, render: row => <span>{row.row.songYear}</span> },
        { header: "Credit type", memberName: "type", render: row => <span>{row.row.type?.name}</span> },
        { header: "Credit year", memberName: "year", allowSort: true },
        { header: "Comment", memberName: "comment", render: row => <Markdown markdown={row.row.comment} /> },
    ]} /></div>;
};
