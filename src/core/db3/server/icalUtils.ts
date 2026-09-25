import type { EventPublicId, EventSegmentPublicId } from "shared/publicId";
import type { BasicLocalSongListPayload } from "../shared/setlistApi";
import { getRangeCalendarDates } from "shared/dateTimePresentation";
import { ServerApi } from "@/src/server/serverApi";
import { hash256 } from "@blitzjs/auth";
import { Prisma } from "db";
import { ICalEventStatus } from "ical-generator";
import { markdownToPlainText } from "shared/markdownUtils";
import { slugify } from "shared/rootroot";
import { DateTimeRange } from "shared/time";
import { CalendarDate } from "shared/dateTimePolicy";
import { CoalesceBool, IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3";
import { SongListIndexAndNamesToString } from "../shared/setlistApi";


export const EventSongListDividerForCalArgs = Prisma.validator<Prisma.EventSongListDividerDefaultArgs>()({
    select: {
        id: true,
        sortOrder: true,
        subtitle: true,
        isInterruption: true,
        isSong: true,
        subtitleIfSong: true,
        lengthSeconds: true,
        textStyle: true,
        eventSongListId: true,
        color: true,
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
                        lengthSeconds: true,
                    }
                }
            },
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
        statusId: true,
    }
});

export const EventForCalArgs = Prisma.validator<Prisma.EventDefaultArgs>()({
    select: {
        id: true,
        name: true,
        //description: true,
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
        descriptionWikiPage: {
            include: {
                currentRevision: true,
            }
        }
    }
});

export type EventSongListForCal = Prisma.EventSongListGetPayload<typeof EventSongListForCalArgs>;
export type EventForCal = Prisma.EventGetPayload<typeof EventForCalArgs>;
export type EventSegmentForCal = Prisma.EventSegmentGetPayload<typeof EventSegmentForCalArgs>;

export type EventSegmentForCalInput<TStatusIdentity extends number | string, TSegmentIdentity extends number | EventSegmentPublicId = number> = Omit<
    EventSegmentForCal,
    "id" | "statusId"
> & {
    id: TSegmentIdentity;
    statusId: TStatusIdentity | null;
};

export type EventForCalInput<
    TStatusIdentity extends number | string,
    TSegmentIdentity extends number | EventSegmentPublicId = number,
    TEventIdentity extends number | EventPublicId = number,
> = Pick<
    EventForCal,
    "name" | "revision" | "calendarInputHash" | "locationDescription" | "locationURL" | "status"
> & {
    id: TEventIdentity;
    songLists: BasicLocalSongListPayload[];
    segments: EventSegmentForCalInput<TStatusIdentity, TSegmentIdentity>[];
    descriptionWikiPage: {
        currentRevision: { content: string } | null;
    } | null;
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
// const songListToString = (l: EventSongListForCal) => {
//     // TODO: include dividers.
//     const songsFormatted = l.songs
//         .map((song, index) => `${(index + 1).toString().padStart(2, ' ')}. ${song.song.name}${IsNullOrWhitespace(song.subtitle) ? "" : ` (${song.subtitle})`}`);
//     return `-------------
// ${l.name}

// ${songsFormatted.join("\n")}`;
// };


export type EventCalendarInput<
    TSegmentIdentity extends number | EventSegmentPublicId = number,
    TEventIdentity extends number | EventPublicId = number,
> = Pick<EventForCal,
    "revision"
    | "locationDescription"
> &
    Pick<EventSegmentForCal, "isAllDay" | "uid"> &
{
    description: string,
    eventUri: string;
    name: string,
    statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance),

    start: Date,
    end: Date,

    calStatus: ICalEventStatus,
    eventId: TEventIdentity,
    segmentId: TSegmentIdentity,
};


// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
// returns null if no event can be generated
type GetEventSegmentCalendarInputArgs<
    TStatusIdentity extends number | string,
    TSegmentIdentity extends number | EventSegmentPublicId,
    TEventIdentity extends number | EventPublicId,
> = {
    event: Partial<EventForCalInput<TStatusIdentity, TSegmentIdentity, TEventIdentity>>;
    segment: EventSegmentForCalInput<TStatusIdentity, TSegmentIdentity>;
    descriptionText: string;
    bandTimeZone: string;
};
export const GetEventSegmentCalendarInput = <
    TStatusIdentity extends number | string,
    TSegmentIdentity extends number | EventSegmentPublicId,
    TEventIdentity extends number | EventPublicId,
>({ segment, event, descriptionText, bandTimeZone, ...args }: GetEventSegmentCalendarInputArgs<TStatusIdentity, TSegmentIdentity, TEventIdentity>): EventCalendarInput<TSegmentIdentity, TEventIdentity> | null => {
    if (!segment.startsAt) return null;
    const isAllDay = CoalesceBool(segment.isAllDay, true);

    const eventUri = ServerApi.getAbsoluteUri(`/backstage/event/${event.id}/${slugify(event.name || "")}`); // 

    const statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance) = event.status?.significance as any;

    const calStatus = (statusSignificance === db3.EventStatusSignificance.Cancelled) ? ICalEventStatus.CANCELLED :
        (statusSignificance === db3.EventStatusSignificance.FinalConfirmation) ? ICalEventStatus.CONFIRMED :
            ICalEventStatus.TENTATIVE;

    let start: Date;
    let end: Date;
    if (isAllDay) {
        // All-day feeds carry the selected dates, not the band's absolute
        // midnight interval. Supply both calendar bounds without host-local math.
        const dates = getRangeCalendarDates(new DateTimeRange({
            startsAtDateTime: segment.startsAt,
            durationMillis: Number(segment.durationMillis),
            isAllDay: true,
        }), bandTimeZone)!.dates;
        // "cast" to UTC and obtain the start instant of the calendar date.
        // this is explicit in https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1
        // > DTSTART is inclusive; DTEND is exclusive, including for multi-day date-only events.
        // > DATE contains only year/month/day, and TZID must not be applied to it. There is no T000000Z suffix.
        start = new CalendarDate(dates.startDate, "UTC").toStartInstant();
        end = new CalendarDate(dates.endDateExclusive, "UTC").toStartInstant();
    } else {
        const dateRange = new DateTimeRange({
            startsAtDateTime: segment.startsAt,
            durationMillis: Number(segment.durationMillis),
            isAllDay: false,
        });
        start = dateRange.getStartDateTime()!;
        end = dateRange.getEndDateTime()!;
    }

    let name = event.name || "";
    if (event.segments && (event.segments.length > 1)) {
        name = `${event.name || ""} ${segment.name || ""}`;
    }

    const ret: EventCalendarInput<TSegmentIdentity, TEventIdentity> = {
        // note: when calculating changes, we must ignore revision
        revision: 0,
        eventUri,

        eventId: event.id!,
        segmentId: segment.id,
        name,
        uid: segment.uid,//

        locationDescription: event.locationDescription || "",
        description: descriptionText,

        start,
        end,
        isAllDay,
        calStatus,

        statusSignificance,
    };

    ret.revision = event.revision!;

    return ret;
};



// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
// returns null if no event can be generated
type GetEventCalendarInputResult<
    TSegmentIdentity extends number | EventSegmentPublicId,
    TEventIdentity extends number | EventPublicId,
> = {
    inputHash: string;
    segments: EventCalendarInput<TSegmentIdentity, TEventIdentity>[];
};
export const GetEventCalendarInput = <
    TStatusIdentity extends number | string,
    TSegmentIdentity extends number | EventSegmentPublicId,
    TEventIdentity extends number | EventPublicId,
> //
    (
        event: Partial<EventForCalInput<TStatusIdentity, TSegmentIdentity, TEventIdentity>>,
        cancelledStatusIds: TStatusIdentity[],
        bandTimeZone: string,
    ): GetEventCalendarInputResult<TSegmentIdentity, TEventIdentity> | null => {
    // if you pass in something that is insufficient for using as an event.
    // it's theoretical because it's always going to be an event object.
    if (event.revision === undefined) return null;
    if (event.id === undefined) return null;
    if (event.locationDescription === undefined) return null;

    const setLists = event.songLists ? event.songLists.map(l => SongListIndexAndNamesToString(l)) : [];

    // there's no point in maintaining the structure of songlists etc; it ends up as part of the description
    // so just bake it, and keep the payload simple.
    let descriptionText = IsNullOrWhitespace(event.descriptionWikiPage?.currentRevision?.content) ? "" : markdownToPlainText(event.descriptionWikiPage?.currentRevision?.content || "");
    if (setLists.length) {
        descriptionText += "\n\n" + setLists.join(`\n\n`);
    }

    const segmentsForCalendar = event.segments!
        .filter(segment => !segment.statusId || !cancelledStatusIds.includes(segment.statusId))
        .map(segment => GetEventSegmentCalendarInput({
            segment,
            event,
            descriptionText,
            bandTimeZone,
        }));

    const validSegments = segmentsForCalendar.filter(e => !!e);

    return {
        inputHash: hash256(JSON.stringify(validSegments)),
        segments: validSegments,
    };
};



