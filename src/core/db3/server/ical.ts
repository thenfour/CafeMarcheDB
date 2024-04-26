import { Prisma } from "db";
import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent, ICalEventStatus } from "ical-generator";
import MarkdownIt from 'markdown-it';
import { DateTimeRange } from "shared/time";
import { EventStatusSignificance } from "../db3";

import { convert } from 'html-to-text';
import { IsNullOrWhitespace } from "shared/utils";

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



interface CreateCalendarArgs {
    sourceURL: string;
};

export const createCalendar = (args: CreateCalendarArgs): ICalCalendar => {

    const calendar = ical({
        name: "Café Marché Agenda",
        prodId: {
            company: "Café Marché",
            product: "Backstage",
            language: "EN",
        },
        source: args.sourceURL, // * cal.source('http://example.com/my/original_source.ical');
        url: args.sourceURL, // * calendar.url('http://example.com/my/feed.ical'); // seems same as source
        //ttl: ,  seconds; let users decide.
        //scale: "", // ??? gregorian. calendar scale. don't use.
    });

    // publish should always be used.
    // other methods are for things like requesting meetingns, accepting meetings, etc.
    // which is why they're at the calendar level not the event level.
    calendar.method(ICalCalendarMethod.PUBLISH);

    return calendar;
};


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
const songListToString = (l: Prisma.EventSongListGetPayload<{ include: { songs: { include: { song: true } } } }>) => {
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


type EventForCal = Prisma.EventGetPayload<{
    // select: {
    //     description,
    //     startsAt,
    //     isAllDay,
    //     durationMillis,
    //     endDateTime,
    //     locationDescription,
    //     locationURL,
    //     uid,
    //     slug,
    // },
    include: {
        status: true,
        songLists: {
            include: {
                songs: {
                    include: {
                        song: true,
                    }
                }
            }
        }
    }
}>;

// if user is null, it's a public access.
export const addEventToCalendar = (calendar: ICalCalendar, user: null | Prisma.UserGetPayload<{}>, event: EventForCal): ICalEvent | null => {

    // URI for event
    // URI for user calendar
    // URI for event calendar
    const eventURL = process.env.CMDB_BASE_URL + `event/${event.id}/${event.slug}`; // 

    const dateRange = new DateTimeRange({
        startsAtDateTime: event.startsAt,
        durationMillis: Number(event.durationMillis),
        isAllDay: event.isAllDay,
    });

    if (dateRange.isTBD()) {
        return null;
    }

    const calStatus = (event.status?.significance === EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
        (event.status?.significance === EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
            ICalEventStatus.TENTATIVE;

    const cancelledText = (calStatus === ICalEventStatus.CANCELLED) ? "CANCELLED " : "";

    const setLists = event.songLists ? event.songLists.map(l => songListToString(l)) : [];

    let descriptionText = event.description ? markdownToPlainText(event.description) : "";
    if (setLists.length) {
        descriptionText += "\r\n\r\n" + setLists.join(`\r\n\r\n`);
    }

    const calEvent = calendar.createEvent({
        start: dateRange.getStartDateTime()!,
        allDay: dateRange.isAllDay(),
        end: dateRange.getEndDateTime(),
        summary: `CM: ${cancelledText}${event.name}`,
        description: descriptionText || "",
        location: event.locationDescription,
        url: eventURL,
        status: calStatus,

        //sequence: event.sequenceid, // not sure we really can do this well.
        // don't include organizer; this is like, for a meeting request, who would you contact to propose time changes.
        //organizer: "Carl Corcoran",// * event.organizer('Organizer\'s Name <organizer@example.com>'); 
        // don't do attendees; it complicates last modified time, may not even really be used for this purpose etc.
        // attendees: [
        //     // new ICalAttendee({
        //     // })
        // ],
        //class: "", // public | private | confidential
    });
    if (event.uid) {
        calEvent.uid(`${event.uid}@cafemarche.be`);
    }

    return calEvent;
};
