import { NoSsr, Tooltip } from "@mui/material";
import dayjs from "dayjs";
import moment from 'moment';
import "moment/locale/nl-be"; // forces the calendar to use nl-BE locale
import * as React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import { StandardVariationSpec } from 'shared/color';
import * as db3 from "src/core/db3/db3";
import { RenderMuiIcon, gCharMap } from "../db3/components/IconMap";
import { DiscreteCriterionFilterType, SearchResultsRet } from '../db3/shared/apiTypes';
import { AppContextMarker } from "./AppContext";
import { CMSinglePageSurfaceCard } from './CMCoreComponents';
import { AdminInspectObject, useURLState } from './CMCoreComponents2';
import { GetStyleVariablesForColor } from './Color';
import { DashboardContext, useDashboardContext } from "./DashboardContext";
import { CalcEventAttendance, CalculateEventSearchResultsMetadata, EventAttendanceResult } from './event/EventComponentsBase';
import { useSearchableList } from 'src/core/hooks/useSearchableList';
import { eventSearchConfig } from 'src/core/hooks/searchConfigs';
import { EventListItem } from "./event/EventComponents";
import { EventOrderByColumnOptions, EventsFilterSpec } from "./event/EventClientBaseTypes";
import { DateToYYYYMMDD } from "@/shared/time";


// attach useful data to the event for passing around the calendar.
type EventWithSearchResult = {
    event: db3.EnrichedSearchEventPayload;
    result: SearchResultsRet;
}

type TCalendarEventItem = {
    segment: db3.EnrichedSearchEventPayload["segments"][0];
    event: db3.EnrichedSearchEventPayload;
    result: SearchResultsRet;
    isSingleSegmentEvent: boolean;
};

function GetEventName(e: TCalendarEventItem) {
    return e.isSingleSegmentEvent ? e.event.name : `${e.event.name}: ${e.segment.name}`;
}


// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface CustomDateCellWrapperProps {
//     value: Date;
//     range: Date[];
// };

// const CustomDateCellWrapper = (props: React.PropsWithChildren<CustomDateCellWrapperProps>) => {
//     // rbc-selected-cell
//     // rbc-today
//     //"rbc-off-range-bg";
//     console.log(props)
//     return <div className={`rbc-day-bg CMCustomDateCellWrapper ${(props.value.getDay() == 0 || props.value.getDay() == 6) ? "weekend" : "weekday"}`}>
//         {props.children}
//     </div>;
// }



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface CustomEventProps {
    event: TCalendarEventItem;
    continuesAfter: boolean;
    continuesPrior: boolean;
    //selected: boolean;
    // ... there are other props
};

const CustomEvent = (props: CustomEventProps) => {
    return <div className={`CMCustomEvent applyColor`}>
        {GetEventName(props.event)}
    </div>;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface SegmentAttendanceIndicatorProps {
    attendance: db3.EventAttendanceBasePayload;
};

const SegmentAttendanceIndicator = (props: SegmentAttendanceIndicatorProps) => {
    //const dashboardContext = React.useContext(DashboardContext);

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



interface CustomEventWrapperProps {
    event: TCalendarEventItem;
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
        //alertOnly: false,
    });

    return <Tooltip title={GetEventName(props.event)} disableInteractive>
        <div className={`CMCustomEventWrapper ${props.selected && "selected"} ${y.alertFlag && "attendanceAlert"} statusSignificance_${props.event.event.status?.significance}`}>
            <div className="badgeContainer">
                {/* <StatusIndicator data={props.event} /> */}
                <AttendanceIndicator data={props.event} attendanceInfo={y} />
            </div>
            {props.children}
        </div>
    </Tooltip>
        ;
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
    const dashboardContext = useDashboardContext();
    // moment.locale('nl-be'); // doesn't work.
    const localizer = momentLocalizer(moment) // or globalizeLocalizer

    const isSegmentCancelled = (segment: db3.EnrichedSearchEventPayload["segments"][0]) => {
        const status = dashboardContext.eventStatus.getById(segment.statusId);
        return (status?.significance === db3.EventStatusSignificance.Cancelled);
    };

    // don't show events. show segments.
    const eventsWithMore = props.enrichedEvents.map(e => {
        const uncancelledSegments = e.event.segments.filter(s => !isSegmentCancelled(s));
        return {
            event: e,
            result: e.result,
            uncancelledSegments,
        };
    });

    const segments: TCalendarEventItem[] = eventsWithMore.flatMap((event, index) => event.uncancelledSegments.map(segment => ({
        segment: segment,
        event: event.event.event,
        result: event.result,
        isSingleSegmentEvent: event.uncancelledSegments.length === 1,
    })));

    return <div className="EventCalendarMonthContainer">
        <AdminInspectObject src={props.filterSpec} label='filterSpec' />
        <AdminInspectObject src={props.results} label='results' />
        <AdminInspectObject src={props.enrichedEvents} label='enrichedEvents' />

        {/* {date.toISOString()} */}

        {/* {moment.locale()} */}

        {/* require a fixed height; it's required by the component. */}
        <div className="myCustomHeight" style={{ height: 550 }}>
            <Calendar
                className="CMBigCalendar"
                localizer={localizer}
                events={segments}

                // Note: "End" is actually the canonical end - as in, the first time OUTSIDE the range. yay for strictness.
                startAccessor={(e: TCalendarEventItem) => e.segment.startsAt}
                endAccessor={(e: TCalendarEventItem) => {
                    return db3.getEventSegmentDateTimeRange(e.segment).getEndDateTime();
                }}
                titleAccessor={(e: TCalendarEventItem) => {
                    if (e.isSingleSegmentEvent) return e.event.name;
                    return `${e.event.name}: ${e.segment.name}`
                }}
                allDayAccessor={(e: TCalendarEventItem) => e.segment.isAllDay}

                // don't allow drilling down; it's more confusing than helpful
                drilldownView={null}

                onNavigate={(value) => {
                    //setSelectedEvent(null); it's tempting to do this but actually if you just jump to the next month & back, it's more convenient to retain the selection.
                    props.setMonthStr(dayjs(value).format(`YYYYMM`));
                }}
                date={props.date}

                onSelectEvent={(e: TCalendarEventItem) => {
                    props.setSelectedEvent(e);
                }}
                selected={props.selectedEvent}

                components={{
                    event: CustomEvent,
                    eventWrapper: CustomEventWrapper,
                    //dateCellWrapper: CustomDateCellWrapper,
                    //dateHeader: DateCellContent,
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
                eventPropGetter={(event: TCalendarEventItem, start: Date, end: Date, isSelected: boolean): { className?: string, style?: Object } => {
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

export const BigEventCalendarInner = (props: { selectedEventId?: undefined | number }) => {
    //const [selectedEvent, setSelectedEvent] = React.useState<EventWithSearchResult | null>(null);
    const [selectedEventId, setSelectedEventId] = React.useState<number | null>(props.selectedEventId || null);
    const [refreshSerial, setRefreshSerial] = React.useState<number>(0);
    //const [results, setResults] = React.useState<SearchResultsRet>(MakeEmptySearchResultsRet());
    //const [enrichedEvents, setEnrichedEvents] = React.useState<EventWithSearchResult[]>([]);
    // a string like 2024-06
    const [monthStr, setMonthStr] = useURLState<string | null>("month", null);

    React.useEffect(() => {
        setSelectedEventId(props.selectedEventId || null);
    }, [props.selectedEventId]);

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
        refreshSerial,

        // in dto...
        quickFilter: `${DateToYYYYMMDD(minDate)}-${DateToYYYYMMDD(maxDate)}`,

        orderByColumn: EventOrderByColumnOptions.id,
        orderByDirection: 'asc',

        tagFilter: { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        statusFilter: { db3Column: "status", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        typeFilter: { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        dateFilter: { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
    };

    const { enrichedItems: enrichedEvents, results } = useSearchableList(filterSpec, eventSearchConfig, 100);
    const eventsWithSearch = enrichedEvents.map(e => ({
        event: e,
        result: results,
    }));
    const selectedEvent = eventsWithSearch.find(e => e.event.id === selectedEventId) || null;

    // nossr to prevent using server's locale settings.
    return <>
        <AppContextMarker name="BigEventCalendar">
            <CMSinglePageSurfaceCard>
                <div className="content">
                    <BigEventCalendarMonth
                        selectedEvent={selectedEvent}
                        setSelectedEvent={(e) => {
                            if (e?.event.id === selectedEventId) { // deselect behavior
                                setSelectedEventId(null);
                                return;
                            }
                            setSelectedEventId(e?.event.id || null);
                        }}
                        date={date}
                        enrichedEvents={eventsWithSearch}
                        filterSpec={filterSpec}
                        results={results}
                        setMonthStr={setMonthStr}
                    />
                </div>
            </CMSinglePageSurfaceCard>

            {selectedEvent && <EventListItem
                event={selectedEvent.event}
                filterSpec={filterSpec}
                refetch={() => setRefreshSerial(refreshSerial + 1)}
                results={results}
            //feature={ActivityFeature.big_calendar_event_link_click}
            />}
        </AppContextMarker>
    </>;

};




export const BigEventCalendar = (props: { selectedEventId?: undefined | number }) => {
    // nossr to prevent using server's locale settings.
    return <NoSsr>
        <BigEventCalendarInner {...props} />
    </NoSsr>;
};
