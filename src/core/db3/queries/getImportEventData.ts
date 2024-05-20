
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, SplitQuickFilter, assertIsNumberArray, mysql_real_escape_string, sleep } from "shared/utils";
import * as db3 from "../db3";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetEventFilterInfoChipInfo, GetEventFilterInfoRet, MakeGetEventFilterInfoRet, TGetImportEventDataArgs, TGetImportEventDataRet, TimingFilter, gEventRelevantFilterExpression } from "../shared/apiTypes";
import { DateSortPredicateAsc, DateSortPredicateDesc, gMillisecondsPerDay } from "shared/time";



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


const extractDate = (text: string, fallbackYear: number): Date | null => {
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

            // Validate the date
            const date = new Date(year!, month!, day!);
            if (date.getDate() === day! && date.getMonth() === month! && date.getFullYear() === year!) {
                return date;
            }
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
    resolver.authorize(Permission.admin_events),
    async (args: TGetImportEventDataArgs, ctx: AuthenticatedCtx): Promise<TGetImportEventDataRet> => {
        // start with defaults.
        const ret: TGetImportEventDataRet = {
            log: [],
            event: {
                expectedAttendanceUserTagId: null,
                name: "",
                description: "",
                statusId: null,
                tags: [],
                typeId: null,
                visiblePermissionId: null,
            },
            segment: {
                isAllDay: true, // always.
                durationMillis: gMillisecondsPerDay, // always.
                name: "Segment 1", // always.
                startsAt: new Date(),
            },
            responses: [],
            songList: [],
        };

        try {

            // visibility
            ret.event.visiblePermissionId = (await db.permission.findFirst({
                where: {
                    significance: db3.PermissionSignificance.Visibility_Members,
                }
            }))!.id;

            const edr = ExtractDescription(args.text);
            const eventTxt = edr.beforeSeparator;

            ret.event.description = edr.afterSeparator || "";

            ret.event.statusId = (await db.eventStatus.findFirst({
                where: {
                    significance: db3.EventStatusSignificance.FinalConfirmation,
                }
            }))!.id;

            ret.event.expectedAttendanceUserTagId = (await db.userTag.findFirst({
                where: {
                    significance: db3.UserTagSignificance.DefaultInvitation,
                }
            }))!.id;

            // extract event type. either concert or rehearsal
            const concertPattern = /\bconcert|performance\b/i;
            if (concertPattern.test(eventTxt)) {
                ret.event.typeId = (await db.eventType.findFirst({
                    where: {
                        significance: db3.EventTypeSignificance.Concert
                    }
                }))!.id;//eventType.find(t => t.significance === db3.EventTypeSignificance.Concert)!);
            }
            const rehearsalPattern = /\brehearsal|repetitie\b/i;
            if (rehearsalPattern.test(eventTxt)) {
                ret.event.typeId = (await db.eventType.findFirst({
                    where: {
                        significance: db3.EventTypeSignificance.Rehearsal
                    }
                }))!.id;
            }

            // find a fallback year by searching for "y2024"
            const fallbackYear = extractYear(args.config) || 2023;
            ret.log.push(`fallbackYear: ${fallbackYear}`);
            ret.log.push(`extractDate: ${extractDate(eventTxt, fallbackYear)}`);
            ret.segment.startsAt = extractDate(eventTxt, fallbackYear) || new Date();

            // extract event name.
            ret.event.name = extractFirstNonEmptyLine(eventTxt) || "";

            // extract responses
            const carl = (await db.user.findFirst({
                where: {
                    name: { contains: "carl" }
                }
            }));
            const peter = (await db.user.findFirst({
                where: {
                    name: { contains: "peter" }
                }
            }));
            const guido = (await db.user.findFirst({
                where: {
                    name: { contains: "guido" }
                }
            }));
            ret.log.push(`carl: ${carl?.id}`);
            ret.log.push(`peter: ${peter?.id}`);
            ret.log.push(`guido: ${guido?.id}`);

            //await sleep(500);

            const yesId = (await db.eventAttendance.findFirst({
                where: {
                    strength: 100,
                }
            }))!.id;
            ret.log.push(`yesId: ${yesId}`);

            const noId = (await db.eventAttendance.findFirst({
                where: {
                    strength: 0,
                }
            }))!.id;

            ret.log.push(`noId: ${noId}`);

            if (carl) {
                ret.responses.push({
                    userId: carl.id,
                    attendanceId: /\bcarl\b/i.test(eventTxt) ? yesId : noId,
                    userName: "carl",
                });
            }

            if (peter) {
                ret.responses.push({
                    userId: peter.id,
                    attendanceId: /\bpeter\b/i.test(eventTxt) ? yesId : noId,
                    userName: "peter",
                });
            }

            if (guido) {
                ret.responses.push({
                    userId: guido.id,
                    attendanceId: /\bguido\b/i.test(eventTxt) ? yesId : noId,
                    userName: "guido",
                });
            }

            const allSongs = await db.song.findMany();

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
                        songId: matchInfo[0]!.song.id,
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



