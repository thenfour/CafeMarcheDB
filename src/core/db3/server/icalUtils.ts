import { hash256 } from "@blitzjs/auth";
import { Prisma } from "db";
import { convert } from 'html-to-text';
import MarkdownIt from 'markdown-it';
import { CoalesceBool } from "shared/utils";
import * as db3 from "../db3";
import { DateTimeRange } from "shared/time";
import { ICalEventStatus } from "ical-generator";
import { SongListIndexAndNamesToString } from "../shared/setlistApi";


// Function to convert Markdown to plain text
const markdownToPlainText = (markdownText: string): string => {
    const md = new MarkdownIt();
    const htmlText = md.render(markdownText);

    // Convert HTML to plain text
    const plainText = convert(htmlText, {
        wordwrap: null
    });

    return plainText;
};

export const EventSongListDividerForCalArgs = Prisma.validator<Prisma.EventSongListDividerDefaultArgs>()({
    select: {
        id: true,
        sortOrder: true,
        subtitle: true,
        eventSongListId: true,
    },
});

export const EventSongListForCalArgs = Prisma.validator<Prisma.EventSongListDefaultArgs>()({
    select: {
        description: true,
        name: true,
        dividers: EventSongListDividerForCalArgs,
        songs: {
            select: {
                subtitle: true,
                sortOrder: true,
                eventSongListId: true,
                id: true,
                songId: true,
                song: {
                    select: {
                        name: true,
                        id: true,
                        startBPM: true,
                        endBPM: true,
                    }
                }
            },
            // orderBy: {
            //     sortOrder: "asc",
            // }
        },
    },
});

export const EventSegmentForCalArgs = Prisma.validator<Prisma.EventSegmentDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        startsAt: true,
        isAllDay: true,
        durationMillis: true,
        uid: true,
    }
});

export const EventForCalArgs = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        revision: true,
        calendarInputHash: true,

        locationDescription: true,
        locationURL: true,
        segments: EventSegmentForCalArgs,
        status: {
            select: {
                significance: true,
            }
        },
        songLists: {
            ...EventSongListForCalArgs,
            orderBy: {
                sortOrder: "asc",
            }
        },
    }
});

export type EventSongListForCal = Prisma.EventSongListGetPayload<typeof EventSongListForCalArgs>;
export type EventForCal = Prisma.EventGetPayload<typeof EventForCalArgs>;
export type EventSegmentForCal = Prisma.EventSegmentGetPayload<typeof EventSegmentForCalArgs>;



/*
-------------
set 1

 1. song
 2. song
 3. song
 4. song
 5. song
 6. song
 7. song
 8. song
 9. song
10. song

*/
// const songListToString = (l: EventSongListForCal) => {
//     // TODO: include dividers.
//     const songsFormatted = l.songs
//         .map((song, index) => `${(index + 1).toString().padStart(2, ' ')}. ${song.song.name}${IsNullOrWhitespace(song.subtitle) ? "" : ` (${song.subtitle})`}`);
//     return `-------------
// ${l.name}

// ${songsFormatted.join("\n")}`;
// };


export type EventCalendarInput = Pick<EventForCal,
    "revision"
    | "locationDescription"
> &
    Pick<EventSegmentForCal, "isAllDay" | "uid"> &
{
    //inputHash: string,
    description: string,
    //summary: string,
    name: string,
    //cancelledText: string,
    statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance),

    start: Date,
    end: Date,

    calStatus: ICalEventStatus,
    eventId: number,
    segmentId: number,
};


function prepareAllDayDateForICal(date) {
    const ret = new Date(date);
    ret.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return ret;
}



// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
// returns null if no event can be generated
type GetEventSegmentCalendarInputArgs = {
    event: Partial<EventForCal>;
    segment: EventSegmentForCal;
    //statusSignificance: db3.EventStatusSignificance | undefined;
    //calStatus: ICalEventStatus;
    descriptionText: string;
    //locationDescription: string;
};
export const GetEventSegmentCalendarInput = ({ segment, event, descriptionText, ...args }: GetEventSegmentCalendarInputArgs): EventCalendarInput | null => {
    const dateRange = new DateTimeRange({
        startsAtDateTime: segment.startsAt || null,
        durationMillis: Number(segment.durationMillis),
        isAllDay: CoalesceBool(segment.isAllDay, true),
    });

    if (dateRange.isTBD()) {
        return null;
    }
    const statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance) = event.status?.significance as any;

    const calStatus = (statusSignificance === db3.EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
        (statusSignificance === db3.EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
            ICalEventStatus.TENTATIVE;

    // for all-day events, the datetime range will return midnight of the start day.
    // BUT this will lead to issues because of timezones. In order to output a UTC date,
    // the time gets shifted and will likely be the previous day. For all-day events therefore,
    // let's be precise and use an ISO string (20240517) because all-day events are not subject to
    // time zone offsets.
    let start: Date = dateRange.getStartDateTime()!;
    let end: Date = dateRange.getEndDateTime()!; // this date must be IN the time range so don't use "end", use "last"
    if (dateRange.isAllDay()) {
        start = prepareAllDayDateForICal(start);
        end = prepareAllDayDateForICal(end);
    }

    let name = event.name || "";
    if (event.segments && (event.segments.length > 1)) {
        name = `${event.name || ""} ${segment.name || ""}`;
    }

    const ret: EventCalendarInput = {
        // note: when calculating changes, we must ignore revision
        revision: 0,
        //inputHash: "",

        eventId: event.id!,
        segmentId: segment.id,
        name,//: `${event.name || ""} ${segment.name || ""}`,
        uid: segment.uid,//

        locationDescription: event.locationDescription || "",
        description: descriptionText,

        start,
        end,
        isAllDay: segment.isAllDay,
        calStatus,

        statusSignificance,
    };

    //ret.inputHash = hash256(JSON.stringify(ret));
    ret.revision = event.revision!;

    return ret;
};



// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
// returns null if no event can be generated
type GetEventCalendarInputResult = {
    inputHash: string;
    segments: EventCalendarInput[];
};
export const GetEventCalendarInput = (event: Partial<EventForCal>): GetEventCalendarInputResult | null => {
    // if you pass in something that is insufficient for using as an event.
    // it's theoretical because it's always going to be an event object.
    if (event.revision === undefined) return null;
    if (event.id === undefined) return null;
    if (event.locationDescription === undefined) return null;

    const setLists = event.songLists ? event.songLists.map(l => SongListIndexAndNamesToString(l)) : [];

    // const statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance) = event.status?.significance as any;

    // const calStatus = (statusSignificance === db3.EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
    //     (statusSignificance === db3.EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
    //         ICalEventStatus.TENTATIVE;

    // there's no point in maintaining the structure of songlists etc; it ends up as part of the description
    // so just bake it, and keep the payload simple.
    let descriptionText = event.description ? markdownToPlainText(event.description) : "";
    if (setLists.length) {
        descriptionText += "\n\n" + setLists.join(`\n\n`);
    }

    const segmentsForCalendar = event.segments!.map(segment => GetEventSegmentCalendarInput({
        segment,
        event,
        descriptionText,
    }));

    const validSegments = segmentsForCalendar.filter(e => !!e);

    return {
        inputHash: hash256(JSON.stringify(validSegments)),
        segments: validSegments,
    };
};



