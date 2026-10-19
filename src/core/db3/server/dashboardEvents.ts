import { BandPermission } from "src/auth/shared/bandPermissionPolicy";
import { parsePublicId, type EventPublicId } from "shared/publicId";
import { gMillisecondsPerDay } from "shared/time";
import { BigintToNumberNullable } from "shared/utils";
import { GetRelevantEvents, gEventRelevanceClass, kMaxRelevantEventsToQuery, type EventRelevanceClassValue, type EventRelevanceContext } from "../shared/eventRelevance";
import { eventRelevanceView, xEvent, type DtoOf } from "../db3";
import type { DB3ReadContext } from "./db3ReadExecution";
import { searchViewPage } from "./searchServerCore";

function parseRelevanceOverride(value: number | null): EventRelevanceClassValue | null {
    if (value === null) {
        return null;
    }
    const classification = Object.values(gEventRelevanceClass).find(classification => classification === value);
    if (classification === undefined) {
        throw new Error("Unknown Event relevance override.");
    }
    return classification;
}

/** The reference's twenty nearest candidates feed its existing five-card classifier. */
export async function readDashboardRelevantEvents(context: DB3ReadContext, now: Date): Promise<EventPublicId[]> {
    const auth = context.authorization;
    if (!auth.user || !auth.band || !auth.hasPermission(BandPermission.view_events_nonpublic)) {
        return [];
    }
    if (!xEvent.authorizeTableForView(auth) || Object.keys(eventRelevanceView.dtoSchema.shape).some(columnName =>
        !xEvent.authorizeColumnForView({ auth, model: null, columnName }))) {
        return [];
    }
    // These windows measure elapsed time; UTC spans already preserve authored all-day/DST intent.
    const timing: EventRelevanceContext = {
        now, twentyFourHoursAgo: new Date(now.valueOf() - gMillisecondsPerDay),
        sevenDaysFromNow: new Date(now.valueOf() + 7 * gMillisecondsPerDay)
    };
    const candidates = await loadRelevantEventCandidates(context, timing);
    return GetRelevantEvents(candidates, timing).map(event => event.publicId);
}

async function loadRelevantEventCandidates(context: DB3ReadContext, timing: EventRelevanceContext) {
    const rows = await searchViewPage({
        view: eventRelevanceView,
        bandPublicId: parsePublicId<"Band">(context.authorization.requireBand().publicId),
        mode: {
            kind: "eventRelevance",
            now: timing.now,
            endedOnOrAfter: timing.twentyFourHoursAgo,
        },
        offset: 0,
        take: kMaxRelevantEventsToQuery,
        sort: [],
        quickFilter: "",
        discreteCriteria: [],
    }, context.authorization, context);
    return rows.map(readRelevanceCandidate);
}

function readRelevanceCandidate(row: DtoOf<typeof eventRelevanceView>) {
    const { publicId, startsAt, durationMillis, isAllDay, endDateTime, relevanceClassOverride } = row;
    // The classifier needs every selected field; reject a partial authorized DTO.
    if (startsAt === undefined || durationMillis === undefined || isAllDay === undefined
        || endDateTime === undefined || relevanceClassOverride === undefined) {
        throw new Error("Event relevance requires the complete timing projection.");
    }
    return {
        publicId, startsAt, isAllDay, endDateTime,
        durationMillis: BigintToNumberNullable(durationMillis),
        relevanceClassOverride: parseRelevanceOverride(relevanceClassOverride),
    };
}
