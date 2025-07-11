import * as React from 'react';
//import * as DB3Client from "src/core/db3/DB3Client"; <-- dependency cycle.
import { StandardVariationSpec, gGeneralPaletteList } from '@/shared/color';
import { FormControlLabel, LinearProgress, NoSsr, Popover, Switch, Tooltip } from "@mui/material";
import { DateCalendar, DateView, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import { assert } from 'blitz';
import dayjs, { Dayjs } from "dayjs";
import { CalcRelativeTiming, DateTimeRange, DateTimeRangeHitTestResult, TimeOption, TimeOptionsGenerator, combineDateAndTime, floorLocalToLocalDay, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, getTimeOfDayInMinutes } from "shared/time";
import { gIconMap } from '../../db3/components/IconMap';
import { KeyValueTable } from '../CMCoreComponents2';
import { GetStyleVariablesForColor } from '../Color';
import { CalendarEventSpec } from './DateTimeTypes';
import { useEventsForDateRange } from './useEventsForDateRange';

interface CustomDayProps {
    otherDay: Dayjs | null;
    range: DateTimeRange;
    selectedDay: Dayjs;
    items: CalendarEventSpec[];
}

type DaySlotProps = CustomDayProps & PickersDayProps<Dayjs>;

function DaySlot({ day, selectedDay, range, items, otherDay, ...other }: DaySlotProps) {
    const now = dayjs();
    const classes: string[] = [
        "day",
    ];

    const tooltips: string[] = [];
    type MatchingEvent = {
        className: string;
        eventSpec: CalendarEventSpec;
        hitTest: DateTimeRangeHitTestResult;
    };
    const matchingEvents: MatchingEvent[] = [];

    if (selectedDay.isSame(day, "day")) { classes.push("selected"); tooltips.push("This is the current selection"); }
    if (now.isSame(day, "day")) { classes.push("today"); tooltips.push("This is today"); }
    if (day.isBefore(now, "day")) { classes.push("past"); tooltips.push("This date is in the past"); }
    if (otherDay && day.isSame(otherDay, "day")) classes.push("otherSelected");

    for (let i = 0; i < items.length; ++i) {
        const item = items[i]!;
        const ht = item.dateRange.hitTestDay(day);
        if (ht.inRange) {
            let className = "otherEvent otherEventInRange";
            tooltips.push(item.title);
            if (ht.isLastDay) className += (" otherEventRangeEnd");
            if (ht.isFirstDay) className += (" otherEventRangeStart");
            matchingEvents.push({ eventSpec: item, hitTest: ht, className });
        }
    }

    if (other.outsideCurrentMonth) classes.push(`dayOutsideMonth`);

    const hitTest = range.hitTestDay(day);
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
    value: Date;
    onChange: (value: Date) => void;
    otherDay: Date | null;
    range: DateTimeRange;
};

const EventCalendarMonth = (props: EventCalendarMonthProps) => {
    const djs = React.useMemo(() => dayjs(props.value), [props.value]);

    const otherDjs = React.useMemo(() => props.otherDay ? dayjs(props.otherDay) : null, [props.otherDay]);

    const [view, setView] = React.useState<DateView>("day");
    const { now, nowjs } = React.useMemo(() => {
        const now = new Date();
        return {
            now,
            nowjs: dayjs(now),
        };
    }, []);
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

    const visibleRange = React.useMemo(() => {
        return new DateTimeRange({
            startsAtDateTime: firstVisibleDay.toDate(),
            durationMillis: lastVisibleDay.valueOf() - firstVisibleDay.valueOf(),
            isAllDay: false,
        });
    }, [firstVisibleDay, lastVisibleDay]);

    const { events, loading } = useEventsForDateRange(visibleRange);

    console.log("EventCalendarMonth: events:", events, "loading:", loading);

    const dayProps: CustomDayProps = React.useMemo(() => ({
        selectedDay: djs,
        otherDay: otherDjs,
        items: events,
        range: props.range,
    }), [djs, otherDjs, props.range, events, loading]);

    return <div className="EventCalendarMonthContainer">
        {loading && <LinearProgress className='loadingIndicator' />}
        <DateCalendar
            showDaysOutsideCurrentMonth
            className={`EventCalendarMonth ${loading ? "loading" : ""}`}
            views={["day", "year"]}

            value={djs}
            onChange={(v, state) => {
                props.onChange(v?.toDate() || now);
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
    value: Date | null;
    otherValue: Date | null;
    onChange: (newValue: Date) => void;
    coalescedFallbackValue?: Date;
    readonly?: boolean;
    //items?: CalendarEventSpec[];
    //useAsyncLoading?: boolean;
    range?: DateTimeRange; // for formatting the calendar display
    showDuration?: boolean;
    className?: string;
};

export const DayControl = ({ readonly = false, coalescedFallbackValue, ...props }: DayControlProps) => {

    const inputDate: Date | null = props.value;
    const isTBD = inputDate === null;

    // internal value that the user has selected, to be used when the externally-visible value goes NULL, we can still revert back to this.
    const coalescedDay: Date = inputDate || coalescedFallbackValue || new Date();

    const [calendarAnchorEl, setCalendarAnchorEl] = React.useState<null | HTMLElement>(null);

    const handleFieldClick = (event: React.MouseEvent<HTMLElement>) => {
        if (readonly) return;
        setCalendarAnchorEl(event.currentTarget);
    };

    const handleCalendarChangeDay = (newDay: Date) => {
        props.onChange(newDay);
        setCalendarAnchorEl(null); // close calendar upon selecting
    };

    const handleCalendarClose = () => {
        setCalendarAnchorEl(null);
    };

    const range = props.range || new DateTimeRange({
        startsAtDateTime: coalescedDay,
        durationMillis: gMillisecondsPerDay,
        isAllDay: true,
    });

    return <>
        {isTBD ? (
            <div className={`${props.className} tbd  ${readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>{gIconMap.CalendarMonth()}TBD</div>
        ) : (
            <div className={`${props.className} determined ${readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick} style={{ display: "flex", alignItems: "center" }}>
                {gIconMap.CalendarMonth()}
                <span>{coalescedDay.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: "numeric" })}</span>
                {props.showDuration && <div className="duration">
                    &nbsp;({formatMillisecondsToDHMS(range.getDurationMillis())})
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

    // sanitize input value
    const coalescedStartDateTime = value.getStartDateTime(new Date());

    const startTimeOptions = new TimeOptionsGenerator(15, 0);
    const endTimeOptions = new TimeOptionsGenerator(15, getTimeOfDayInMinutes(coalescedStartDateTime));

    const startTime = startTimeOptions.findTime(coalescedStartDateTime);
    const endTime = endTimeOptions.findTime(value.getEndDateTime(coalescedStartDateTime)); // selecting the end time will be EXCLUSIVE. so you select a 1-hour 10am-11am event, and the END time will be 11am; last time = 10:59.59.999

    const [coalescedFallbackStartDay, setCoalescedFallbackStartDay] = React.useState<Date>(coalescedStartDateTime);

    const handleStartDateChange = (newValue: Date) => {
        setCoalescedFallbackStartDay(newValue);
        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: newValue }));
    };

    const handleEndDateChange = (newEndDate: Date) => {
        assert(value.isAllDay(), "setting end date only makes sense for all-day events");
        newEndDate = floorLocalToLocalDay(newEndDate); // ignore whatever time component the datepicker hands us; we know it should be midnight. maintain local tz.

        // swap start/end if needed.
        let newStartDateTime = coalescedStartDateTime;
        if (newEndDate < newStartDateTime) {
            newStartDateTime = newEndDate;
            newEndDate = coalescedStartDateTime;
        }

        setCoalescedFallbackStartDay(newStartDateTime);

        // convert to duration. if you select the same as the start, you want that to actually represent a duration of 1 day.
        // assume these are aligned to day.
        const durationMillis = newEndDate.valueOf() - newStartDateTime.valueOf() + gMillisecondsPerDay;

        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: newStartDateTime, durationMillis }));
    };

    const handleChangeStartTime2 = (newTime: TimeOption) => {
        const newDateTime = combineDateAndTime(coalescedStartDateTime, newTime.time);
        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: newDateTime }));
    };

    const handleChangeEndTime2 = (newTime: TimeOption) => {
        props.onChange(new DateTimeRange({ ...value.getSpec(), durationMillis: newTime.millisSinceStart }));
    };

    const handleAllDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAllDay = e.target.checked;
        // when you switch between all-day and not, always reset the duration. theoretically we could preserve durations between them but meh. not even sure that would be better ux
        const newDuration = newAllDay ? gMillisecondsPerDay : gMillisecondsPerHour;

        let newStartDateTime = floorLocalToLocalDay(coalescedStartDateTime);
        if (!newAllDay) {
            // for all-day events, start time can get set to midnight; anyway it's not used so assume it's not valid.
            newStartDateTime = combineDateAndTime(newStartDateTime, new Date());
        }
        setCoalescedFallbackStartDay(newStartDateTime);
        props.onChange(new DateTimeRange({ ...value.getSpec(), isAllDay: newAllDay, durationMillis: newDuration, startsAtDateTime: newStartDateTime }));
    };

    const handleTBDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: e.target.checked ? coalescedFallbackStartDay : null }));
    };

    // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
    return <NoSsr>
        <div className="DateTimeRangeControl">
            <div className="row">
                <div className="tbdControl field">
                    <Switch size="small" checked={!value.isTBD()} onChange={handleTBDChange} />
                </div>

                <div className="dateSelection field">

                    <DayControl
                        readonly={false}
                        onChange={handleStartDateChange}
                        value={value.getStartDateTime()}
                        coalescedFallbackValue={coalescedFallbackStartDay}
                        otherValue={value.getLastDateTime()} // use LAST time so it doesn't spill into next day.
                        range={value}
                        showDuration={false}
                        className="datePart field startDate"
                    />

                    {!value.isTBD() && (
                        <>
                            {!value.isAllDay() && !value.isTBD() && (<>
                                @
                                <div className="timePart field">

                                    <CMDBSelect className="interactable startTime" value={startTime} onChange={handleChangeStartTime2} getOptionID={o => `id_${o.index}`} options={startTimeOptions.getOptions()} getOptionString={o => o.label} />

                                </div>
                            </>)}

                            <div className="ndash field">&ndash;</div>

                            {value.isAllDay() && <DayControl
                                // for all-day events, selecting the end time means selecting the LAST day, not the "end". would not make sense to have to select 12-oct for an event that only exists on 11-oct.
                                readonly={false}
                                onChange={handleEndDateChange}
                                value={value.getLastDateTime()}
                                coalescedFallbackValue={value.getLastDateTime(coalescedFallbackStartDay)}
                                otherValue={value.getStartDateTime()}
                                range={value}
                                showDuration={true}
                                className="datePart field endDate"
                            />}

                            {!value.isAllDay() && !value.isTBD() && (
                                <div className="timePart field">
                                    <CMDBSelect className="interactable endTime" value={endTime} onChange={handleChangeEndTime2} getOptionID={o => `id_${o.index}`} options={endTimeOptions.getOptions()} getOptionString={o => o.labelWithDuration} />
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


const DateRangeViewer = ({ value }: { value: DateTimeRange }) => {
    const t = CalcRelativeTiming(new Date(), value);

    return <KeyValueTable
        data={{
            "Start": value.getStartDateTime()?.toISOString(),
            "Last": value.getLastDateTime()?.toISOString(),
            "End": value.getEndDateTime()?.toISOString(),
            "Duration": `${formatMillisecondsToDHMS(value.getDurationMillis())} (${value.getDurationMillis()} ms)`,
            "Relative label": t.label,
            "Relative Bucket": t.bucket,
            "toString": value.toString(),
        }}
    />;

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMDatePickerProps {
    value: Date;
    onChange: (newValue: Date) => void;
};

export const CMDatePicker = ({ value, ...props }: CMDatePickerProps) => {

    const handleStartDateChange = (newValue: Date) => {
        props.onChange(newValue);
    };

    // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
    return <NoSsr>
        <div className="DateTimeRangeControl">
            <div className="row" style={{ display: "flex", alignItems: "center" }}>

                <DayControl
                    readonly={false}
                    onChange={handleStartDateChange}
                    value={value}
                    coalescedFallbackValue={value}
                    otherValue={null} // use LAST time so it doesn't spill into next day.
                    range={new DateTimeRange({
                        durationMillis: 0,
                        isAllDay: false,
                        startsAtDateTime: value,
                    })}
                    showDuration={false}
                    className="datePart field startDate"
                />
            </div>
        </div>
    </NoSsr>;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DateRange {
    start: Date;
    end: Date;
}

export interface CMDateRangePickerProps {
    value: DateRange;
    onChange: (newValue: DateRange) => void;
};

export const CMDateRangePicker = ({ value, ...props }: CMDateRangePickerProps) => {

    const handleStartDateChange = (newValue: Date) => {
        props.onChange({ ...value, start: newValue });
    };

    const handleEndDateChange = (newValue: Date) => {
        props.onChange({ ...value, end: newValue });
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
                    value={value.start}
                    otherValue={null} // use LAST time so it doesn't spill into next day.
                    range={range}
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
                    value={value.end}
                    otherValue={null} // use LAST time so it doesn't spill into next day.
                    range={range}
                    showDuration={false}
                    className="datePart field startDate"
                />
            </div>
        </div>

    </NoSsr>;
};

