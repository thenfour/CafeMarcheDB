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
import { Autocomplete, AutocompleteRenderInputParams, FormControlLabel, FormGroup, InputBase, MenuItem, NoSsr, Popover, Popper, Select, Switch, TextField, Tooltip } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import { DateTimeRange, DateTimeRangeSpec, TimeOption, TimeOptionsGenerator, combineDateAndTime, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, gMillisecondsPerMinute, getTimeOfDayInMillis, getTimeOfDayInMinutes } from "shared/time";
import { CoerceToNumber, CoerceToNumberOrNull, isBetween } from "shared/utils";


// some notes about dates & times...
// there are a lot of POSSIBLE options, but we should not present them. nobody wants to think that much about dates.
// we just want to select the date.
// and it wants to be done in a natural way as possible for all scenarios.
// for example,
// this is bad:

// Start Date: [ ] TBD [wednesday october 5, 2023]  [_] all-day [10:15 pm]
// End Date  : [ ] TBD [wednesday october 8, 2023]  [x] all-day

// it reads very awkwardly. even "start date TBD" is just ugly. and while in theory, indeterminate endpoints are interesting,
// like "starting from 5 Oct" when end date is null.
// it's totally impractical to impose this rare edge case on the everyday experience.
// similarly it's not practical to specify "all-day" for one endpoint but not the other.

// [_] Date TBD
// [_] All-day
// [wednesday october 5, 2023] [10:15 pm] - [wednesday october 8, 2023] [12:30pm]

// further, "all-day" suggests a lot about whether it's multi-day or not. it's pretty rare to specify times for both dates.
// it's not impossible though (11pm - 2am concerts are possible) maybe hide it behind an advanced option.

// and "TBD" doesn't need to be on all the time. here's disabled:

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
//
// OR, assuming days which specify times never exceed 24 hours, it's quite simple... i mean, we don't have events that last more than 24 hours like that.
// especially not in eventsegments.






// SINGLE DAY, ALL-DAY
//     [ ] TBD [wednesday october 5, 2023]

//     [x] TBD [ to be determined        ]

// SINGLE DAY, WITH TIME
//     Starts at: [ ] TBD [wednesday october 5, 2023] [ 08:45 ]
//     Ends at  : [ ] TBD                             [ ----- ]

// MULTI-DAY
//     starts: [wednesday october 5, 2023] [ 08:45 ] [ ] TBD
//     ends:   [wednesday october 6, 2023] [ 08:45 ] [ ] TBD

//     starts: [ to be determined        ] [       ] [x] TBD
//     ends:   [wednesday october 6, 2023] [ 08:45 ] [ ] TBD

//type DateTimeRangeEndpointOption = keyof (Pick<DateTimeRangeSpec, "endsAtDateTime" | "startsAtDateTime">);

class CalendarEventSpec {
    dateRange: DateTimeRange;
    title: string;
    constructor(args: { dateRange: DateTimeRange, title: string }) {
        this.dateRange = args.dateRange;
        this.title = args.title;
    }
    touchesDay(day: Dayjs) {
        const startDate = this.dateRange.getStartDateTime();
        if (!startDate) return false;
        const endBound = this.dateRange.getEndBoundDay()!;
        if (day.isSame(endBound, "day") || day.isAfter(endBound, "day")) return false;
        if (day.isBefore(startDate, "day")) return false;
        return true;
    }
}

interface DaySlotProps extends PickersDayProps<Dayjs> {
    otherDay: Dayjs | null;
    selectedDay: Dayjs;
    items: CalendarEventSpec[];
};

function DaySlot({ day, selectedDay, otherDay, items, ...other }: DaySlotProps) {
    const now = dayjs();
    const classes: string[] = [
        "day",
    ];

    let rangeBegin: Dayjs | null = null;
    let rangeEnd: Dayjs | null = null;
    if (otherDay) { // if other date is not specified, no range to be shown.
        if (selectedDay.isAfter(otherDay, "day")) {
            rangeBegin = otherDay;
            rangeEnd = selectedDay;
        } else {
            rangeBegin = selectedDay;
            rangeEnd = otherDay;
        }
    }

    const tooltips: string[] = [];

    for (let i = 0; i < items.length; ++i) {
        const item = items[i]!;
        if (item.touchesDay(day)) {
            classes.push("event");
            tooltips.push(item.title);
        }
    }

    if (now.isSame(day, "day")) { classes.push("today"); tooltips.push("This is today"); }
    if (selectedDay.isSame(day, "day")) { classes.push("selected"); tooltips.push("This is the current selection"); }
    if (day.isBefore(now, "day")) { classes.push("past"); tooltips.push("This date is in the past"); }
    if (otherDay && day.isSame(otherDay, "day")) classes.push("otherSelected");

    if (rangeBegin && rangeBegin.isSame(day, "day")) classes.push("inRange rangeStart");
    if (rangeEnd && rangeEnd.isSame(day, "day")) classes.push("inRange rangeEnd");
    if (otherDay && isBetween(day.valueOf(), otherDay.valueOf(), selectedDay.valueOf())) classes.push("inRange");

    if (day.day() === 0 || day.day() === 6) { classes.push("weekend"); tooltips.push("This is a weekend") };// Check if the day is a weekend (Saturday or Sunday) and add the "weekend" class.

    // https://stackoverflow.com/questions/42282698/how-do-i-set-multiple-lines-to-my-tooltip-text-for-material-ui-iconbutton
    // unfortunately i'm unable to get Tootltip to work with the PickersDay component. oh well another day.
    // return <Tooltip title={tooltips.length ? <div style={{ whiteSpace: 'pre-line' }}>{tooltips.join(` \r\n`)}</div> : null}>
    return <PickersDay disableMargin className={classes.join(" ")} day={day} {...other} />
    //</Tooltip>;
}


interface EventCalendarMonthProps {
    value: Date;
    onChange: (value: Date) => void;
    otherDay: Date | null;
    items: CalendarEventSpec[];
};

export const EventCalendarMonth = (props: EventCalendarMonthProps) => {
    const djs = dayjs(props.value);
    const otherDjs = props.otherDay === null ? null : dayjs(props.otherDay);
    return <DateCalendar
        className="EventCalendarMonth"
        defaultValue={djs} views={["day", "year"]}
        value={djs}
        onChange={v => props.onChange(v?.toDate()!)}
        slots={{ day: DaySlot }}
        slotProps={{
            day: {
                selectedDay: djs,
                otherDay: otherDjs,
                items: props.items,
            } as any,
        }}
    />;
};


// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface DateTimeEndpointControlProps {
//     value: DateTimeRangeSpec;
//     onChange: (newValue: DateTimeRangeSpec) => void;
//     member: DateTimeRangeEndpointOption;
//     label: string;
//     dayEditable: boolean; // for "single day" events, we show 2 controls (start, end). but the "end" control should not display the day.
//     showMultidayControl: boolean; // similar for end date, this is available.
//     showAllDayControl: boolean;
// };


// // SINGLE DAY, ALL-DAY
// //     [wednesday october 5, 2023] [ ] TBD
// //     [ to be determined        ] [x] TBD

// // SINGLE DAY, WITH TIME
// //     [wednesday october 5, 2023] [ 08:45 ] [ ] TBD
// //     [ to be determined        ] [       ] [x] TBD

// const DateTimeEndpointControl = (props: DateTimeEndpointControlProps) => {
//     const [timeOptions, setTimeOptions] = React.useState(() => new TimeOptionsGenerator(15));
//     const [now] = React.useState(() => new Date());

//     //const [showingCalendar, setShowingCalendar] = React.useState<boolean>(false);

//     const inputDateTime: Date | null = props.value[props.member];
//     const isTBD = inputDateTime === null;

//     // internal value that the user has selected, to be used when the externally-visible value goes NULL, we can still revert back to this.
//     const [fallbackDay, setFallbackDay] = React.useState<Date>(inputDateTime || now);
//     const shownDay: Date = inputDateTime || fallbackDay;

//     // required because selectedTime
//     // 'value' just has a time. this is the corresponding time option. to be populated when timeOptions is initialized.
//     const selectedTime = timeOptions.findTime(inputDateTime || now);

//     const [calendarAnchorEl, setCalendarAnchorEl] = React.useState<null | HTMLElement>(null);

//     const handleDateClick = (event: React.MouseEvent<HTMLElement>) => {
//         if (!props.dayEditable) return;
//         // clicking on the date, show the date picker.
//         setCalendarAnchorEl(event.currentTarget);
//     };

//     const handleChangeDay = (newDay: Date) => {
//         const newDateTime = combineDateAndTime(newDay, selectedTime.time);
//         setFallbackDay(newDay);
//         props.onChange({ ...props.value, [props.member]: newDateTime });
//         setCalendarAnchorEl(null);
//     };

//     const handleCalendarClose = () => {
//         setCalendarAnchorEl(null);
//     };

//     const handleChangeTime = (newTimeLabel: string) => {
//         const newTime = timeOptions.getOptions().find(o => o.label === newTimeLabel)!;
//         if (newTime === null) return;
//         const newDateTime = combineDateAndTime(shownDay, newTime.time);
//         setFallbackDay(newDateTime);
//         props.onChange({ ...props.value, [props.member]: newDateTime });
//         console.log(`user selected time: ${newTimeLabel} => new time: ${newDateTime.toTimeString()}`);
//     };

//     if (!timeOptions) {
//         // don't render if we haven't initialized.
//         return null;
//     }

//     return <div className={`DateTimeEndpoint ${props.member}`}>
//         <div className="endpointLabel">{props.label}</div>
//         <FormControlLabel
//             control={<Switch checked={isTBD} onChange={(e) => {
//                 if (e.target.checked) {
//                     props.value[props.member] = null;// TBD; make it null.
//                 } else {
//                     props.value[props.member] = shownDay;
//                 }
//                 props.onChange({ ...props.value });

//             }} />}
//             label="TBD"
//         />

//         <div className="multidayOption">
//             {props.showMultidayControl &&
//                 <FormControlLabel
//                     control={<Switch checked={props.value.isMultiDay} onChange={(e) => {
//                         props.value.isMultiDay = e.target.checked;
//                         props.onChange({ ...props.value });
//                     }} />}
//                     label="Multi-day"
//                 />
//             }
//         </div>

//         {isTBD ? (
//             <div className={`datePart interactable tbd"}`} onClick={handleDateClick}>{gIconMap.CalendarMonth()}To be determined</div>
//         ) : (
//             <div className={`datePart determined ${props.dayEditable ? "interactable editable" : "readonly"}`} onClick={handleDateClick}>{gIconMap.CalendarMonth()}{shownDay.toLocaleDateString()}</div>
//         )}


//         <div className="allDayControl">
//             {props.showAllDayControl && (<FormControlLabel
//                 control={<Switch checked={props.value.isAllDay} onChange={(e) => {
//                     props.value.isAllDay = e.target.checked;
//                     props.onChange({ ...props.value });
//                 }} />}
//                 label="All-day"
//                 labelPlacement="top"
//             />)}
//         </div>

//         {!props.value.isAllDay && !isTBD && (
//             <div className="timePart">
//                 <Select
//                     value={selectedTime!.label}
//                     label="Time of day"
//                     onChange={(e) => handleChangeTime(e.target.value)}
//                 >
//                     {timeOptions.getOptions().map(v => <MenuItem key={v.label} value={v.label}>{v.label}</MenuItem>)}
//                 </Select>
//             </div>
//         )}



//         {calendarAnchorEl &&
//             <Popover
//                 open={true}
//                 anchorEl={calendarAnchorEl}
//                 onClose={handleCalendarClose}
//                 anchorOrigin={{
//                     vertical: 'bottom',
//                     horizontal: 'left',
//                 }}
//             >
//                 <EventCalendarMonth value={shownDay} range={props.value} onChange={handleChangeDay} />
//             </Popover>
//         }

//     </div>;
// };


// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// interface DateTimeRangeControlProps {
//     value: DateTimeRangeSpec;
//     onChange: (newValue: DateTimeRangeSpec) => void;
// };

// const DateTimeRangeControl = (props: DateTimeRangeControlProps) => {

//     const handleChange = (newValue: DateTimeRangeSpec) => {
//         const nv: DateTimeRangeSpec = { ...newValue };
//         if (!newValue.isMultiDay) {
//             if (!!nv.startsAt && !!nv.endsAt) {
//                 console.log(`correcting ends at date [${nv.startsAt.toDateString()}, ${nv.endsAt.toDateString()}] =>`);
//                 nv.endsAt = combineDateAndTime(nv.startsAt, nv.endsAt); // use date of start, preserve time.
//                 console.log(`                    ==> [${nv.startsAt.toDateString()}, ${nv.endsAt.toDateString()}]`);
//             }
//         }

//         props.onChange(nv);
//     };

//     // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
//     return <NoSsr>
//         <div className="DateTimeRangeControl">
//             <DateTimeEndpointControl value={props.value} member="startsAt" label="Start time" onChange={handleChange} dayEditable={true} showMultidayControl={false} showAllDayControl={true} />
//             <DateTimeEndpointControl value={props.value} member="endsAt" label="End time" onChange={handleChange} dayEditable={props.value.isMultiDay} showMultidayControl={true} showAllDayControl={false} />
//         </div>
//     </NoSsr>;
// };

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface DayControlProps {
    value: Date | null;
    otherValue: Date | null;
    coalescedFallbackValue: Date;
    onChange: (newValue: Date) => void;
    readonly: boolean;
    items: CalendarEventSpec[];
};
const DayControl = (props: DayControlProps) => {

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
            <div className={`datePart field tbd  ${props.readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>{gIconMap.CalendarMonth()}TBD</div>
        ) : (
            <div className={`datePart field determined ${props.readonly ? "readonly" : "interactable editable"}`} onClick={handleFieldClick}>
                {gIconMap.CalendarMonth()}
                {coalescedDay.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: "numeric" })}
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
                <EventCalendarMonth value={coalescedDay} onChange={handleCalendarChangeDay} otherDay={props.otherValue} items={props.items} />
            </Popover >
        }

    </>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CMDBSelectProps<T> {
    value: T;
    onChange: (newValue: T) => void;
    options: T[];
    getOptionString: (option: T) => string;
    getOptionID: (option: T) => string;
    className?: string;
};

const CMDBSelect = <T,>(props: CMDBSelectProps<T>) => {
    return <select className={props.className} onChange={(e) => {
        const f = props.options.find(o => props.getOptionID(o) === e.target.value);
        if (!f) throw new Error(`couldn't find option ${e.target.value}`);
        props.onChange(f);
    }} value={props.getOptionID(props.value)}>
        {props.options.map(v => (<option value={props.getOptionID(v)}>{props.getOptionString(v)}</option>))}
    </select>
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface DateTimeRangeControlProps {
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

const DateTimeRangeControl = ({ value, ...props }: DateTimeRangeControlProps) => {

    // sanitize input value
    //const isTBD = !value.startsAtDateTime; // don't use enddate for this because it may not be used in case of duration
    const coalescedStartDateTime = value.getStartDateTime(new Date());
    //const coalescedEndDateTime = dayjs(coalescedStartDateTime).add(props.value.durationMillis, "milliseconds").toDate();
    // const endDateTimeOrNull = !props.value.startsAtDateTime ? null : coalescedEndDateTime;

    const startTimeOptions = new TimeOptionsGenerator(15, 0);
    const endTimeOptions = new TimeOptionsGenerator(15, getTimeOfDayInMinutes(coalescedStartDateTime));

    const startTime = startTimeOptions.findTime(coalescedStartDateTime);
    const endTime = endTimeOptions.findTime(value.getEndDateTime(coalescedStartDateTime));

    const [coalescedFallbackStartDay, setCoalescedFallbackStartDay] = React.useState<Date>(coalescedStartDateTime);
    // const coalescedFallbackEndDay = dayjs(coalescedFallbackStartDay).add(props.value.durationMillis, "millisecond").toDate();

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

    // const handleChangeEndTime = (newTimeIndex: number) => {
    //     const newTime = endTimeOptions.getOptions()[newTimeIndex]!;
    //     props.onChange(new DateTimeRange({ ...value.getSpec(), durationMillis: newTime.millisSinceStart }));
    // };

    const handleChangeEndTime2 = (newTime: TimeOption) => {
        //const newTime = endTimeOptions.getOptions()[newTimeIndex]!;
        props.onChange(new DateTimeRange({ ...value.getSpec(), durationMillis: newTime.millisSinceStart }));
    };

    // NoSsr because without it, the dates will cause hydration errors due to server/client mismatches.
    return <NoSsr>
        <div className="DateTimeRangeControl">
            <div className="row">
                <div className="tbdControl field">
                    <Switch checked={!value.isTBD()} onChange={(e) => {
                        props.onChange(new DateTimeRange({ ...value.getSpec(), startsAtDateTime: e.target.checked ? coalescedFallbackStartDay : null }));
                    }} />
                </div>

                <DayControl readonly={false} onChange={handleStartDateChange} value={value.getStartDateTime()} coalescedFallbackValue={coalescedFallbackStartDay} otherValue={value.getEndDateTime()} items={props.items} />

                {!value.isTBD() && (
                    <>
                        {!value.isAllDay() && !value.isTBD() && (
                            <div className="timePart field">

                                <CMDBSelect className="interactable startTime" value={startTime} onChange={handleChangeStartTime2} getOptionID={o => `id_${o.index}`} options={startTimeOptions.getOptions()} getOptionString={o => o.label} />

                            </div>
                        )}

                        <div className="ndash field">&nbsp;&ndash;&nbsp;</div>

                        {value.isAllDay() && <DayControl readonly={false} onChange={handleEndDateChange} value={value.getEndDateTime()} coalescedFallbackValue={value.getEndDateTime(coalescedFallbackStartDay)} otherValue={value.getStartDateTime()} items={props.items} />}

                        {!value.isAllDay() && !value.isTBD() && (
                            <div className="timePart field">
                                <CMDBSelect className="interactable endTime" value={endTime} onChange={handleChangeEndTime2} getOptionID={o => `id_${o.index}`} options={endTimeOptions.getOptions()} getOptionString={o => o.labelWithDuration} />
                            </div>
                        )}

                        {value.isAllDay() && <div className="duration field">
                            ({formatMillisecondsToDHMS(value.getDurationMillis())})
                        </div>}
                    </>
                )/* isTBD */}

            </div>

            {!value.isTBD() && (<>
                <div className="row">
                    <div className="allDayControl">
                        <FormControlLabel
                            control={<Switch checked={value.isAllDay()} onChange={(e) => {
                                // if switching from multi-day span to 24-hour span, reset duration to default.
                                props.onChange(new DateTimeRange({ ...value.getSpec(), isAllDay: e.target.checked, durationMillis: e.target.checked ? gMillisecondsPerDay : gMillisecondsPerHour }));
                            }} />}
                            label="All-day"
                        />
                    </div>
                </div>

            </>)}
        </div>
    </NoSsr>;
};



const TestPageContent = () => {

    // default
    // const initialValue: DateTimeRangeSpec = {
    //     startsAtDateTime: new Date(),
    //     //endsAtDateTime: null,
    //     durationMillis: gMillisecondsPerHour,
    //     isAllDay: false,
    // };

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
        new CalendarEventSpec({
            title: "a single-day all day event",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay,
                isAllDay: true,
                startsAtDateTime: MakeDay(2, 0),
            }),
        }),
        new CalendarEventSpec({
            title: "a single-day all day event but with incorrect duration",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerHour,
                isAllDay: true,
                startsAtDateTime: MakeDay(4, 0),
            }),
        }),
        new CalendarEventSpec({
            title: "a single-day event within a day",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerMinute * 15,
                isAllDay: false,
                startsAtDateTime: MakeDay(6, gMillisecondsPerHour * 13),
            }),
        }),
        new CalendarEventSpec({
            title: "two-day event",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerDay * 2,
                isAllDay: true,
                startsAtDateTime: MakeDay(9, 0),
            }),
        }),
        new CalendarEventSpec({
            title: "an event that starts at 11:30 for 2 hours, spanning 2 days",
            dateRange: new DateTimeRange({
                durationMillis: gMillisecondsPerHour * 2,
                isAllDay: false,
                startsAtDateTime: MakeDayTime(13, 11, 30),
            }),
        }),
    ];

    const [value, setValue] = React.useState<DateTimeRange>(new DateTimeRange());

    const handleChange = (newValue: DateTimeRange) => {
        setValue(newValue);
    };

    const DateToString = (x: Date | null | undefined) => {
        if (!x) return "<null>";
        return `${x.toDateString()} ${x.toTimeString()}`;
    }

    return <LocalizationProvider dateAdapter={AdapterDayjs}>
        <NoSsr>
            <div>hello.</div>
            <DateTimeRangeControl value={value} onChange={handleChange} items={events} />
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

const TestPage: BlitzPage = () => {
    return <Suspense fallback={"outer suspense"}><TestPageContent /></Suspense>;
}

export default TestPage;
