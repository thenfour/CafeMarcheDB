import { hash256 } from "@blitzjs/auth";
import { Prisma } from "db";
import { convert } from 'html-to-text';
import MarkdownIt from 'markdown-it';
import { IsNullOrWhitespace } from "shared/utils";
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

// export type EventSongListForCal = Prisma.EventSongListGetPayload<{
//     select: {
//         description,
//         name,
//         songs: {
//             select: {
//                 subtitle,
//                 song: {
//                     select: {
//                         name: true,
//                     }
//                 }
//             },
//             orderBy: {
//                 sortOrder: "asc",
//             }
//         },
//         orderBy: {
//             sortOrder: "asc",
//         }
//     },
//     orderBy: {
//         sortOrder: "asc",
//     }
// }>;



// export type EventForCal = Prisma.EventGetPayload<{
//     select: {
//         id,
//         name,
//         description,
//         revision,
//         calendarInputHash,
//         startsAt,
//         isAllDay,
//         durationMillis,
//         endDateTime,
//         locationDescription,
//         locationURL,
//         uid,
//         slug,
//         status: {
//             select: {
//                 significance,
//             }
//         }
//         songLists: {
//             select: {
//                 description,
//                 name,
//                 songs: {
//                     select: {
//                         subtitle,
//                         song: {
//                             select: {
//                                 name: true,
//                             }
//                         }
//                     },
//                     orderBy: {
//                         sortOrder: "asc",
//                     }
//                 },
//                 orderBy: {
//                     sortOrder: "asc",
//                 }
//             },
//             orderBy: {
//                 sortOrder: "asc",
//             }
//         }
//     },
// }>;



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
    "startsAt"
    | "durationMillis"
    | "endDateTime"
    | "isAllDay"
    | "id"
    | "slug"
    | "revision"
    | "uid"
    | "locationDescription"
    | "name"
> & {
    inputHash: string,
    description: string,
    statusSignificance: undefined | (keyof typeof db3.EventStatusSignificance),
};

// does some processing on an Event db model in order to prepare it for calendar export. the idea is to
// grab just the info needed to know if a revision # is necessary.
export const GetEventCalendarInput = (event: EventForCal): EventCalendarInput => {
    const setLists = event.songLists ? event.songLists.map(l => songListToString(l)) : [];

    // there's no point in maintaining the structure of songlists etc; it ends up as part of the description
    // so just bake it, and keep the payload simple.
    let descriptionText = event.description ? markdownToPlainText(event.description) : "";
    if (setLists.length) {
        descriptionText += "\r\n\r\n" + setLists.join(`\r\n\r\n`);
    }

    const ret: EventCalendarInput = {
        // note: when calculating changes, we must ignore revision
        revision: 0,
        inputHash: "",

        id: event.id,
        name: event.name,
        slug: event.slug,
        uid: event.uid,

        locationDescription: event.locationDescription,
        description: descriptionText,

        startsAt: event.startsAt,
        durationMillis: event.durationMillis,
        endDateTime: event.endDateTime,
        isAllDay: event.isAllDay,

        statusSignificance: event.status?.significance as any,
    };

    ret.inputHash = hash256(JSON.stringify(ret));
    ret.revision = event.revision;

    return ret;
};