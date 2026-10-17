import { defineCmdbPage } from "src/route/cmdbPage";
import { useCmdbRouter } from "src/route/useCmdbRouter";
import type { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import { arraysContainSameValues } from "shared/arrayUtils";
import { CalendarDate } from "shared/dateTimePolicy";
import { Permission } from "shared/permissions";
import type { SongPublicId } from "shared/publicId";
import { ActivityVis } from "src/core/components/ActivityVis";
import { CMChip } from "src/core/components/CMChip";
import { CMSinglePageSurfaceCard, EventTextLink } from "src/core/components/CMCoreComponents";
import { AdminInspectObject } from "src/core/components/CMCoreComponents2";
import { StandardVariationSpec } from "src/core/components/color/palette";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { ChipFilterGroup, FilterControls } from "src/core/components/search/FilterControl";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import getGlobalStats from "src/core/db3/queries/getGlobalStats";
import { EventStatusSignificance, EventTypeSignificance } from "src/core/db3/db3";
import { EventActivityTimingSchema, type EventActivityTiming } from "src/core/db3/shared/entities/event/eventActivity";
import type { EventStatisticsFilter, EventStatisticsEvent, EventStatisticsResult, PopularSongOccurrence } from "src/core/db3/shared/entities/event/eventStatistics";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

const timingLabels: { readonly [Timing in EventActivityTiming]: LocalizedPlainStringKey } = {
    All: "songHistory.all",
    "All past": "songHistory.past",
    Future: "songHistory.future",
    "Past 5 years": "songHistory.fiveYears",
    "Past year": "songHistory.year",
};
interface GlobalStatsFilterControlsProps {
    readonly filterSpec: EventStatisticsFilter;
    readonly setFilterSpec: (filter: EventStatisticsFilter) => void;
    readonly defaultFilterSpec: EventStatisticsFilter;
}
export function GlobalStatsFilterControls({ filterSpec, setFilterSpec, defaultFilterSpec }: GlobalStatsFilterControlsProps) {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const hasExtraFilters = !arraysContainSameValues(filterSpec.eventTypeIds, defaultFilterSpec.eventTypeIds)
        || !arraysContainSameValues(filterSpec.eventStatusIds, defaultFilterSpec.eventStatusIds)
        || !arraysContainSameValues(filterSpec.eventTagIds, defaultFilterSpec.eventTagIds)
        || !arraysContainSameValues(filterSpec.songTagIds, defaultFilterSpec.songTagIds);
    return <FilterControls inCard hasExtraFilters={hasExtraFilters}
        hasAnyFilters={hasExtraFilters || filterSpec.timing !== defaultFilterSpec.timing}
        onResetFilter={() => setFilterSpec(defaultFilterSpec)}
        primaryFilter={<ChipFilterGroup style="radio" items={EventActivityTimingSchema.options.map(timing => ({ id: timing, label: locale.getPlainString(timingLabels[timing]) }))}
            selectedIds={[filterSpec.timing]} onChange={values => setFilterSpec({ ...filterSpec, timing: values[0]! })} />}
        extraFilter={<>
            <div className="divider" />
            <ChipFilterGroup style="toggle" items={dashboard.eventType.map(type => ({ id: type.publicId, label: type.name, color: type.color }))}
                selectedIds={filterSpec.eventTypeIds} onChange={eventTypeIds => setFilterSpec({ ...filterSpec, eventTypeIds })} />
            <ChipFilterGroup style="toggle" items={dashboard.eventStatus.map(status => ({ id: status.publicId, label: status.name, color: status.color, shape: "rectangle" }))}
                selectedIds={filterSpec.eventStatusIds} onChange={eventStatusIds => setFilterSpec({ ...filterSpec, eventStatusIds })} />
            <ChipFilterGroup style="toggle" items={dashboard.eventTag.map(tag => ({ id: tag.publicId, label: tag.name, color: tag.color }))}
                selectedIds={filterSpec.eventTagIds} onChange={eventTagIds => setFilterSpec({ ...filterSpec, eventTagIds })} />
            <div className="divider" />
            <ChipFilterGroup style="toggle" items={dashboard.songTag.map(tag => ({ id: tag.publicId, label: tag.name, color: tag.color }))}
                selectedIds={filterSpec.songTagIds} onChange={songTagIds => setFilterSpec({ ...filterSpec, songTagIds })} />
        </>} />;
}

function StatsEventChart({ events, expanded, className }: { readonly events: EventStatisticsEvent[]; readonly expanded: boolean; readonly className?: string }) {
    const dashboard = useDashboardContext();
    const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
    const calendarMonth = (date: Date) => {
        const day = CalendarDate.fromInstant({ value: date, timeZone: dashboard.bandTimeZone }).date;
        return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
    };
    const eventLabel = (event: EventStatisticsEvent) => `${event.name} (${event.startsAt?.toLocaleDateString(dashboard.formattingLocale, { timeZone: dashboard.bandTimeZone }) ?? ""})`;
    const selectedEvents = events.filter(event => {
        if (!event.startsAt) {
            return false;
        }
        const month = calendarMonth(event.startsAt);
        return `${month.year}-${month.month}` === selectedMonth;
    });
    return <>
        {expanded && <ActivityVis className={className} items={events.filter(event => event.startsAt != null)}
            getItemInfo={event => ({ occursAt: event.startsAt! })} getCalendarMonth={calendarMonth} formattingLocale={dashboard.formattingLocale}
            selectedMonthBucketId={selectedMonth}
            getBucketInfo={bucket => ({ tooltip: <ul>{bucket.items.map(({ item }) => <li key={item.publicId}>{eventLabel(item)}</li>)}</ul> })}
            onBucketClick={bucket => setSelectedMonth(bucket.yearMonthBucketId === selectedMonth ? null : bucket.yearMonthBucketId)} />}
        <ul className="statsBucketEvents">{selectedEvents.map(event => <li key={event.publicId}><EventTextLink event={event} /></li>)}</ul>
    </>;
}

function StatsPagePopularSong({ occurrences, expanded }: { readonly occurrences: PopularSongOccurrence[]; readonly expanded: boolean }) {
    const cmdbRouter = useCmdbRouter();

    const song = occurrences[0]!;
    const events = occurrences.map(({ songId, songName, eventId, eventName, ...event }) => ({ ...event, publicId: eventId, name: eventName }));
    return <div className="statsPopularSong">
        <h2><a href={cmdbRouter.getURIForSong({ publicId: song.songId, name: song.songName })} rel="noreferrer" target="_blank">{song.songName}</a> ({occurrences.length})</h2>
        <StatsEventChart events={events} expanded={expanded} />
    </div>;
}

function StatsPageGraphs({ results, expanded }: { readonly results: EventStatisticsResult; readonly expanded: boolean }) {
    const locale = useLocale();
    const songMap = new Map<SongPublicId, PopularSongOccurrence[]>();
    for (const occurrence of results.popularSongsOccurrances) {
        const occurrences = songMap.get(occurrence.songId) ?? [];
        occurrences.push(occurrence);
        songMap.set(occurrence.songId, occurrences);
    }
    return <div className="statsResults">
        <AdminInspectObject src={results} label="results" />
        <h1>{locale.getPlainString("eventStatistics.events", { count: results.allEvents.length })}</h1>
        <StatsEventChart className="events" events={results.allEvents} expanded={expanded} />
        <h1>{locale.getPlainString("eventStatistics.popular")}</h1>
        {[...songMap.values()].map(occurrences => <StatsPagePopularSong key={occurrences[0]!.songId} occurrences={occurrences} expanded={expanded} />)}
    </div>;
}

function StatsPageQuerier({ filterSpec, expanded }: { readonly filterSpec: EventStatisticsFilter; readonly expanded: boolean }) {
    const context = useDB3QueryContext();
    const locale = useLocale();
    const [results, status] = useQuery(getGlobalStats, { ...context, bandPublicId: context.bandPublicId!, filterSpec }, {
        suspense: false, useErrorBoundary: false, keepPreviousData: false, staleTime: 0, cacheTime: 0,
    });
    if (status.isError) {
        return <Alert severity="error">{locale.getPlainString("eventStatistics.failed")}</Alert>;
    }
    if (!results || status.isFetching) {
        return <div role="status">{locale.getPlainString("eventStatistics.loading")}</div>;
    }
    // New result snapshots discard earlier bucket selections, including after revocation.
    return <StatsPageGraphs key={status.dataUpdatedAt} results={results} expanded={expanded} />;
}

function StatsPageInner() {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const defaultFilterSpec: EventStatisticsFilter = {
        timing: "All", eventTagIds: [], songTagIds: [],
        eventStatusIds: dashboard.eventStatus.filter(status => status.significance === EventStatusSignificance.FinalConfirmation).map(status => status.publicId),
        eventTypeIds: dashboard.eventType.filter(type => type.significance === EventTypeSignificance.Concert).map(type => type.publicId),
    };
    const [filterSpec, setFilterSpec] = React.useState(defaultFilterSpec);
    const [expanded, setExpanded] = React.useState(true);
    return <div>
        <GlobalStatsFilterControls filterSpec={filterSpec} setFilterSpec={setFilterSpec} defaultFilterSpec={defaultFilterSpec} />
        <CMChip onClick={() => setExpanded(!expanded)} shape="rectangle" variation={{ ...StandardVariationSpec.Strong, selected: expanded }}>
            {locale.getPlainString("eventStatistics.graphs")}
        </CMChip>
        <StatsPageQuerier filterSpec={filterSpec} expanded={expanded} />
    </div>;
}

function MainContent() {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!context.bandPublicId || !dashboard.isAuthorized(Permission.view_events_reports)) {
        return <Alert severity="info">{locale.getPlainString("eventStatistics.unavailable")}</Alert>;
    }
    return <CMSinglePageSurfaceCard><div className="content">
        <BandLocalizedMarkdown id="StatsPage_markdown" />
        <StatsPageInner key={`${context.bandPublicId}/${context.routeLocale}/${context.clientRequestId}`} />
    </div></CMSinglePageSurfaceCard>;
}
const StatsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("eventStatistics.title")}><MainContent /></DashboardLayout>;
};
defineCmdbPage("bandStats", StatsPage);
export default StatsPage;
