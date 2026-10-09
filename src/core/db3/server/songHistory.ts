import { Temporal } from "@js-temporal/polyfill";
import { AuthorizationError } from "blitz";
import { Permission } from "shared/permissions";
import { CalendarDate } from "shared/dateTimePolicy";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { songReferenceView } from "../shared/entities/song/songViews";
import { songHistoryEventView, SongHistoryInputSchema, type SongHistoryInput, type SongHistoryTiming, type SongHistoryResult } from "../shared/entities/song/songHistory";
import type { EventTableParams } from "../shared/schema/event";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

/** Past excludes today; Future includes today, using the band's calendar day. */
export function songHistoryDateFilter(timing: SongHistoryTiming, today: CalendarDate): Pick<EventTableParams, "startsBefore" | "startsOnOrAfter"> {
    if (timing === "All") {
        return {};
    }
    if (timing === "Future") {
        return { startsOnOrAfter: today.toStartInstant() };
    }
    if (timing === "All past") {
        return { startsBefore: today.toStartInstant() };
    }
    const years = timing === "Past year" ? 1 : 5;
    const firstDate = Temporal.PlainDate.from(today.date).subtract({ years }).toString();
    return { startsBefore: today.toStartInstant(), startsOnOrAfter: new CalendarDate(firstDate, today.timeZone).toStartInstant() };
}

export function readSongHistory(database: DB3ReadDatabase, authorization: CMServerAuthorization, input: SongHistoryInput): Promise<SongHistoryResult> {
    const args = SongHistoryInputSchema.parse(input);
    const { bandPublicId, routeLocale, browserLanguages, clientRequestId } = args;
    const presentation = { bandPublicId, routeLocale, browserLanguages, clientRequestId };
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization.requireUser();
        const band = auth.requireBand();
        if (band.publicId !== args.bandPublicId) {
            throw new AuthorizationError("Song history requires the selected band.");
        }
        auth.requirePermission(Permission.view_songs);
        auth.requirePermission(Permission.view_events_nonpublic);
        const song = await queryView({ view: songReferenceView, ...presentation, filter: { tableParams: { songId: args.songId } }, cmdbQueryContext: "song history owner" }, auth, context);
        if (!song.items.length) {
            throw new AuthorizationError("Song was not found.");
        }
        const timeZone = await loadBandTimeZone(context.database, band.id);
        const today = CalendarDate.fromInstant({ value: new Date(), timeZone });
        const { timing, ...catalogFilters } = args.filterSpec;
        const result = await queryView({
            view: songHistoryEventView, ...presentation,
            filter: { tableParams: { songId: args.songId, ...catalogFilters, ...songHistoryDateFilter(timing, today) } },
            orderBy: { startsAt: "desc" }, cmdbQueryContext: "song performance history",
        }, auth, context);
        return { events: result.items };
    });
}
