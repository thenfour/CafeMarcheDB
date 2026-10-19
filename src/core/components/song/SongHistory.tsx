import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import { CalendarDate } from "shared/dateTimePolicy";
import type { SongPublicId } from "shared/publicId";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useLocale } from "src/locale/components/useLocale";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";
import getSongActivityReport from "../../db3/queries/getSongActivityReport";
import { SongHistoryTimingSchema, type SongHistoryFilter, type SongHistoryTiming } from "../../db3/shared/entities/song/songHistory";
import { ActivityVis } from "../ActivityVis";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { ChipFilterGroup, FilterControls } from "../search/FilterControl";

export interface SongHistoryProps {
    readonly song: { readonly publicId: SongPublicId };
}
const timingLabels: { readonly [Timing in SongHistoryTiming]: LocalizedPlainStringKey } = {
    All: "songHistory.all", "All past": "songHistory.past", Future: "songHistory.future",
    "Past 5 years": "songHistory.fiveYears", "Past year": "songHistory.year",
};
const defaultFilter: SongHistoryFilter = { timing: "All past", eventTypeIds: [], eventStatusIds: [], eventTagIds: [] };

function SongHistoryResults({ song, filterSpec }: SongHistoryProps & { filterSpec: SongHistoryFilter }) {
    const context = useDB3QueryContext();
    const router = useCmdbRouter();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
    const [result, status] = useQuery(getSongActivityReport, { ...context, bandPublicId: context.bandPublicId!, songId: song.publicId, filterSpec }, {
        suspense: false, useErrorBoundary: false, keepPreviousData: false, staleTime: 0, cacheTime: 0,
    });
    React.useEffect(() => setSelectedMonth(null), [filterSpec]);
    if (status.isError) {
        return <Alert severity="error">{locale.getPlainString("songHistory.failed")}</Alert>;
    }
    if (!result || status.isFetching) {
        return <div role="status">{locale.getPlainString("songHistory.loading")}</div>;
    }
    const calendarMonth = (date: Date) => {
        const day = CalendarDate.fromInstant({ value: date, timeZone: dashboard.bandTimeZone }).date;
        return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
    };
    const eventLabel = (event: typeof result.events[number]) => `${event.name ?? ""} (${event.startsAt?.toLocaleDateString(dashboard.formattingLocale, { timeZone: dashboard.bandTimeZone }) ?? ""})`;
    const selectedEvents = result.events.filter(event => {
        if (!event.startsAt) {
            return false;
        }
        const month = calendarMonth(event.startsAt);
        return `${month.year}-${month.month}` === selectedMonth;
    });
    return <>
        <div className="songHistoryCount">{locale.getPlainString("songHistory.count", { count: result.events.length })}</div>
        <ActivityVis items={result.events.filter(event => event.startsAt != null)} getItemInfo={event => ({ occursAt: event.startsAt! })}
            getCalendarMonth={calendarMonth} formattingLocale={dashboard.formattingLocale}
            selectedMonthBucketId={selectedMonth}
            getBucketInfo={bucket => ({ tooltip: <ul>{bucket.items.map(({ item }) => <li key={item.publicId}>{eventLabel(item)}</li>)}</ul> })}
            onBucketClick={bucket => setSelectedMonth(bucket.yearMonthBucketId === selectedMonth ? null : bucket.yearMonthBucketId)} />
        <ul className="songHistoryEvents">{selectedEvents.map(event => <li key={event.publicId}>
            <a href={router.getURIForEvent(event)} target="_blank" rel="noreferrer">{eventLabel(event)}</a>
        </li>)}</ul>
    </>;
}

function SongHistoryInner({ song }: SongHistoryProps) {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const [filterSpec, setFilterSpec] = React.useState<SongHistoryFilter>(defaultFilter);
    const hasExtraFilters = !!(filterSpec.eventTypeIds.length || filterSpec.eventStatusIds.length || filterSpec.eventTagIds.length);
    return <div className="SongHistoryInner">
        <FilterControls inCard hasAnyFilters={hasExtraFilters || filterSpec.timing !== defaultFilter.timing} hasExtraFilters={hasExtraFilters}
            onResetFilter={() => setFilterSpec(defaultFilter)}
            primaryFilter={<ChipFilterGroup style="radio" items={SongHistoryTimingSchema.options.map(timing => ({ id: timing, label: locale.getPlainString(timingLabels[timing]) }))}
                selectedIds={[filterSpec.timing]} onChange={values => setFilterSpec({ ...filterSpec, timing: values[0]! })} />}
            extraFilter={<>
                <div className="divider" />
                <ChipFilterGroup style="toggle" items={dashboard.eventType.map(type => ({ id: type.publicId, label: type.name, color: type.color }))}
                    selectedIds={filterSpec.eventTypeIds} onChange={eventTypeIds => setFilterSpec({ ...filterSpec, eventTypeIds })} />
                <ChipFilterGroup style="toggle" items={dashboard.eventStatus.map(status => ({ id: status.publicId, label: status.name, color: status.color, shape: "rectangle" }))}
                    selectedIds={filterSpec.eventStatusIds} onChange={eventStatusIds => setFilterSpec({ ...filterSpec, eventStatusIds })} />
                <ChipFilterGroup style="toggle" items={dashboard.eventTag.map(tag => ({ id: tag.publicId, label: tag.name, color: tag.color }))}
                    selectedIds={filterSpec.eventTagIds} onChange={eventTagIds => setFilterSpec({ ...filterSpec, eventTagIds })} />
            </>} />
        <SongHistoryResults song={song} filterSpec={filterSpec} />
    </div>;
}

export function SongHistory(props: SongHistoryProps) {
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const locale = useLocale();
    if (!context.bandPublicId || !dashboard.isAuthorized(BandPermission.view_events_nonpublic)) {
        return <Alert severity="info">{locale.getPlainString("songHistory.unavailable")}</Alert>;
    }
    return <div>
        <BandLocalizedMarkdown id="SongHistoryTabDescription" />
        <SongHistoryInner key={`${context.bandPublicId}/${context.routeLocale}/${props.song.publicId}/${context.clientRequestId}`} {...props} />
    </div>;
}
