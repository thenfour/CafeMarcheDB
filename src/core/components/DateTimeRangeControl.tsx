import * as React from 'react';
//import * as DB3Client from "src/core/db3/DB3Client";
import { FormControlLabel, NoSsr, Popover, Switch, Tooltip } from "@mui/material";
import { DateCalendar, DateView, LocalizationProvider, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { assert } from 'blitz';
import dayjs, { Dayjs } from "dayjs";
import { DateTimeRange, DateTimeRangeHitTestResult, TimeOption, TimeOptionsGenerator, combineDateAndTime, floorLocalToLocalDay, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, gMillisecondsPerMinute, getTimeOfDayInMinutes } from "shared/time";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { NameValuePair } from './CMCoreComponents2';

export interface CalendarEventSpec {
    id: string;
    dateRange: DateTimeRange;
    title: string;
    color: string;
}

export interface DaySlotProps extends PickersDayProps<Dayjs> {
    otherDay: Dayjs | null;
    range: DateTimeRange;
    selectedDay: Dayjs;
    items: CalendarEventSpec[];
    //tooltipRef: HTMLDivElement | null;
};

export function DaySlot({ day, selectedDay, range, items, otherDay, ...other }: DaySlotProps) {
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
            //classes.push("otherEventInRange");
            tooltips.push(item.title);
            // if (ht.rangeEnd) classes.push("otherEventRangeEnd");
            // if (ht.rangeStart) classes.push("otherEventRangeStart");
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
        //        tooltips.push("This is a weekend");
    };

    // https://stackoverflow.com/questions/42282698/how-do-i-set-multiple-lines-to-my-tooltip-text-for-material-ui-iconbutton

    return <div
        key={day.toString()}
        className={`dayContainer ${classes.join(" ")}`}
    >
        <Tooltip
            title={tooltips.length ? <div style={{ whiteSpace: 'pre-line' }}>{tooltips.join(` \r\n`)}</div> : null}
            arrow
            disableInteractive
        >
            <div className="pickersContainer">{/* https://stackoverflow.com/a/73492810/402169 PickersDay wrapped in Tootlip somehow doesn't work, but adding a div here fixes it. */}
                <PickersDay {...other} disableMargin day={day} disableHighlightToday disableRipple />
            </div>
        </Tooltip>
        <div className="selectionIndicator"></div>
        <div className="selectionBackground"></div>
        <div className="dayCustomArea">
            {
                matchingEvents.length > 0 && <div style={{ ["--event-color"]: matchingEvents[0]!.eventSpec.color } as any} key={matchingEvents[0]!.eventSpec.id} className={matchingEvents[0]!.className}></div>
            }
        </div>
        <div className="dayGridLines"></div>
    </div>
}

export interface EventCalendarMonthProps {
    value: Date;
    onChange: (value: Date) => void;
    otherDay: Date | null;
    range: DateTimeRange;
    items: CalendarEventSpec[];
};

export const EventCalendarMonth = (props: EventCalendarMonthProps) => {
    const djs = dayjs(props.value);
    const otherDjs = props.otherDay === null ? null : dayjs(props.otherDay);
    const [view, setView] = React.useState<DateView>("day");
    return <div className="EventCalendarMonthContainer">
        <DateCalendar
            showDaysOutsideCurrentMonth
            className="EventCalendarMonth"
            defaultValue={djs} views={["day", "year"]}
            value={djs}
            view={view}
            onViewChange={(view) => {
                setView(view);
            }}
            onChange={(v, state) => {
                props.onChange(v?.toDate()!);
            }}
            slots={{ day: DaySlot }}
            slotProps={{
                day: {
                    selectedDay: djs,
                    otherDay: otherDjs,
                    items: props.items,
                    range: props.range,
                } as any,
            }}
        />
    </div>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface DayControlProps {
    value: Date | null;
    otherValue: Date | null;
    coalescedFallbackValue: Date;
    onChange: (newValue: Date) => void;
    readonly: boolean;
    items: CalendarEventSpec[];
    range: DateTimeRange;
    showDuration: boolean;
    className?: string;
};

export const DayControl = (props: DayControlProps) => {

    const inputDate: Date | null = props.value;
    const isTBD = inputDate === null;

    // internal value that the user has selected, to be used when the externally-visible value goes NULL, we can still revert back to this.
    const coalescedDay: Date = inputDate || props.coalescedFallbackValue;

    const [calendarAnchorEl, setCalendarAnchorEl] = React.useState<null | HTMLElement>(null);

    const handleFieldClick = (event: React.MouseEvent<HTMLElement>) => {
        if (props.readonly) return;
        setCalendarAnchorEl(event.currentTarget);
    };

    const handleCalendarChangeDay = (newDay: Date) => {
        props.onChange(newDay);
        setCalendarAnchorEl(null); // close calendar upon selecting
    };

    const handleCalendarClose = () => {
        setCalendarAnchorEl(null);
    };

    return <>
        {isTBD ? (
            <div className={`${props.className} tbd  ${props.readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>{gIconMap.CalendarMonth()}TBD</div>
        ) : (
            <div className={`${props.className} determined ${props.readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>
                {gIconMap.CalendarMonth()}
                {coalescedDay.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: "numeric" })}
                {props.showDuration && <div className="duration">
                    &nbsp;({formatMillisecondsToDHMS(props.range.getDurationMillis())})
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
                    items={props.items}
                    range={props.range}
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
    items: CalendarEventSpec[];
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
                        items={props.items}
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
                                items={props.items}
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
            {/* 
            {!value.isTBD() && (<>
                <div className="row">
                    <div className="allDayControl">
                        <FormControlLabel
                        className='CMFormControlLabel'
                            control={<Switch checked={value.isAllDay()} onChange={handleAllDayChange} />}
                            label="All-day"
                        />
                    </div>
                </div>

            </>)} */}
        </div>
    </NoSsr>;
};



const DateViewer = (props: { caption: string, value: Date | null | undefined }) => {
    return <NameValuePair
        name={props.caption}
        value={<div>
            <div>
                {props.value?.toISOString() || "--"} &lt;-- ISO
            </div>
            <div>
                {props.value?.toString() || "--"} &lt;-- local (tz offset: {props.value?.getTimezoneOffset()})
            </div>
        </div>}
    />;
}

const DateRangeViewer = ({ value }: { value: DateTimeRange }) => {
    return <div>
        {/* <InspectObject src={value} /> */}
        <DateViewer value={value.getStartDateTime()} caption='getStartDateTime'></DateViewer>
        <DateViewer value={value.getLastDateTime()} caption='getLastDateTime'></DateViewer>
        <DateViewer value={value.getEndDateTime()} caption='getEndDateTime'></DateViewer>
        <div>duration: {formatMillisecondsToDHMS(value.getDurationMillis())}</div>
        <DateViewer value={value.getSpec().startsAtDateTime} caption='SPEC StartsAt'></DateViewer>
        <div>spec duration: {formatMillisecondsToDHMS(value.getSpec().durationMillis)}</div>
    </div>;
}

export const DateTimeRangeControlExample = () => {

    const MakeDay = (day: number, millisIntoDay: number) => {
        const now = new Date();
        const ret = new Date(now.getFullYear(), now.getMonth(), day);
        return new Date(ret.valueOf() + millisIntoDay);
    };

    const MakeDayTime = (day: number, hour: number, minute: number) => {
        const now = new Date();
        const ret = new Date(now.getFullYear(), now.getMonth(), day, hour, minute);
        return new Date(ret.valueOf());
    };

    const events: CalendarEventSpec[] = [
        ({
            id: "1",
            color: "red",
            title: "a single-day all day event",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay,
                isAllDay: true,
                startsAtDateTime: MakeDay(2, 0),
            }),
        }),
        ({
            id: "2",
            color: "blue",
            title: "a single-day all day event but with incorrect duration",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerHour,
                isAllDay: true,
                startsAtDateTime: MakeDay(4, 0),
            }),
        }),
        ({
            id: "3",
            color: "green",
            title: "a single-day event within a day",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerMinute * 15,
                isAllDay: false,
                startsAtDateTime: MakeDay(6, gMillisecondsPerHour * 13),
            }),
        }),
        ({
            id: "4",
            color: "yellow",
            title: "two-day event",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay * 2,
                isAllDay: true,
                startsAtDateTime: MakeDay(9, 0),
            }),
        }),
        ({
            id: "5",
            color: "cyan",
            title: "an event that starts at 11:30 for 2 hours, spanning 2 days",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerHour * 2,
                isAllDay: false,
                startsAtDateTime: MakeDayTime(13, 11, 30),
            }),
        }),
        ({
            id: "6",
            color: "orange",
            title: "an event that spans 10 days",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay * 10,
                isAllDay: false,
                startsAtDateTime: MakeDay(16, 0),
            }),
        }),
        ({
            id: "7",
            color: "purple",
            title: "a 2nd event that spans 10 days",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay * 10,
                isAllDay: false,
                startsAtDateTime: MakeDay(17, 0),
            }),
        }),
    ];

    const [value1, setValue1] = React.useState<DateTimeRange>(new DateTimeRange({
        isAllDay: true,
        startsAtDateTime: new Date(),
        durationMillis: 0,
    }));

    const [value2, setValue2] = React.useState<DateTimeRange>(new DateTimeRange({
        isAllDay: true,
        startsAtDateTime: new Date(),
        durationMillis: 0,
    }));

    const handleChange1 = (newValue: DateTimeRange) => {
        setValue1(newValue);
    };

    const handleChange2 = (newValue: DateTimeRange) => {
        setValue2(newValue);
    };

    const x = new DateTimeRange({
        isAllDay: true,
        startsAtDateTime: new Date('2024-04-28T00:00:00.000Z'),
        durationMillis: gMillisecondsPerDay,
    });

    const y = new DateTimeRange({
        isAllDay: true,
        startsAtDateTime: new Date('2024-04-28T00:00:00.000Z'),
        durationMillis: gMillisecondsPerDay * 2,
    });

    //console.log(`unioninng`);
    //const unioned = x.unionWith(y);
    const unioned = value1.unionWith(value2);

    return <LocalizationProvider dateAdapter={AdapterDayjs}>
        <NoSsr>
            <div style={{ border: "1px solid black", width: "min-content", margin: "40px" }}>
                <DateTimeRangeControl value={value1} onChange={handleChange1} items={events} />
            </div>

            <DateRangeViewer value={value1} />
            <div style={{ border: "1px solid black", width: "min-content", margin: "40px" }}>
                <DateTimeRangeControl value={value2} onChange={handleChange2} items={events} />
            </div>
            <DateRangeViewer value={value2} />

            <div>UNIONED:</div>

            <DateRangeViewer value={unioned} />

        </NoSsr>
    </LocalizationProvider>;
}
