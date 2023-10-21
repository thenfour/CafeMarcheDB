import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
import getAllRoles from "src/auth/queries/getAllRoles";
import getTestQuery from "src/auth/queries/getTestQuery";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { Autocomplete, AutocompleteRenderInputParams, Badge, FormControlLabel, FormGroup, InputBase, MenuItem, NoSsr, Popover, Popper, Select, Switch, TextField, Tooltip } from "@mui/material";
import { DateView, LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { DateTimeRange, DateTimeRangeHitTestResult, DateTimeRangeSpec, DateToString, TimeOption, TimeOptionsGenerator, combineDateAndTime, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, gMillisecondsPerMinute, getTimeOfDayInMillis, getTimeOfDayInMinutes } from "shared/time";
import { CoerceToNumber, CoerceToNumberOrNull, isBetween } from "shared/utils";

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
            if (ht.rangeEnd) className += (" otherEventRangeEnd");
            if (ht.rangeStart) className += (" otherEventRangeStart");
            matchingEvents.push({ eventSpec: item, hitTest: ht, className });
        }
    }

    if (other.outsideCurrentMonth) classes.push(`dayOutsideMonth`);

    const hitTest = range.hitTestDay(day);
    if (hitTest.inRange) {
        classes.push("inRange");
        if (hitTest.rangeEnd) classes.push("rangeEnd");
        if (hitTest.rangeStart) classes.push("rangeStart");
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
                //console.log(state);
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
        //setCalendarAnchorEl(null); // close calendar upon selecting
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
    const endTime = endTimeOptions.findTime(value.getEndDateTime(coalescedStartDateTime));

    const [coalescedFallbackStartDay, setCoalescedFallbackStartDay] = React.useState<Date>(coalescedStartDateTime);

    const handleStartDateChange = (newValue: Date) => {
        setCoalescedFallbackStartDay(newValue);
        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: newValue }));
    };

    const handleEndDateChange = (newEndDate: Date) => {
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

        let newStartDateTime = coalescedStartDateTime;
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
                        otherValue={value.getEndDateTime()}
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
                                readonly={false}
                                onChange={handleEndDateChange}
                                value={value.getEndDateTime()}
                                coalescedFallbackValue={value.getEndDateTime(coalescedFallbackStartDay)}
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
                            control={<Switch checked={value.isAllDay()} onChange={handleAllDayChange} />}
                            label="All-day"
                        />
                    </div>
                </div>

            </>)} */}
        </div>
    </NoSsr>;
};





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

    const [value, setValue] = React.useState<DateTimeRange>(new DateTimeRange());

    const handleChange = (newValue: DateTimeRange) => {
        setValue(newValue);
    };

    return <LocalizationProvider dateAdapter={AdapterDayjs}>
        <NoSsr>
            <div style={{ border: "1px solid black", width: "min-content", margin: "40px" }}>
                <DateTimeRangeControl value={value} onChange={handleChange} items={events} />
            </div>
            <InspectObject src={value} />
            <div>starts at: {DateToString(value.getSpec().startsAtDateTime)} </div>
            <div>raw duration: {formatMillisecondsToDHMS(value.getSpec().durationMillis)}</div>
            <div>getStartDateTime: {DateToString(value.getStartDateTime())}</div>
            <div>getEndDateTime: {DateToString(value.getEndDateTime())}</div>
            <div>getEndBound: {DateToString(value.getEndBound())}</div>
            <div>getEndBoundDay: {DateToString(value.getEndBoundDay())}</div>
            <div>getDuration: {formatMillisecondsToDHMS(value.getDurationMillis())}</div>
        </NoSsr>
    </LocalizationProvider>;
}
