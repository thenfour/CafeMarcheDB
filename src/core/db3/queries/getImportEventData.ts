import { CalendarDate } from "shared/dateTimePolicy";

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { SplitQuickFilter } from "shared/quickFilter";
import { createAllDayRange } from "shared/time";
import * as db3 from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
import { TGetImportEventDataArgs, TGetImportEventDataRet } from "../shared/apiTypes";
import { GetDefaultVisibilityPermission } from "../shared/db3Helpers";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";



interface ExtractDescriptionResult {
    beforeSeparator: string;
    afterSeparator: string | null;
}

const ExtractDescription = (text: string, separator: string = "-----"): ExtractDescriptionResult => {
    // Split the text into lines
    const lines = text.split('\n');

    // Find the index of the separator line
    const separatorIndex = lines.findIndex(line => line.trim() === separator);

    if (separatorIndex !== -1) {
        // Text before the separator
        const beforeSeparator = lines.slice(0, separatorIndex).join('\n').trim();

        // Text after the separator, with leading and trailing whitespace/empty lines removed
        const afterSeparatorLines = lines.slice(separatorIndex + 1);
        const trimmedAfterSeparator = afterSeparatorLines
            .join('\n')
            .split('\n')
            .filter(line => line.trim().length > 0)
            .join('\n')
            .trim();

        return {
            beforeSeparator,
            afterSeparator: trimmedAfterSeparator
        };
    }

    // If the separator is not found, return all text as beforeSeparator and null as afterSeparator
    return {
        beforeSeparator: text.trim(),
        afterSeparator: null
    };
};




interface SongParsed {
    songName: string;
    comment: string | null;
}

const splitSongAndComment = (input: string): SongParsed => {
    // Define a regex pattern to capture the song name and the optional comment
    const pattern = /^(.*?)\s*\((.*?)\)?$/;

    const match = input.match(pattern);

    if (match) {
        const songName = match[1]!.trim();
        const comment = match[2] ? match[2].trim() : null;
        return { songName, comment };
    } else {
        // If no comment is found, return the entire input as the song name and null as the comment
        return { songName: input.trim(), comment: null };
    }
};

// extracts "y2023" which is a way to override whatever other info we couldn't parse.
const extractYear = (text: string): number | null => {
    // Define a regex pattern to match "yYYYY"
    const yearPattern = /y(\d{4})/i;

    // Attempt to match the pattern in the text
    const match = text.match(yearPattern);
    if (match) {
        // Parse the matched year as an integer and return it
        return parseInt(match[1]!, 10);
    }

    // Return null if no valid year is found
    return null;
};


const extractDate = (text: string, fallbackYear: number): string | null => {
    // Define regex patterns to match various date formats including shorthand month names
    const datePatterns = [
        /\b(\d{1,2})\s+(\w+)\s+(\d{4})\b/i,       // 25 October 2024
        /\b(\d{1,2})\s+(\w+)\b/i,                 // 25 October, 27 Sept
        /\b(\w+)\s+(\d{1,2}),?\s+(\d{4})\b/i,     // October 25, 2024
        /\b(\w+)\s+(\d{1,2})\b/i,                 // October 25, Sept 27
        /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/, // 25/10/2024 or 25-10-2024
        /\b(\d{1,2})[\/\-](\d{1,2})\b/            // 25/10 or 25-10
    ];

    // Month names and their corresponding numbers for shorthand and full names
    const monthNames: { [key: string]: number } = {
        january: 0, jan: 0,
        february: 1, feb: 1,
        march: 2, mar: 2,
        april: 3, apr: 3,
        may: 4,
        june: 5, jun: 5,
        july: 6, jul: 6,
        august: 7, aug: 7,
        september: 8, sep: 8, sept: 8,
        october: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, dec: 11
    };

    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            let day: number, month: number, year: number;

            if (match.length === 4) {
                // Full date with day, month, and year
                day = parseInt(match[1]!);
                month = monthNames[match[2]!.toLowerCase()]!;
                year = parseInt(match[3]!);
            } else if (match.length === 3) {
                // Date with day and month only
                day = parseInt(match[1]!);
                month = monthNames[match[2]!.toLowerCase()]!;
                year = fallbackYear;
            } else if (match.length === 5) {
                // Date with day, month, and year in numeric format
                day = parseInt(match[1]!);
                month = parseInt(match[2]!) - 1; // Months are 0-indexed in JS Date
                year = parseInt(match[3]!);
            } else if (match.length === 4) {
                // Date with day and month in numeric format
                day = parseInt(match[1]!);
                month = parseInt(match[2]!) - 1; // Months are 0-indexed in JS Date
                year = fallbackYear;
            }

            try {
                return new CalendarDate(`${year!}-${String(month! + 1).padStart(2, "0")}-${String(day!).padStart(2, "0")}`, "UTC").date;
            } catch { /* Try the next recognized date pattern. */ }
        }
    }
    return null;
};




const extractFirstNonEmptyLine = (text: string): string | null => {
    // Split the text into lines
    const lines = text.split(/\r?\n/);

    // Iterate over the lines and return the first non-empty line
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 0) {
            return trimmedLine;
        }
    }

    // Return null if no non-empty line is found
    return null;
};





export default resolver.pipe(
    resolver.authorize(Permission.sysadmin),
    async (args: TGetImportEventDataArgs, ctx: AuthenticatedCtx): Promise<TGetImportEventDataRet> => {
        const currentUser = await getCurrentUserCore(ctx);
        if (!currentUser) throw new Error("Current user was not found.");
        const bandTimeZone = await loadBandTimeZone(db);
        const today = CalendarDate.fromInstant({ value: new Date(), timeZone: bandTimeZone });
        const todayRange = createAllDayRange({ startDate: today.date, endDateExclusive: today.addDays(1).date }, bandTimeZone);
        // start with defaults.
        const ret: TGetImportEventDataRet = {
            log: [],
            event: {
                expectedAttendanceUserTagId: null,
                name: "",
                //description: "",
                statusId: null,
                tags: [],
                typeId: null,
                visiblePermissionId: null,
            },
            segment: {
                isAllDay: true, // always.
                durationMillis: todayRange.getDurationMillis(),
                name: "Segment 1", // always.
                startsAt: today.toStartInstant(),
            },
            responses: [],
            songList: [],
        };

        try {

            // visibility
            const defaultVisibilityPermission = await GetDefaultVisibilityPermission(db);
            ret.event.visiblePermissionId = defaultVisibilityPermission
                ? db3.xPermission.parseIdentity(defaultVisibilityPermission.publicId)
                : null;

            const edr = ExtractDescription(args.text);
            const eventTxt = edr.beforeSeparator;

            //ret.event.description = edr.afterSeparator || "";

            ret.event.statusId = db3.xEventStatus.parseIdentity((await db.eventStatus.findFirst({
                where: {
                    significance: db3.EventStatusSignificance.FinalConfirmation,
                    isDeleted: false,
                },
                select: { publicId: true },
            }))!.publicId);


            const defaultInvitationUserTag = (await db.userTag.findFirst({
                where: {
                    significance: db3.UserTagSignificance.DefaultInvitation,
                },
                select: { publicId: true },
            }));

            if (!defaultInvitationUserTag) {
                ret.log.push("No default invitation user tag found.");
            }

            ret.event.expectedAttendanceUserTagId = defaultInvitationUserTag
                ? db3.xUserTag.parseIdentity(defaultInvitationUserTag.publicId)
                : null;

            // extract event type. either concert or rehearsal
            const concertPattern = /\bconcert|performance\b/i;
            if (concertPattern.test(eventTxt)) {
                ret.event.typeId = db3.xEventType.parseIdentity((await db.eventType.findFirst({
                    where: {
                        significance: db3.EventTypeSignificance.Concert,
                        isDeleted: false,
                    },
                    select: { publicId: true },
                }))!.publicId);//eventType.find(t => t.significance === db3.EventTypeSignificance.Concert)!);
            }
            const rehearsalPattern = /\brehearsal|repetitie\b/i;
            if (rehearsalPattern.test(eventTxt)) {
                ret.event.typeId = db3.xEventType.parseIdentity((await db.eventType.findFirst({
                    where: {
                        significance: db3.EventTypeSignificance.Rehearsal,
                        isDeleted: false,
                    },
                    select: { publicId: true },
                }))!.publicId);
            }

            // find a fallback year by searching for "y2024"
            const fallbackYear = extractYear(args.config) || 2023;
            ret.log.push(`fallbackYear: ${fallbackYear}`);
            ret.log.push(`extractDate: ${extractDate(eventTxt, fallbackYear)}`);
            // The parser returns a UTC calendar-date marker; transport it using
            // the same UTC date encoding as stored all-day segments.
            const selectedDay = new CalendarDate(extractDate(eventTxt, fallbackYear) || today.date, bandTimeZone);
            const selectedRange = createAllDayRange({ startDate: selectedDay.date, endDateExclusive: selectedDay.addDays(1).date }, bandTimeZone);
            ret.segment.startsAt = selectedRange.getStartDateTime();
            ret.segment.durationMillis = selectedRange.getDurationMillis();

            // extract event name.
            ret.event.name = extractFirstNonEmptyLine(eventTxt) || "";

            // extract responses
            const carl = (await db.user.findFirst({
                where: {
                    name: { contains: "carl" },
                    isDeleted: false,
                }
            }));
            const peter = (await db.user.findFirst({
                where: {
                    name: { contains: "peter" },
                    isDeleted: false,
                }
            }));
            const guido = (await db.user.findFirst({
                where: {
                    name: { contains: "guido" },
                    isDeleted: false,
                }
            }));
            ret.log.push(`carl: ${carl?.publicId}`);
            ret.log.push(`peter: ${peter?.publicId}`);
            ret.log.push(`guido: ${guido?.publicId}`);

            const yesId = db3.xEventAttendance.parseIdentity((await db.eventAttendance.findFirst({
                where: {
                    strength: 100,
                    isDeleted: false,
                }
            }))!.publicId);
            ret.log.push(`yesId: ${yesId}`);

            const noId = db3.xEventAttendance.parseIdentity((await db.eventAttendance.findFirst({
                where: {
                    strength: 0,
                    isDeleted: false,
                }
            }))!.publicId);

            ret.log.push(`noId: ${noId}`);

            if (carl) {
                ret.responses.push({
                    userId: db3.xUser.parseIdentity(carl.publicId),
                    attendanceId: /\bcarl\b/i.test(eventTxt) ? yesId : noId,
                    userName: "carl",
                });
            }

            if (peter) {
                ret.responses.push({
                    userId: db3.xUser.parseIdentity(peter.publicId),
                    attendanceId: /\bpeter\b/i.test(eventTxt) ? yesId : noId,
                    userName: "peter",
                });
            }

            if (guido) {
                ret.responses.push({
                    userId: db3.xUser.parseIdentity(guido.publicId),
                    attendanceId: /\bguido\b/i.test(eventTxt) ? yesId : noId,
                    userName: "guido",
                });
            }

            const allSongs = await db.song.findMany({
                where: await GetAuthorizedTableReadWhere({
                    table: db3.xSong,
                    currentUser,
                }),
            });

            // songs. each line searches songs
            const lines = eventTxt.split("\n");
            for (let i = 0; i < lines.length; ++i) {
                const line = lines[i]!;
                //await .forEach(async (line, i) => {
                ret.log.push(`Line ${i}`);
                ret.log.push(`  "${line.trim()}"`);
                const p = splitSongAndComment(line);
                ret.log.push(`  Parsed as: [${p.songName}] [${p.comment}]`);
                const tokens = SplitQuickFilter(p.songName.toLowerCase()).filter(t => t.length > 1);
                if (tokens.length < 1) continue;

                const tokenThresh = Math.ceil(tokens.length / 2);
                ret.log.push(`  Tokens: [${tokens.join(", ")}] (match thresh: ${tokenThresh.toFixed(2)})`);

                let matchInfo = allSongs.map(song => {
                    const matchingTokens = tokens.filter(token => song.name.toLowerCase().includes(token) || song.aliases.toLowerCase().includes(token));
                    return {
                        song,
                        matchingTokens,
                    }
                });

                matchInfo = matchInfo.filter(mi => mi.matchingTokens.length >= tokenThresh);
                matchInfo.sort((a, b) => b.matchingTokens.length - a.matchingTokens.length);

                if (matchInfo.length > 0) {
                    ret.log.push(`  Pass with tokens [${matchInfo[0]!.matchingTokens}]`);
                    ret.songList.push({
                        comment: p.comment || "",
                        songId: db3.xSong.parseIdentity(matchInfo[0]!.song.publicId),
                        songName: matchInfo[0]!.song.name,
                    });
                }
            }; // foreach

            return ret;
        } catch (e) {
            ret.log.push(e.toString());
            console.error(e);
            return ret;
        }
    }
);



