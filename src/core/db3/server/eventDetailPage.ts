import { NotFoundError } from "blitz";
import { Permission } from "shared/permissions";
import type { EventPublicId } from "shared/publicId";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { eventDetailView, eventStatusDashboardView } from "../db3";
import { executeDB3Read, type DB3ReadDatabase } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

/** Page metadata uses the same authorized snapshot and view as the detail reader. */
export function readEventDetailPage(database: DB3ReadDatabase, authorization: CMServerAuthorization,
    input: PresentationInput, eventId: EventPublicId,
): Promise<{ title: string; eventId: EventPublicId } | null> {
    return executeDB3Read(database, authorization, async context => {
        const auth = context.authorization;
        if (!auth.hasPermission(Permission.view_events_nonpublic) || !input.bandPublicId
            || auth.band?.publicId !== input.bandPublicId) {
            return null;
        }
        const result = await queryView({ view: eventDetailView, ...input,
            filter: { tableParams: { eventId } }, take: 1, cmdbQueryContext: "event detail page",
        }, auth, context).catch(error => {
            // Unknown and invisible identities share the page's ordinary 404 response.
            if (error instanceof NotFoundError) {
                return null;
            }
            throw error;
        });
        const event = result?.items[0];
        if (!event) {
            return null;
        }
        const statuses = await queryView({ view: eventStatusDashboardView, ...input,
            filter: {}, cmdbQueryContext: "event page cancellation",
        }, auth, context);
        const cancelled = new Set(statuses.items.filter(status => status.significance === "Cancelled").map(status => status.publicId));
        const segments = (event.segments ?? []).filter(segment => !segment.statusId || !cancelled.has(segment.statusId));
        // Prefer the first dated segment; use a TBD segment when no date is set.
        const first = segments.find(segment => segment.startsAt !== null) ?? segments[0];
        const locale = selectFormattingLocale(collectLocalePreferences(input));
        const timeZone = await loadBandTimeZone(context.database, auth.requireBand().id);
        const date = first?.startsAt
            ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone }).format(first.startsAt)
            : "TBD";
        return { title: first ? `${event.name} | ${date}` : event.name, eventId: event.publicId };
    });
}
