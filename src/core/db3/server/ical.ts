import db, { Prisma } from "db";
import { convert } from 'html-to-text';
import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent, ICalEventStatus } from "ical-generator";
import MarkdownIt from 'markdown-it';
import { DateTimeRange, floorToDay } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import { DB3QueryCore2 } from "src/core/db3/server/db3QueryCore";
import * as mutationCore from 'src/core/db3/server/db3mutationCore';
import { GetICalRelativeURIForUserAndEvent } from "src/core/db3/shared/apiTypes";
import * as db3 from "../db3";


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

    const calStatus = (event.status?.significance === db3.EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
        (event.status?.significance === db3.EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
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


export interface CalExportCoreArgs1 {
    accessToken: string;
    sourceURI: string;
};

export interface CalExportCoreArgsSingleEvent extends CalExportCoreArgs1 {
    type: "event";
    eventUid: string;
};

export interface CalExportCoreArgsUpcoming extends CalExportCoreArgs1 {
    type: "upcoming";
};

type CalExportCoreArgs = CalExportCoreArgsUpcoming | CalExportCoreArgsSingleEvent;

export const CalExportCore = async ({ accessToken, type, ...args }: CalExportCoreArgs): Promise<ICalCalendar> => {
    let currentUser: null | db3.UserWithRolesPayload = null;
    if (accessToken.length > 10) {
        currentUser = await db.user.findUnique({
            where: {
                accessToken,
            },
            include: db3.UserWithRolesArgs.include,
        });
    }

    const clientIntention: db3.xTableClientUsageContext = { currentUser, intention: currentUser ? "user" : "public", mode: 'primary' };

    const table = db3.xEventVerbose;
    const minDate = floorToDay(new Date()); // avoid tight loop where date changes every render, by flooring to day.
    minDate.setDate(minDate.getDate() - 1);

    const eventsTableParams: db3.EventTableParams = {
        minDate: type === "upcoming" ? minDate : undefined,
        eventUids: type === "event" ? [(args as CalExportCoreArgsSingleEvent).eventUid] : undefined,
    };

    const eventsRaw = await DB3QueryCore2({
        clientIntention,
        tableName: table.tableName,
        tableID: table.tableID,
        filter: {
            items: [],
            tableParams: eventsTableParams,
        },
        cmdbQueryContext: `CalExportCore`,
        orderBy: undefined,
    }, currentUser);

    // don't error if 0 events. this is a calendar-of-events and 0 events is valid.

    const events = eventsRaw.items as db3.EventClientPayload_Verbose[];

    //const sourceURL = process.env.CMDB_BASE_URL + GetICalRelativeURIForUserAndEvent({ userAccessToken: currentUser?.accessToken || null, eventUid });
    const cal = createCalendar({
        sourceURL: args.sourceURI,
    });

    for (let i = 0; i < events.length; ++i) {
        const event = events[i]!;
        addEventToCalendar(cal, currentUser, event);
    }

    return cal;
};
