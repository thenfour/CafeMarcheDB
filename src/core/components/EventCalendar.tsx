import * as React from 'react';
import { FormControlLabel, NoSsr, Popover, Switch, Tooltip } from "@mui/material";
import { DateCalendar, DateView, LocalizationProvider, PickersDay, PickersDayProps } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { assert } from 'blitz';
import dayjs, { Dayjs } from "dayjs";
import { CalcRelativeTiming, DateTimeRange, DateTimeRangeHitTestResult, TimeOption, TimeOptionsGenerator, combineDateAndTime, floorLocalToLocalDay, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, gMillisecondsPerMinute, getTimeOfDayInMinutes } from "shared/time";
import { NameValuePair } from './CMCoreComponents2';
import { gIconMap } from '../db3/components/IconMap';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CalendarEventSpec {
    id: string;
    dateRange: DateTimeRange;
    title: string;
    color: string;
}

export interface BigDaySlotProps extends PickersDayProps<Dayjs> {
    selectedDay: Dayjs;
    items: CalendarEventSpec[];
};

export function BigDaySlot({ day, selectedDay, items, ...other }: BigDaySlotProps) {
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

    if (day.day() === 0 || day.day() === 6) {
        classes.push("weekend");
    };

    return <div
        key={day.toString()}
        className={`dayContainer ${classes.join(" ")}`}
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
        <div className="dayCustomArea">
            {
                matchingEvents.length > 0 && <div style={{ ["--event-color"]: matchingEvents[0]!.eventSpec.color } as any} key={matchingEvents[0]!.eventSpec.id} className={matchingEvents[0]!.className}></div>
            }
        </div>
        <div className="dayGridLines"></div>
    </div>
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface BigEventCalendarMonthProps {
    value: Date;
    onChange: (value: Date) => void;
    items: CalendarEventSpec[];
};

export const BigEventCalendarMonth = (props: BigEventCalendarMonthProps) => {
    const djs = dayjs(props.value);
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
            slots={{ day: BigDaySlot }}
            slotProps={{
                day: {
                    selectedDay: djs,
                    items: props.items,
                } as any,
            }}
        />
    </div>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface BigEventCalendarProps {
    value: Date;
    onChange: (value: Date) => void;
    items: CalendarEventSpec[];
};

export const BigEventCalendar = (props: BigEventCalendarProps) => {
    const djs = dayjs(props.value);
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
            slots={{ day: BigDaySlot }}
            slotProps={{
                day: {
                    selectedDay: djs,
                    items: props.items,
                } as any,
            }}
        />
    </div>;
};

