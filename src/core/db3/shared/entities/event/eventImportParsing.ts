import { CalendarDate } from "shared/dateTimePolicy";
import { SplitQuickFilter } from "shared/quickFilter";
import type { SongPublicId, UserPublicId } from "shared/publicId";
import type { TinsertEventResponse, TinsertEventSong } from "../../apiTypes";

// hard-coded attendance aliases -- these are café marché specific; if we introduce
// event import for general bands, this needs to be changed.
const attendanceAliases = ["carl", "peter", "guido"] as const;

const months = new Map([
    ["january", 1], ["jan", 1], ["february", 2], ["feb", 2], ["march", 3], ["mar", 3],
    ["april", 4], ["apr", 4], ["may", 5], ["june", 6], ["jun", 6], ["july", 7], ["jul", 7],
    ["august", 8], ["aug", 8], ["september", 9], ["sep", 9], ["sept", 9],
    ["october", 10], ["oct", 10], ["november", 11], ["nov", 11], ["december", 12], ["dec", 12],
]);

type DatePattern = { pattern: RegExp; day: number; month: number; year?: number; numericMonth?: boolean };
const datePatterns: DatePattern[] = [
    { pattern: /\b(\d{1,2})\s+(\w+)\s+(\d{4})\b/gi, day: 1, month: 2, year: 3 },
    { pattern: /\b(\w+)\s+(\d{1,2}),?\s+(\d{4})\b/gi, day: 2, month: 1, year: 3 },
    { pattern: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g, day: 1, month: 2, year: 3, numericMonth: true },
    { pattern: /\b(\d{1,2})\s+(\w+)\b/gi, day: 1, month: 2 },
    { pattern: /\b(\w+)\s+(\d{1,2})\b/gi, day: 2, month: 1 },
    { pattern: /\b(\d{1,2})[/-](\d{1,2})(?![/-]\d)\b/g, day: 1, month: 2, numericMonth: true },
];

export function extractImportDate(text: string, fallbackYear: number): string | null {
    for (const spec of datePatterns) {
        for (const match of text.matchAll(spec.pattern)) {
            const monthText = match[spec.month]!;
            const month = spec.numericMonth ? Number(monthText) : months.get(monthText.toLowerCase());
            if (month === undefined) {
                continue;
            }
            const year = spec.year === undefined ? fallbackYear : Number(match[spec.year]);
            try {
                return new CalendarDate(`${year}-${String(month).padStart(2, "0")}-${match[spec.day]!.padStart(2, "0")}`, "UTC").date;
            } catch {
                // A recognized invalid full date must not be reinterpreted with the fallback year.
                return null;
            }
        }
    }
    return null;
}

export function parseEventImportText(text: string, config: string) {
    // The reference importer ignores notes after a standalone separator.
    const eventText = text.split(/^\s*-----\s*$/m)[0]!.trim();
    const fallbackYear = Number(config.match(/y(\d{4})/i)?.[1] ?? 2023);
    return {
        eventText,
        name: eventText.split(/\r?\n/).find(line => line.trim())?.trim() ?? "",
        date: extractImportDate(eventText, fallbackYear), fallbackYear,
        type: /\b(rehearsal|repetitie)\b/i.test(eventText) ? "Rehearsal"
            : /\b(concert|performance)\b/i.test(eventText) ? "Concert" : null,
        songs: eventText.split(/\r?\n/).map(line => {
            const match = line.match(/^(.*?)\s*\((.*?)\)?$/);
            return { name: (match?.[1] ?? line).trim(), comment: match?.[2]?.trim() ?? "" };
        }),
    };
}

export function matchImportSongs(
    lines: ReturnType<typeof parseEventImportText>["songs"],
    songs: readonly { publicId: SongPublicId; name?: string; aliases?: string }[],
    log: string[],
): TinsertEventSong[] {
    return lines.flatMap((line, index) => {
        const tokens = SplitQuickFilter(line.name.toLowerCase()).filter(token => token.length > 1);
        if (!tokens.length) {
            return [];
        }
        const threshold = Math.ceil(tokens.length / 2);
        const ranked = songs.map(song => ({
            song, score: tokens.filter(token =>
                song.name?.toLowerCase().includes(token) || song.aliases?.toLowerCase().includes(token)).length
        }))
            .filter(match => match.score >= threshold).sort((a, b) => b.score - a.score);
        const best = ranked[0];
        log.push(`Line ${index}: [${line.name}] [${line.comment}]; tokens [${tokens.join(", ")}], threshold ${threshold}`);
        if (!best) {
            log.push("  No matching Song.");
            return [];
        }
        if (ranked[1]?.score === best.score) {
            log.push("  Ambiguous Song match; omitted.");
            return [];
        }
        log.push(`  Matched ${best.song.name ?? ""}`);
        return [{ songId: best.song.publicId, songName: best.song.name, comment: line.comment }];
    });
}

export function matchImportResponses(
    text: string,
    people: readonly { publicId: UserPublicId; name?: string }[],
    choices: { yes: TinsertEventResponse["attendanceId"] | null; no: TinsertEventResponse["attendanceId"] | null },
    log: string[],
): TinsertEventResponse[] {
    const seen = new Set<UserPublicId>();
    return attendanceAliases.flatMap(alias => {
        const matches = people.filter(person => person.name?.toLowerCase().includes(alias));
        const person = matches[0];
        if (matches.length !== 1 || !person) {
            log.push(`${alias}: ${matches.length > 1 ? "ambiguous member match" : "no matching member"}; omitted.`);
            return [];
        }
        const attendanceId = new RegExp(`\\b${alias}\\b`, "i").test(text) ? choices.yes : choices.no;
        if (!attendanceId || seen.has(person.publicId)) {
            return [];
        }
        seen.add(person.publicId);
        return [{ userId: person.publicId, userName: person.name, attendanceId }];
    });
}
