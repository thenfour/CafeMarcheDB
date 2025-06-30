import { Tooltip } from "@mui/material";
import React from "react";
import { CalcRelativeTimingFromNow } from "shared/time";


function formatShortDate(date: Date, locale: string = navigator.language): string {
    const now = new Date();
    //const showYear = date.getFullYear() !== now.getFullYear();
    const formatter = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    // Use formatToParts to filter out punctuation
    const parts = formatter.formatToParts(date);
    return parts
        .filter(part => part.type !== "literal")
        .map(part => part.value)
        .join(" ");
}

// export interface EventShortDateProps {
//     event: Prisma.EventGetPayload<{
//         select: {
//             startsAt: true;
//         }
//     }>;
// };

// export const EventShortDate = ({ event }: EventShortDateProps) => {
//     if (!event.startsAt) return null;
//     const relativeTiming = CalcRelativeTimingFromNow(event.startsAt);
//     return <>
//         {formatShortDate(event.startsAt)}
//         <span className={`EventDateField container ${relativeTiming.bucket}`}><span className="RelativeIndicator">{relativeTiming.label}</span></span>
//     </>
// };


// file uploaded at, created at, event dates, etc.
export const DateValue = (props: { value: Date | undefined | null }) => {
    if (!props.value) return <span className="DateValue null">--</span>;
    const now = React.useMemo(() => new Date(), []);

    const rel = CalcRelativeTimingFromNow(props.value, now);
    const dayOfWeekLabel = props.value.toLocaleDateString(undefined, { weekday: "long" });

    return <Tooltip title={
        <span>
            {dayOfWeekLabel}
            <br />
            {props.value.toLocaleDateString()} {props.value.toLocaleTimeString()}
            <br />
            {rel.label}
        </span>
    }>
        <span className="DateValue">{formatShortDate(props.value)}</span>
    </Tooltip>;
}

