import dayjs from "dayjs";
import moment from 'moment';
import * as React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import { StandardVariationSpec, gAppColors } from 'shared/color';
import * as db3 from "src/core/db3/db3";
import { DiscreteCriterionFilterType, MakeEmptySearchResultsRet, SearchResultsRet } from '../db3/shared/apiTypes';
import { AdminInspectObject, CMSinglePageSurfaceCard } from './CMCoreComponents';
import { useURLState } from './CMCoreComponents2';
import { GetStyleVariablesForColor } from './Color';
import { EventListItem, EventSearchItemContainer } from './EventComponents';
import { CalcEventAttendance, CalculateEventSearchResultsMetadata, EventAttendanceResult, EventListQuerier, EventOrderByColumnOptions, EventsFilterSpec } from './EventComponentsBase';
import { RenderMuiIcon, gCharMap, gIconMap } from "../db3/components/IconMap";
import { Tooltip } from "@mui/material";
import { DashboardContext } from "./DashboardContext";


const localizer = momentLocalizer(moment) // or globalizeLocalizer

// attach useful data to the event for passing around the calendar.
type EventWithSearchResult = {
    event: db3.EnrichedSearchEventPayload;
    result: SearchResultsRet;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface CustomEventProps {
    event: EventWithSearchResult;
    continuesAfter: boolean;
    continuesPrior: boolean;
    //selected: boolean;
    // ... there are other props
};

const CustomEvent = (props: CustomEventProps) => {
    return <div className={`CMCustomEvent applyColor`}>
        {props.event.event.name}
    </div>;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface SegmentAttendanceIndicatorProps {
    attendance: db3.EventAttendanceBasePayload;
};

const SegmentAttendanceIndicator = (props: SegmentAttendanceIndicatorProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const style = GetStyleVariablesForColor({
        ...StandardVariationSpec.Strong,
        color: props.attendance.color,
    });

    return <Tooltip title={props.attendance.text || "No response"}>
        <div className={`attendanceIndicator badge applyColor ${style.cssClass}`} style={style.style}>
            {RenderMuiIcon(props.attendance.iconName)}
        </div>
    </Tooltip>;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface AttendanceIndicatorProps {
    data: EventWithSearchResult;
    attendanceInfo: EventAttendanceResult;
};

const AttendanceIndicator = (props: AttendanceIndicatorProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    // many cases don't show anything.
    if (!props.attendanceInfo.visible) return null;

    // other cases specific to this view.
    if (props.attendanceInfo.eventIsPast && !props.attendanceInfo.anyAnswered) return null; // no responses and in the past; don't show.

    if (props.attendanceInfo.alertFlag) {
        // when alerting, don't bother showing any responses, just show an alert indicator.
        return <Tooltip title={"Please let us know if you're coming"}>
            <div className={`attendanceIndicator badge ${props.attendanceInfo.alertFlag && "alert"}`}>
                !
            </div>
        </Tooltip>;
    }

    // due to limited space, and the fact that most of the time people are going to respond the same for all segments, and we don't even show specific seg info,
    // aggregate them into just the distinct attendance options.
    const uniqueAttendanceIds = [...new Set(props.attendanceInfo.segmentUserResponses.map(s => s.response.attendanceId).filter(aid => (aid !== null)))] as number[];
    const uniqueAttendances = uniqueAttendanceIds.map(id => dashboardContext.eventAttendance.getById(id)!);

    return <>
        <AdminInspectObject src={props.attendanceInfo} />
        {/* {props.attendanceInfo.segmentUserResponses.map(s => <SegmentAttendanceIndicator key={s.segment.id} segmentUserResponse={s} attendanceInfo={props.attendanceInfo} />)} */}
        {uniqueAttendances.map(s => <SegmentAttendanceIndicator key={s.id} attendance={s} />)}
    </>;
}

// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface StatusIndicatorProps {
//     data: EventWithSearchResult;
// };

// const StatusIndicator = (props: StatusIndicatorProps) => {
//     if (!props.data.event.status) return null;

//     const shownStatuses: (string | null)[] = [
//         db3.EventStatusSignificance.FinalConfirmation,
//         db3.EventStatusSignificance.Cancelled,
//     ];

//     // having ALL statuses shown is actually annoying and unuseful; only show if it's confirmed.
//     if (!shownStatuses.includes(props.data.event.status.significance)) return null;

//     const statusStyle = GetStyleVariablesForColor({
//         ...StandardVariationSpec.Strong,
//         color: props.data.event.status?.color || null,
//     });

//     return <Tooltip title={`${props.data.event.status.label}\n${props.data.event.status.description}`}><div className={`statusIndicator badge applyColor ${statusStyle.cssClass}`} style={statusStyle.style}>
//         {RenderMuiIcon(props.data.event.status.iconName)}
//     </div></Tooltip>;
// }

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface CustomEventWrapperProps {
    event: EventWithSearchResult;
    selected: boolean;
    continuesAfter: boolean;
    continuesPrior: boolean;
    // ... there are other props
};

const CustomEventWrapper = (props: React.PropsWithChildren<CustomEventWrapperProps>) => {

    const { eventData, userMap } = CalculateEventSearchResultsMetadata({ event: props.event.event, results: props.event.result });
    const y = CalcEventAttendance({
        eventData,
        userMap,
        alertOnly: false,
    });

    return <div className={`CMCustomEventWrapper ${props.selected && "selected"} ${y.alertFlag && "attendanceAlert"} statusSignificance_${props.event.event.status?.significance}`}>
        <div className="badgeContainer">
            <AttendanceIndicator data={props.event} attendanceInfo={y} />
            {/* <StatusIndicator data={props.event} /> */}
        </div>
        {props.children}
    </div>;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface BigEventCalendarMonthProps {
    selectedEvent: EventWithSearchResult | null;
    setSelectedEvent: (value: EventWithSearchResult | null) => void;

    filterSpec: EventsFilterSpec;

    enrichedEvents: EventWithSearchResult[];
    results: SearchResultsRet;

    date: Date,
    setMonthStr: (s: string) => void;
};

export const BigEventCalendarMonth = (props: BigEventCalendarMonthProps) => {
    return <div className="EventCalendarMonthContainer">
        <AdminInspectObject src={props.filterSpec} label='filterSpec' />
        <AdminInspectObject src={props.results} label='results' />
        <AdminInspectObject src={props.enrichedEvents} label='enrichedEvents' />

        {/* {date.toISOString()} */}

        {/* require a fixed height; it's required by the component. */}
        <div className="myCustomHeight" style={{ height: 550 }}>
            <Calendar
                className="CMBigCalendar"
                localizer={localizer}
                events={props.enrichedEvents}

                // Note: "End" is actually the canonical end - as in, the first time OUTSIDE the range. yay for strictness.
                startAccessor={(e: EventWithSearchResult) => e.event.startsAt}
                endAccessor={(e: EventWithSearchResult) => {
                    return db3.getEventSegmentDateTimeRange(e.event).getEndDateTime();
                }}
                titleAccessor={(e: EventWithSearchResult) => e.event.name}
                allDayAccessor={(e: EventWithSearchResult) => e.event.isAllDay}

                // don't allow drilling down; it's more confusing than helpful
                drilldownView={null}

                onNavigate={(value) => {
                    //setSelectedEvent(null); it's tempting to do this but actually if you just jump to the next month & back, it's more convenient to retain the selection.
                    props.setMonthStr(dayjs(value).format(`YYYYMM`));
                }}
                date={props.date}

                onSelectEvent={(e: EventWithSearchResult) => {
                    props.setSelectedEvent(e);
                }}
                selected={props.selectedEvent}

                components={{
                    event: CustomEvent,
                    eventWrapper: CustomEventWrapper,
                    //dateCellWrapper: CustomDateCellWrapper,
                }}

                messages={{
                    previous: gCharMap.LeftTriangle(),
                    next: gCharMap.RightTriangle(),
                }}

                views={{
                    month: true,
                    week: false,
                    day: false,
                    agenda: false,
                }}
                // function (event: Object, start: Date, end: Date, isSelected: boolean) => {className?: string, style?: Object}
                eventPropGetter={(event: EventWithSearchResult, start: Date, end: Date, isSelected: boolean): { className?: string, style?: Object } => {
                    const x = GetStyleVariablesForColor({ color: event.event.type?.color, ...StandardVariationSpec.Strong, selected: isSelected });
                    return {
                        className: `applyColor ${x.cssClass}`,
                        style: x.style,
                    }
                }}
            />

        </div>

    </div>;
};

export const BigEventCalendar = () => {
    const [selectedEvent, setSelectedEvent] = React.useState<EventWithSearchResult | null>(null);
    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);
    const [results, setResults] = React.useState<SearchResultsRet>(MakeEmptySearchResultsRet());
    const [enrichedEvents, setEnrichedEvents] = React.useState<EventWithSearchResult[]>([]);
    // a string like 2024-06
    const [monthStr, setMonthStr] = useURLState<string | null>("month", null);

    const regex = /(2\d{3})(\d\d)/;
    let date = new Date();
    let year: number = date.getFullYear();
    let month: number = date.getMonth();

    if (monthStr) {
        const match = regex.exec(monthStr);
        if (match) {
            year = new Number(match[1]).valueOf();
            month = new Number(match[2]).valueOf() - 1;
            date = new Date(year, month, 1);
        }
    }

    // calculate min & max dates for querying.
    const minDate = new Date(year, month, -8);
    const maxDate = new Date(year, month + 1, 8);

    // the default basic filter spec when no params specified.
    const filterSpec: EventsFilterSpec = {
        pageSize: 100,
        refreshSerial,
        page: 0,

        // in dto...
        quickFilter: `${dayjs(minDate).format('YYYYMMDD')}-${dayjs(maxDate).format('YYYYMMDD')}`,

        orderByColumn: EventOrderByColumnOptions.id,
        orderByDirection: 'asc',

        tagFilter: { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        statusFilter: { db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        typeFilter: { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        dateFilter: { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    return <>
        <CMSinglePageSurfaceCard>
            <div className="content">
                <BigEventCalendarMonth
                    selectedEvent={selectedEvent}
                    setSelectedEvent={(e) => {
                        if (e?.event.id === selectedEvent?.event.id) {
                            setSelectedEvent(null);
                            return;
                        }
                        setSelectedEvent(e);
                    }}
                    date={date}
                    enrichedEvents={enrichedEvents}
                    filterSpec={filterSpec}
                    results={results}
                    setMonthStr={setMonthStr}
                />

                <EventListQuerier
                    filterSpec={filterSpec}
                    setResults={(r, ee) => {
                        setResults(r);
                        setEnrichedEvents(ee.map(e => ({
                            event: e,
                            result: r,
                        })));

                        // when new results arrive, the old selected item is invalidated and needs to be replaced by the new object.
                        if (selectedEvent) {
                            const n = enrichedEvents.find(e => e.event.id === selectedEvent.event.id) || null;
                            setSelectedEvent(n);
                        }
                    }}
                    render={(isLoading) => <div className={`queryProgressLine ${isLoading ? "loading" : "idle"}`}></div>}
                />

            </div>
        </CMSinglePageSurfaceCard>

        {selectedEvent && <EventListItem
            event={selectedEvent.event}
            filterSpec={filterSpec}
            refetch={() => setRefreshSerial(refreshSerial + 1)}
            results={results}
        />}
    </>;

};
