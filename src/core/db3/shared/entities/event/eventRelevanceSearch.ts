import { z } from "zod";
import { MySqlDateTimeLiteral, MySqlStringLiteral } from "shared/mysqlUtils";
import type { SearchModeDefinition } from "../../apiTypes";
import { gEventRelevanceClass } from "../../eventRelevance";

export const EventRelevanceSearchModeSchema = z.object({
    kind: z.literal("eventRelevance"),
    now: z.date(),
    endedOnOrAfter: z.date(),
}).strict();

/** Relevance includes explicit overrides outside the ordinary elapsed-time window. */
export const eventRelevanceSearchMode: SearchModeDefinition = {
    kind: "eventRelevance",
    readColumns: ["startsAt", "endDateTime", "relevanceClassOverride", "status"],
    buildQuery: (mode, api) => {
        const table = api.primaryTableAlias;
        const now = MySqlDateTimeLiteral(mode.now);
        const endedOnOrAfter = MySqlDateTimeLiteral(mode.endedOnOrAfter);
        return {
            // TODO: don't hardcode table / column names. compiler needs to be able to catch misspellingns / schema changes
            whereAnd: [
                `(${table}.relevanceClassOverride IS NULL OR ${table}.relevanceClassOverride <> ${gEventRelevanceClass.Hidden})`,
                `(${table}.relevanceClassOverride IS NOT NULL OR (
                    ${table}.startsAt IS NOT NULL AND ${table}.endDateTime >= ${endedOnOrAfter}
                    AND NOT EXISTS (
                        SELECT 1 FROM EventStatus relevanceStatus
                        WHERE relevanceStatus.id = ${table}.statusId
                        AND relevanceStatus.significance = ${MySqlStringLiteral("Cancelled")}
                    )
                ))`,
            ],
            sort: {
                join: [],
                select: [
                    { expression: `${table}.relevanceClassOverride IS NULL`, alias: api.getColumnAlias(), direction: "asc" },
                    { expression: `ABS(TIMESTAMPDIFF(MINUTE, ${table}.startsAt, ${now}))`, alias: api.getColumnAlias(), direction: "asc" },
                ],
            },
        };
    },
};
