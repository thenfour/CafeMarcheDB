import type { Prisma } from "@prisma/client";
import { executeDB3Read, type DB3ReadContext, type DB3ReadDatabase } from "src/core/db3/server/db3ReadExecution";
import { loadBandTimeZone } from "src/server/bandTimeZone";
import { FacetedBreakdownInputSchema, type ActivityFacetItem, type FacetedBreakdownInput, type FacetedBreakdownResult } from "../activityReportTypes";
import { activityFacetBaseWhere, activityFacetReferenceWhere, type ActivityStringDimension } from "./activityFacetSelection";
import { activityReferenceItems, projectActivityReferenceCounts, readActivityFacetReferences } from "./activityFacetReferences";
import { authorizeActivityReport } from "./activityReportAuthorization";
import { activityParticipantToken } from "./activityAnonymization";
import { anonymousActivityContext } from "../activityContext";

async function stringFacet(context: DB3ReadContext, where: Prisma.ActionWhereInput, field: ActivityStringDimension): Promise<ActivityFacetItem[]> {
    const rows = await context.database.action.groupBy({ by: [field], where, _count: { _all: true } });
    return rows.flatMap(row => {
        const value = row[field];
        return value === null ? [] : [{ key: value, label: value, count: row._count._all }];
    });
}

async function contextFacet(context: DB3ReadContext, where: Prisma.ActionWhereInput): Promise<ActivityFacetItem[]> {
    const rows = await context.database.action.groupBy({ by: ["context"], where, _count: { _all: true } });
    const counts = new Map<string, number>();
    for (const row of rows) {
        const label = anonymousActivityContext(row.context);
        if (label !== null) {
            counts.set(label, (counts.get(label) ?? 0) + row._count._all);
        }
    }
    return [...counts].map(([key, count]) => ({ key, label: key, count }));
}

function referenceGroups(context: DB3ReadContext, where: Prisma.ActionWhereInput) {
    return context.database.action.groupBy({ by: ["songId", "eventId", "wikiPageId", "menuLinkId", "customLinkId"], where, _count: { _all: true } });
}
type ReferenceGroups = Awaited<ReturnType<typeof referenceGroups>>;
type ReferenceField = "songId" | "eventId" | "wikiPageId" | "menuLinkId" | "customLinkId";

function referenceCounts(groups: ReferenceGroups, field: ReferenceField) {
    const counts = new Map<number, number>();
    for (const row of groups) {
        const id = row[field];
        if (id !== null) {
            counts.set(id, (counts.get(id) ?? 0) + row._count._all);
        }
    }
    return [...counts].map(([id, count]) => ({ id, count }));
}

async function screenSizeFacet(context: DB3ReadContext, where: Prisma.ActionWhereInput): Promise<ActivityFacetItem[]> {
    const rows = await context.database.action.groupBy({ by: ["screenWidth", "screenHeight"], where, _count: { _all: true } });
    return rows.flatMap(row => row.screenWidth === null || row.screenHeight === null ? [] : [{
        key: `${row.screenWidth}x${row.screenHeight}`, label: `${row.screenWidth} × ${row.screenHeight}`, count: row._count._all,
    }]);
}

async function personFacet(context: DB3ReadContext, where: Prisma.ActionWhereInput, input: FacetedBreakdownInput): Promise<ActivityFacetItem[]> {
    const rows = await context.database.action.groupBy({ by: ["userId"], where, _count: { _all: true } });
    // Anonymous actions contribute to totals, but do not invent a shared anonymous person.
    return rows.flatMap(row => {
        if (row.userId === null) {
            return [];
        }
        const token = activityParticipantToken(row.userId, input);
        return [{ key: token, label: token.slice(0, 8), count: row._count._all }];
    });
}

export function readActivityFacets(database: DB3ReadDatabase, authorization: DB3ReadContext["authorization"], input: FacetedBreakdownInput): Promise<FacetedBreakdownResult> {
    const args = FacetedBreakdownInputSchema.parse(input);
    return executeDB3Read(database, authorization, async context => {
        const { band } = authorizeActivityReport(context.authorization, args.bandPublicId);
        const timeZone = await loadBandTimeZone(context.database, band.id);
        const start = performance.now();
        const baseWhere = await activityFacetBaseWhere(context, args, timeZone);
        const candidates = await referenceGroups(context, baseWhere);
        const references = await readActivityFacetReferences(context, args, {
            songIds: referenceCounts(candidates, "songId").map(row => row.id),
            eventIds: referenceCounts(candidates, "eventId").map(row => row.id),
            wikiPageIds: referenceCounts(candidates, "wikiPageId").map(row => row.id),
            menuLinkIds: referenceCounts(candidates, "menuLinkId").map(row => row.id),
            customLinkIds: referenceCounts(candidates, "customLinkId").map(row => row.id),
        });
        const where = activityFacetReferenceWhere(baseWhere, args, references);
        const groups = await referenceGroups(context, where);
        const total = { count: await context.database.action.count({ where }) };
        const facets: FacetedBreakdownResult["facets"] = {
            features: await stringFacet(context, where, "feature"),
            contexts: await contextFacet(context, where),
            operatingSystems: await stringFacet(context, where, "operatingSystem"),
            pointerTypes: await stringFacet(context, where, "pointerType"),
            browsers: await stringFacet(context, where, "browserName"),
            deviceClasses: await stringFacet(context, where, "deviceClass"),
            languages: await stringFacet(context, where, "language"),
            locales: await stringFacet(context, where, "locale"),
            timezones: await stringFacet(context, where, "timezone"),
            screenSizes: await screenSizeFacet(context, where),
            users: await personFacet(context, where, args),
            songs: projectActivityReferenceCounts(references.songs, referenceCounts(groups, "songId")),
            events: projectActivityReferenceCounts(references.events, referenceCounts(groups, "eventId")),
            wikiPages: projectActivityReferenceCounts(references.wikiPages, referenceCounts(groups, "wikiPageId")),
            menuLinks: projectActivityReferenceCounts(references.menuLinks, referenceCounts(groups, "menuLinkId")),
            customLinks: projectActivityReferenceCounts(references.customLinks, referenceCounts(groups, "customLinkId")),
        };
        return { total, facets, references: activityReferenceItems(references), timeZone, metrics: { queryTimeMs: Math.round(performance.now() - start) } };
    });
}
