import { getRangeCalendarDates, formatCalendarDate } from "shared/dateTimePresentation";
import { createAllDayRange } from "shared/time";
import * as React from 'react';
//import * as DB3Client from "src/core/db3/DB3Client"; <-- dependency cycle.
import { FormControlLabel, LinearProgress, NoSsr, Popover, Switch, Tooltip } from "@mui/material";
import { DateCalendar, DateView, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { DateTimeRange, DateTimeOption, getDateTimeRangeTimeOptions } from "shared/time";
import { gIconMap } from '../../db3/components/IconMap';
import { CalendarEventSpec } from './DateTimeTypes';
import { useEventsForDateRange } from './useEventsForDateRange';
import { changeDateTimeRangeStartDate, changeDateTimeRangeAllDay } from 'shared/time';
import { CalendarDate, CalendarRange, CalendarDayHitTest, getBandDateTimeFields } from 'shared/dateTimePolicy';
import { useDashboardContext } from '../dashboardContext/DashboardContext';
import { gGeneralPaletteList, StandardVariationSpec } from '../color/palette';
import { GetStyleVariablesForColor } from '../color/ColorClientUtils';

interface CustomDayProps {
    otherDay: Dayjs | null;
    range: CalendarRange;
    selectedDay: Dayjs;
    calendarToday: Dayjs;
    items: CalendarEventSpec[];
}

type DaySlotProps = CustomDayProps & PickersDayProps<Dayjs>;

function DaySlot({ day, selectedDay, range, items, otherDay, calendarToday: now, ...other }: DaySlotProps) {
    const classes: string[] = [
        "day",
    ];

    const tooltips: string[] = [];
    type MatchingEvent = {
        className: string;
        eventSpec: CalendarEventSpec;
        hitTest: CalendarDayHitTest;
    };
    const matchingEvents: MatchingEvent[] = [];

    if (selectedDay.isSame(day, "day")) { classes.push("selected"); tooltips.push("This is the current selection"); }
    if (now.isSame(day, "day")) { classes.push("today"); tooltips.push("This is today"); }
    if (day.isBefore(now, "day")) { classes.push("past"); tooltips.push("This date is in the past"); }
    if (otherDay && day.isSame(otherDay, "day")) classes.push("otherSelected");

    for (let i = 0; i < items.length; ++i) {
        const item = items[i]!;
        const ht = item.dateRange.hitTest(new CalendarDate(day.format("YYYY-MM-DD"), range.start.timeZone));
        if (ht.inRange) {
            let className = "otherEvent otherEventInRange";
            tooltips.push(item.title);
            if (ht.isLastDay) className += (" otherEventRangeEnd");
            if (ht.isFirstDay) className += (" otherEventRangeStart");
            matchingEvents.push({ eventSpec: item, hitTest: ht, className });
        }
    }

    if (other.outsideCurrentMonth) classes.push(`dayOutsideMonth`);

    const hitTest = range.hitTest(new CalendarDate(day.format("YYYY-MM-DD"), range.start.timeZone));
    if (hitTest.inRange) {
        classes.push("inRange");
        if (hitTest.isLastDay) classes.push("rangeEnd");
        if (hitTest.isFirstDay) classes.push("rangeStart");
    }

    if (day.day() === 0 || day.day() === 6) {
        classes.push("weekend");
    };

    const dataProps = {} as Record<string, any>;
    if (matchingEvents.length > 0) {
        dataProps["data-event-id"] = matchingEvents[0]!.eventSpec.id;
        dataProps["data-event-title"] = matchingEvents[0]!.eventSpec.title;
    }

    const firstMatchingEvent = matchingEvents[0];
    const eventColor = gGeneralPaletteList.findEntry(firstMatchingEvent?.eventSpec.color || null);
    const eventStyles = GetStyleVariablesForColor({
        color: eventColor,
        ...StandardVariationSpec.Strong,
    });

    return <div
        key={day.toString()}
        className={`dayContainer ${classes.join(" ")}`}
        {...dataProps}
    >
        <Tooltip
            title={tooltips.length ? <div style={{ whiteSpace: 'pre-line' }}>{tooltips.join(` \n`)}</div> : null}
            arrow
            disableInteractive
        >
            <div className="pickersContainer">{/* https://stackoverflow.com/a/73492810/402169 PickersDay wrapped in Tootlip somehow doesn't work, but adding a div here fixes it. */}
                <PickersDay {...other} disableMargin day={day} disableHighlightToday disableRipple />
            </div>
        </Tooltip>
        <div className="selectionIndicator"></div>
        <div className="selectionBackground"></div>
        <div className={`dayCustomArea ${eventStyles.cssClass}`} style={eventStyles.style}>
            {
                matchingEvents.length > 0 && <div style={{
                    //"--event-color": eventColor,//matchingEvents[0]!.eventSpec.color,
                } as any} key={matchingEvents[0]!.eventSpec.id} className={matchingEvents[0]!.className}></div>
            }
            {/* {loading && <div className="loadingIndicator"></div>} */}
        </div>
        <div className="dayGridLines"></div>
    </div>
}

interface EventCalendarMonthProps {
    timeZone: string;
    value: CalendarDate;
    onChange: (value: CalendarDate) => void;
    otherDay: CalendarDate | null;
    range: CalendarRange;
};

const EventCalendarMonth = (props: EventCalendarMonthProps) => {
    const djs = React.useMemo(() => dayjs(props.value.date), [props.value]);

    const otherDjs = React.useMemo(() => props.otherDay ? dayjs(props.otherDay.date) : null, [props.otherDay]);

    const [view, setView] = React.useState<DateView>("day");
    const now = React.useMemo(() => dayjs(getBandDateTimeFields(new Date(), props.timeZone).date), [props.timeZone]);
    const [displayedMonth, setDisplayedMonth] = React.useState<Dayjs>(djs);

    // Calculate visible range based on the displayed month
    const { firstVisibleDay, lastVisibleDay } = React.useMemo(() => {
        const startOfMonth = displayedMonth.startOf('month');
        const endOfMonth = displayedMonth.endOf('month');
        const firstDay = startOfMonth.subtract(8, 'day');
        const lastDay = endOfMonth.add(8, 'day');
        return {
            firstVisibleDay: firstDay,
            lastVisibleDay: lastDay
        };
    }, [displayedMonth]);

    const visibleRange = React.useMemo(() => new CalendarRange(
        new CalendarDate(firstVisibleDay.format("YYYY-MM-DD"), props.timeZone),
        new CalendarDate(lastVisibleDay.add(1, "day").format("YYYY-MM-DD"), props.timeZone)
    ), [firstVisibleDay, lastVisibleDay, props.timeZone]);

    const { events, loading } = useEventsForDateRange(visibleRange);

    const dayProps: CustomDayProps = React.useMemo(() => ({
        selectedDay: djs,
        calendarToday: dayjs(now),
        otherDay: otherDjs,
        items: events,
        range: props.range,
    }), [djs, otherDjs, props.range, events, now]);

    return <div className="EventCalendarMonthContainer">
        {loading && <LinearProgress className='loadingIndicator' />}
        <DateCalendar
            showDaysOutsideCurrentMonth
            className={`EventCalendarMonth ${loading ? "loading" : ""}`}
            views={["day", "year"]}

            value={djs}
            onChange={(v, state) => {
                props.onChange(new CalendarDate((v || now).format("YYYY-MM-DD"), props.timeZone));
            }}

            view={view}
            onViewChange={(view) => {
                setView(view);
            }}
            onMonthChange={(month) => {
                setDisplayedMonth(month);
            }}

            slots={{ day: DaySlot }}
            slotProps={{
                day: dayProps as any,
            }}
        />
    </div>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface DayControlProps {
    value: CalendarDate | null;
    otherValue: CalendarDate | null;
    onChange: (newValue: CalendarDate) => void;
    coalescedFallbackValue: CalendarDate;
    readonly?: boolean;
    range?: CalendarRange;
    showDuration?: boolean;
    className?: string;
}

export const DayControl = ({ readonly = false, coalescedFallbackValue, ...props }: DayControlProps) => {

    const inputDate: CalendarDate | null = props.value;
    const isTBD = inputDate === null;

    // internal value that the user has selected, to be used when the externally-visible value goes NULL, we can still revert back to this.
    const coalescedDay = inputDate || coalescedFallbackValue;

    const [calendarAnchorEl, setCalendarAnchorEl] = React.useState<null | HTMLElement>(null);

    const handleFieldClick = (event: React.MouseEvent<HTMLElement>) => {
        if (readonly) return;
        setCalendarAnchorEl(event.currentTarget);
    };

    const handleCalendarChangeDay = (newDay: CalendarDate) => {
        props.onChange(newDay);
        setCalendarAnchorEl(null); // close calendar upon selecting
    };

    const handleCalendarClose = () => {
        setCalendarAnchorEl(null);
    };

    const range = props.range || new CalendarRange(coalescedDay, coalescedDay.addDays(1));

    return <>
        {isTBD ? (
            <div className={`${props.className} tbd  ${readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>{gIconMap.CalendarMonth()}TBD</div>
        ) : (
            <div className={`${props.className} determined ${readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick} style={{ display: "flex", alignItems: "center" }}>
                {gIconMap.CalendarMonth()}
                <span>{formatCalendarDate(coalescedDay, navigator.language, { weekday: 'short', day: 'numeric', month: 'short', year: "numeric" })}</span>
                {props.showDuration && <div className="duration">
                    &nbsp;({`${range.dayCount}d`})
                </div>}

            </div>
        )}

        {calendarAnchorEl &&
            <Popover
                open={true}
                anchorEl={calendarAnchorEl}
                onClose={handleCalendarClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <EventCalendarMonth
                    timeZone={coalescedDay.timeZone}
                    value={coalescedDay}
                    onChange={handleCalendarChangeDay}
                    otherDay={props.otherValue}
                    //items={props.items}
                    //useAsyncLoading={props.useAsyncLoading}
                    range={range}
                />
            </Popover >
        }

    </>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMDBSelectProps<T> {
    value: T;
    onChange: (newValue: T) => void;
    options: T[];
    getOptionString: (option: T) => string;
    getOptionID: (option: T) => string;
    className?: string;
};

export const CMDBSelect = <T,>(props: CMDBSelectProps<T>) => {
    return <select className={props.className} onChange={(e) => {
        const f = props.options.find(o => props.getOptionID(o) === e.target.value);
        if (!f) throw new Error(`couldn't find option ${e.target.value}`);
        props.onChange(f);
    }} value={props.getOptionID(props.value)}>
        {props.options.map(v => (<option key={props.getOptionID(v)} value={props.getOptionID(v)}>{props.getOptionString(v)}</option>))}
    </select>
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateTimeRangeControlProps {
    timeZone: string;
    value: DateTimeRange;
    onChange: (newValue: DateTimeRange) => void;
};

// [_] Date TBD
//
// then click it, it's replaced by:
//
// [x] [ 10/5/2023 ] [10:15 pm] -- [11:15pm]
//     [ ] All-day
//     [ ] Different start & end days
//
// now click all-day event
// [x] [ 10/5/2023 ] -- [ 10/5/2023 ]
//     [x] All-day event
//
// Or, click "different start & end days"
// [x] [ 10/5/2023 ] [10:15 pm] -- [ 10/5/2023 ] [11:15pm]
//     [ ] All-day
//     [x] Different start & end days
//
export const DateTimeRangeControl = ({ value, ...props }: DateTimeRangeControlProps) => {
    const timeZone = props.timeZone;
    const [fallbackRange, setFallbackRange] = React.useState<DateTimeRange>(() => {
        if (!value.isTBD()) return value;
        if (!value.isAllDay()) return new DateTimeRange({ ...value.getSpec(), startsAtDateTime: new Date() });
        const today = CalendarDate.fromInstant({ value: new Date(), timeZone });
        return createAllDayRange({ startDate: today.date, endDateExclusive: today.addDays(1).date }, timeZone);
    });
    const coalesced = value.isTBD() ? fallbackRange : value;
    const calendarRange = getRangeCalendarDates(coalesced, timeZone)!;
    const startDay = calendarRange.start;
    const lastDay = calendarRange.last;
    const startMillis = coalesced.getSpec().startsAtDateTime!.valueOf();
    const endMillis = coalesced.getEndDateTime()!.valueOf();
    const showTimeOptions = !value.isAllDay() && !value.isTBD();
    const timeOptions = React.useMemo(() => !showTimeOptions ? null : getDateTimeRangeTimeOptions(
        new Date(startMillis),
        new Date(endMillis),
        timeZone,
        // Repeated clocks are rare, and duplicate-looking choices plus offset labels
        // make these fixed-width selects needlessly wide and confusing.
        "takeFirst"
    ), [showTimeOptions, startMillis, endMillis, timeZone]);

    const handleStartDateChange = (newValue: CalendarDate) => {
        const updated = changeDateTimeRangeStartDate(coalesced, newValue.date, timeZone);
        setFallbackRange(updated);
        props.onChange(updated);
    };

    const handleEndDateChange = (newEndDate: CalendarDate) => {
        const start = startDay.date < newEndDate.date ? startDay : newEndDate;
        const last = startDay.date < newEndDate.date ? newEndDate : startDay;
        const updated = createAllDayRange({ startDate: start.date, endDateExclusive: last.addDays(1).date }, timeZone);
        setFallbackRange(updated);
        props.onChange(updated);
    };

    const handleChangeStartTime2 = (newTime: DateTimeOption) => {
        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: newTime.instant }));
    };

    const handleChangeEndTime2 = (newTime: DateTimeOption) => {
        props.onChange(new DateTimeRange({ ...value.getSpec(), durationMillis: newTime.instant.valueOf() - startMillis }));
    };

    const handleAllDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const updated = changeDateTimeRangeAllDay(coalesced, e.target.checked, timeZone, new Date());
        setFallbackRange(updated);
        props.onChange(updated);
    };

    const handleTBDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.checked) setFallbackRange(coalesced);
        props.onChange(e.target.checked ? fallbackRange : new DateTimeRange({ ...value.getSpec(), startsAtDateTime: null }));
    };

    // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
    return <NoSsr>
        <div className="DateTimeRangeControl">
            <div className="timeZone">Time zone: {timeZone}</div>
            <div className="row">
                <div className="tbdControl field">
                    <Switch size="small" checked={!value.isTBD()} onChange={handleTBDChange} />
                </div>

                <div className="dateSelection field">

                    <DayControl
                        readonly={false}
                        onChange={handleStartDateChange}
                        value={value.isTBD() ? null : startDay}
                        coalescedFallbackValue={startDay}
                        otherValue={value.isTBD() ? null : lastDay}
                        range={calendarRange}
                        showDuration={false}
                        className="datePart field startDate"
                    />

                    {!value.isTBD() && (
                        <>
                            {!value.isAllDay() && !value.isTBD() && (<>
                                @
                                <div className="timePart field">
                                    <CMDBSelect
                                        className="interactable startTime"
                                        value={timeOptions!.selectedStart}
                                        onChange={handleChangeStartTime2}
                                        getOptionID={o => String(o.instant.valueOf())}
                                        options={timeOptions!.startOptions}
                                        getOptionString={o => o.label}
                                    />
                                </div>
                            </>)}

                            <div className="ndash field">&ndash;</div>

                            {value.isAllDay() && <DayControl
                                // for all-day events, selecting the end time means selecting the LAST day, not the "end". would not make sense to have to select 12-oct for an event that only exists on 11-oct.
                                readonly={false}
                                onChange={handleEndDateChange}
                                value={lastDay}
                                coalescedFallbackValue={lastDay}
                                otherValue={startDay}
                                range={calendarRange}
                                showDuration={true}
                                className="datePart field endDate"
                            />}

                            {!value.isAllDay() && !value.isTBD() && (
                                <div className="timePart field">
                                    <CMDBSelect
                                        className="interactable endTime"
                                        value={timeOptions!.selectedEnd}
                                        onChange={handleChangeEndTime2}
                                        getOptionID={o => String(o.instant.valueOf())}
                                        options={timeOptions!.endOptions}
                                        getOptionString={o => o.label}
                                    />
                                </div>
                            )}

                        </>
                    )/* isTBD */}

                </div>

                {!value.isTBD() && (<>
                    <div className="allDayControl">
                        <FormControlLabel
                            className='CMFormControlLabel'
                            control={<Switch size="small" checked={value.isAllDay()} onChange={handleAllDayChange} />}
                            label="All-day"
                            labelPlacement="end"
                        />
                    </div>

                </>)}

            </div>
        </div>
    </NoSsr>;
};

// creating new events is done in the band's timezone.
// that's different than viewing events which is presented to the user in their local timezone.
export const EventDateTimeRangeControl = (props: Omit<DateTimeRangeControlProps, "timeZone">) => {
    const dashboardContext = useDashboardContext();
    return <DateTimeRangeControl
        {...props}
        timeZone={dashboardContext.bandTimeZone}
    />;
};

export interface DateRange {
    start: Date;
    end: Date;
}

export interface CMDateRangePickerProps {
    value: DateRange;
    onChange: (newValue: DateRange) => void;
    timeZone: string;
};

// currently only used on the feature reports internal page.
export const CMDateRangePicker = ({ value, ...props }: CMDateRangePickerProps) => {

    const handleStartDateChange = (newValue: CalendarDate) => {
        props.onChange({ ...value, start: newValue.toStartInstant() });
    };

    const handleEndDateChange = (newValue: CalendarDate) => {
        props.onChange({ ...value, end: newValue.toStartInstant() });
    };

    const range = new DateTimeRange({
        startsAtDateTime: value.start,
        durationMillis: value.end.valueOf() - value.start.valueOf(),
        isAllDay: false,
    });

    // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
    return <NoSsr>
        <div className="DateTimeRangeControl">
            <div className="row" style={{ display: "flex", alignItems: "center" }}>
                <DayControl
                    readonly={false}
                    onChange={handleStartDateChange}
                    value={CalendarDate.fromInstant({ value: value.start, timeZone: props.timeZone })}
                    coalescedFallbackValue={CalendarDate.fromInstant({ value: value.start, timeZone: props.timeZone })}
                    otherValue={null} // use LAST time so it doesn't spill into next day.
                    range={getRangeCalendarDates(range, props.timeZone)!}
                    showDuration={false}
                    className="datePart field startDate"
                />
            </div>
        </div>
        <div className="ndash field">&ndash;</div>

        <div className="DateTimeRangeControl">
            <div className="row" style={{ display: "flex", alignItems: "center" }}>

                <DayControl
                    readonly={false}
                    onChange={handleEndDateChange}
                    value={CalendarDate.fromInstant({ value: value.end, timeZone: props.timeZone })}
                    coalescedFallbackValue={CalendarDate.fromInstant({ value: value.end, timeZone: props.timeZone })}
                    otherValue={null} // use LAST time so it doesn't spill into next day.
                    range={getRangeCalendarDates(range, props.timeZone)!}
                    showDuration={false}
                    className="datePart field startDate endDate"
                />
            </div>
        </div>

    </NoSsr>;
};
