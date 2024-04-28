import { hash256 } from "@blitzjs/auth";
import { Prisma } from "db";
import { convert } from 'html-to-text';
import MarkdownIt from 'markdown-it';
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3";
import { DateTimeRange } from "shared/time";
import { ICalEventStatus } from "ical-generator";


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

export const EventSongListForCalArgs = Prisma.validator<Prisma.EventSongListDefaultArgs>()({
    select: {
        description: true,
        name: true,
        songs: {
            select: {
                subtitle: true,
                song: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                sortOrder: "asc",
            }
        },
    },
});

export const EventForCalArgs = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        id: true,
        name: true,
        description: true,
        revision: true,
        calendarInputHash: true,
        startsAt: true,
        isAllDay: true,
        durationMillis: true,
        endDateTime: true,
        locationDescription: true,
        locationURL: true,
        uid: true,
        slug: true,
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
const songListToString = (l: EventSongListForCal) => {
    const songsFormatted = l.songs.map((song, index) => `${(index + 1).toString().padStart(2, ' ')}. ${song.song.name}${IsNullOrWhitespace(song.subtitle) ? "" : ` (${song.subtitle})`}`);
    return `-------------
${l.name}

${songsFormatted.join("\r\n")}`;

    //     const setLists = event.songLists.map(l => {
    //         `-------------
    // ${l.name}

    // ${}`
    //     });

};


export type EventCalendarInput = Pick<EventForCal,
    "id"
    | "isAllDay"
    | "slug"
    | "revision"
    | "uid"
    | "locationDescription"
> & {
    inputHash: string,
    description: string,
    summary: string,
    statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance),
    start: Date,
    end: Date,
    calStatus: ICalEventStatus,
};


function prepareAllDayDateForICal(date) {
    const ret = new Date(date);
    ret.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return ret;
}


// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
// returns null if no event can be generated
export const GetEventCalendarInput = (event: Partial<EventForCal>): EventCalendarInput | null => {
    const setLists = event.songLists ? event.songLists.map(l => songListToString(l)) : [];

    // if you pass in something that is insufficient for using as an event.
    // it's theoretical because it's always going to be an event object.
    if (event.startsAt === undefined) return null; // tbd
    if (event.isAllDay === undefined) return null;
    if (event.revision === undefined) return null;
    if (event.id === undefined) return null;
    if (event.slug === undefined) return null;
    if (event.uid === undefined) return null;
    if (event.locationDescription === undefined) return null;

    const dateRange = new DateTimeRange({
        startsAtDateTime: event.startsAt,
        durationMillis: Number(event.durationMillis),
        isAllDay: event.isAllDay,
    });

    if (dateRange.isTBD()) {
        return null;
    }
    const statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance) = event.status?.significance as any;

    const calStatus = (statusSignificance === db3.EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
        (statusSignificance === db3.EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
            ICalEventStatus.TENTATIVE;

    const cancelledText = (calStatus === ICalEventStatus.CANCELLED) ? "CANCELLED " : "";
    const summary = `CM: ${cancelledText}${event.name}`;
    // there's no point in maintaining the structure of songlists etc; it ends up as part of the description
    // so just bake it, and keep the payload simple.
    let descriptionText = event.description ? markdownToPlainText(event.description) : "";
    if (setLists.length) {
        descriptionText += "\r\n\r\n" + setLists.join(`\r\n\r\n`);
    }

    // for all-day events, the datetime range will return midnight of the start day.
    // BUT this will lead to issues because of timezones. In order to output a UTC date,
    // the time gets shifted and will likely be the previous day. For all-day events therefore,
    // let's be precise and use an ISO string (20240517) because all-day events are not subject to
    // time zone offsets.
    let start: Date = dateRange.getStartDateTime()!;
    let end: Date = dateRange.getLastDateTime()!; // this date must be IN the time range so don't use "end", use "last"
    if (dateRange.isAllDay()) {
        start = prepareAllDayDateForICal(start);
        end = prepareAllDayDateForICal(end);
        // end = new Date(start);
        // end.setMilliseconds(start.getMilliseconds() + dateRange.getDurationMillis());
        //end = prepareAllDayDateForICal(end);
    }



    const ret: EventCalendarInput = {
        // note: when calculating changes, we must ignore revision
        revision: 0,
        inputHash: "",

        id: event.id,
        summary,
        slug: event.slug,
        uid: event.uid,

        locationDescription: event.locationDescription,
        description: descriptionText,

        //startsAt: event.startsAt,
        //durationMillis: event.durationMillis,
        //endDateTime: event.endDateTime,
        start,
        end,
        isAllDay: event.isAllDay,
        calStatus,

        statusSignificance,
    };

    // console.log(`calculating hash of`);
    // console.log(ret);
    // console.log(` -> ${hash256(JSON.stringify(ret))}`);
    ret.inputHash = hash256(JSON.stringify(ret));
    ret.revision = event.revision;

    return ret;
};