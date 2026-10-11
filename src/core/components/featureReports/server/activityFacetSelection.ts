import { Prisma } from "@prisma/client";
import { platformSysadminWhere } from "src/auth/server/principalPredicates";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import type { FacetedBreakdownInput } from "../activityReportTypes";
import { activityBucketIntervals } from "./activityBucketSelection";
import { authorizedActivityReferenceIds, type ActivityReferenceSet } from "./activityFacetReferences";

export type ActivityStringDimension = keyof Pick<Prisma.ActionWhereInput,
    "feature" | "context" | "operatingSystem" | "pointerType" | "browserName" | "deviceClass" | "language" | "locale" | "timezone">;
type ActivityReferenceDimension = keyof Pick<Prisma.ActionWhereInput, "songId" | "eventId" | "wikiPageId" | "menuLinkId" | "customLinkId">;

function stringConditions(field: ActivityStringDimension, include: readonly string[], exclude: readonly string[]): Prisma.ActionWhereInput[] {
    const conditions: Prisma.ActionWhereInput[] = [];
    if (include.length) {
        conditions.push({ [field]: { in: [...include] } });
    }
    if (exclude.length) {
        // Anonymous/missing dimensions remain part of the selected activity.
        conditions.push(field === "feature" ? { feature: { notIn: [...exclude] } }
            : { OR: [{ [field]: null }, { [field]: { notIn: [...exclude] } }] });
    }
    return conditions;
}

export async function activityFacetBaseWhere(context: DB3ReadContext, input: FacetedBreakdownInput, timeZone: string): Promise<Prisma.ActionWhereInput> {
    const intervals = activityBucketIntervals(input, input.selectedBucket, timeZone);
    const auth = context.authorization.requireUser();
    const conditions: Prisma.ActionWhereInput[] = [
        { bandId: auth.requireBand().id },
        // Prisma omits an empty nested OR. An impossible ID predicate must preserve an empty DST bucket.
        intervals.length ? { OR: intervals.map(interval => ({ createdAt: { gte: interval.start, lt: interval.endExclusive } })) } : { id: { in: [] } },
    ];
    if (input.filterSpec.excludeYourself) {
        conditions.push({ OR: [{ userId: null }, { userId: { not: auth.userId } }] });
    }
    if (input.filterSpec.excludeSysadmins) {
        const administrators = await context.database.user.findMany({ where: platformSysadminWhere, select: { id: true } });
        if (administrators.length) {
            conditions.push({ OR: [{ userId: null }, { userId: { notIn: administrators.map(person => person.id) } }] });
        }
    }
    const filter = input.filterSpec;
    conditions.push(...stringConditions("feature", filter.includeFeatures, filter.excludeFeatures));
    if (filter.contextBeginsWith) {
        // Prisma startsWith uses LIKE; treat authored prefixes as literal text, as the timeline does.
        conditions.push({ context: { startsWith: filter.contextBeginsWith.replace(/[\\%_]/g, "\\$&") } });
    }
    const facets = input.facetFilters;
    conditions.push(
        ...stringConditions("operatingSystem", facets.includeOperatingSystems, facets.excludeOperatingSystems),
        ...stringConditions("pointerType", facets.includePointerTypes, facets.excludePointerTypes),
        ...stringConditions("browserName", facets.includeBrowserNames, facets.excludeBrowserNames),
        ...stringConditions("deviceClass", facets.includeDeviceClasses, facets.excludeDeviceClasses),
        ...stringConditions("language", facets.includeLanguages, facets.excludeLanguages),
        ...stringConditions("locale", facets.includeLocales, facets.excludeLocales),
        ...stringConditions("timezone", facets.includeTimezones, facets.excludeTimezones),
    );
    return { AND: conditions };
}

function referenceConditions(field: ActivityReferenceDimension, references: ActivityReferenceSet,
    include: readonly string[], exclude: readonly string[]): Prisma.ActionWhereInput[] {
    const conditions: Prisma.ActionWhereInput[] = [];
    if (include.length) {
        // An empty authorized inclusion matches nothing, rather than silently broadening the report.
        conditions.push({ [field]: { in: authorizedActivityReferenceIds(references, include) } });
    }
    const excluded = authorizedActivityReferenceIds(references, exclude);
    if (excluded.length) {
        conditions.push({ OR: [{ [field]: null }, { [field]: { notIn: excluded } }] });
    }
    return conditions;
}

export function activityFacetReferenceWhere(base: Prisma.ActionWhereInput, input: FacetedBreakdownInput,
    references: { readonly songs: ActivityReferenceSet; readonly events: ActivityReferenceSet; readonly wikiPages: ActivityReferenceSet;
        readonly menuLinks: ActivityReferenceSet; readonly customLinks: ActivityReferenceSet }): Prisma.ActionWhereInput {
    const filters = input.facetFilters;
    return { AND: [base,
        ...referenceConditions("songId", references.songs, filters.includeSongIds, filters.excludeSongIds),
        ...referenceConditions("eventId", references.events, filters.includeEventIds, filters.excludeEventIds),
        ...referenceConditions("wikiPageId", references.wikiPages, filters.includeWikiPageIds, filters.excludeWikiPageIds),
        ...referenceConditions("menuLinkId", references.menuLinks, filters.includeMenuLinkIds, filters.excludeMenuLinkIds),
        ...referenceConditions("customLinkId", references.customLinks, filters.includeCustomLinkIds, filters.excludeCustomLinkIds),
    ] };
}
