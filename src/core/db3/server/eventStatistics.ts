// todo: unify stat/analytics systems. we have song history, event statistics, and also
// separate "quick filter search" and normal faceted search which does its own stats calculations..

import { AuthorizationError } from "blitz";
import { CalendarDate } from "shared/dateTimePolicy";
import { Permission } from "shared/permissions";
import type { SongPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { EventStatisticsInputSchema, eventStatisticsView, type EventStatisticsInput, type EventStatisticsResult, type EventStatisticsRow, type PopularSongOccurrence } from "../shared/entities/event/eventStatistics";
import { songReferenceView } from "../shared/entities/song/songViews";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";
import { eventActivityDateFilter } from "./eventActivity";

/** Each song counts once per Event, regardless of repeated entries or setlists. */
function collectPopularSongs(events: EventStatisticsRow[], matchingSongIds: ReadonlySet<SongPublicId> | null): PopularSongOccurrence[] {
    const songs = new Map<SongPublicId, PopularSongOccurrence[]>();
    for (const event of events) {
        const seen = new Set<SongPublicId>();
        for (const list of event.songLists ?? []) {
            for (const entry of list.songs ?? []) {
                const song = entry.song;
                if (!song || seen.has(song.publicId) || (matchingSongIds && !matchingSongIds.has(song.publicId))) {
                    continue;
                }
                seen.add(song.publicId);
                const occurrences = songs.get(song.publicId) ?? [];
                occurrences.push({
                    songId: song.publicId,
                    songName: song.name,
                    eventId: event.publicId,
                    eventName: event.name,
                    startsAt: event.startsAt,
                    durationMillis: event.durationMillis,
                    isAllDay: event.isAllDay,
                    endDateTime: event.endDateTime,
                    typeId: event.typeId,
                    statusId: event.statusId
                });
                songs.set(song.publicId, occurrences);
            }
        }
    }
    // Public identity breaks ties consistently without relying on database row order.
    return [...songs.values()].sort((a, b) => b.length - a.length || a[0]!.songId.localeCompare(b[0]!.songId)).slice(0, 10).flat();
}

export function readEventStatistics(database: DB3ReadDatabase, authorization: CMServerAuthorization, input: EventStatisticsInput): Promise<EventStatisticsResult> {
    const args = EventStatisticsInputSchema.parse(input);
    const { bandPublicId, routeLocale, browserLanguages, clientRequestId } = args;
    const presentation = { bandPublicId, routeLocale, browserLanguages, clientRequestId };
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        const band = auth.requireBand();
        if (band.publicId !== bandPublicId) {
            throw new AuthorizationError("Event statistics require the selected band.");
        }
        auth.requirePermission(Permission.view_events_reports);
        const timeZone = await loadBandTimeZone(context.database, band.id);
        const today = CalendarDate.fromInstant({ value: new Date(), timeZone });
        const { timing, songTagIds, ...catalogFilters } = args.filterSpec;

        const events = await queryView({
            view: eventStatisticsView,
            ...presentation,
            filter: {
                tableParams: {
                    ...catalogFilters,
                    ...eventActivityDateFilter(timing, today)
                }
            },
            orderBy: { startsAt: "desc" },
            cmdbQueryContext: "event statistics"
        }, auth, context);

        const matchingSongs = songTagIds.length ? await queryView({
            view: songReferenceView,
            ...presentation,
            filter: { tableParams: { songTagIds } },
            cmdbQueryContext: "popular song tag filter"
        }, auth, context) : null;
        return {
            allEvents: events.items.map(({ songLists, ...event }) => event),
            popularSongsOccurrances: collectPopularSongs(events.items, matchingSongs ? new Set(matchingSongs.items.map(song => song.publicId)) : null),
        };
    });
}
