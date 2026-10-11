import type { AnyDB3View, DtoOf } from "src/core/db3/shared/core/db3View";
import { queryView, type QueryViewInput } from "src/core/db3/server/db3QueryCore";
import { z } from "zod";
import { parsePublicId } from "shared/publicId";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";
import { songReferenceView } from "src/core/db3/shared/entities/song/songViews";
import { eventReferenceView } from "src/core/db3/shared/entities/event/eventViews";
import { wikiPageReferenceView } from "src/core/db3/shared/entities/wiki/wikiViews";
import { menuLinkReferenceView } from "src/core/db3/shared/entities/menuLink/menuLinkViews";
import { customLinkReferenceView } from "src/core/db3/shared/entities/customLink/customLinkViews";
import type { ActivityFacetItem, FacetedBreakdownInput } from "../activityReportTypes";

async function readReferences<TView extends AnyDB3View>(context: DB3ReadContext, input: QueryViewInput<TView>): Promise<DtoOf<TView>[]> {
    const auth = context.authorization;
    const view = input.view;
    if (!(view.dtoSchema instanceof z.ZodObject)) {
        throw new Error("Activity references require an object view.");
    }
    if (!input.filter.publicIds?.length || !view.entity.authorizeTableForView(auth) || Object.keys(view.dtoSchema.shape).some(columnName =>
        !view.entity.authorizeColumnForView({ auth, model: null, columnName }))) {
        return [];
    }
    const result = await queryView(input, auth, context);
    return result.items;
}

interface ReferenceIdentity { readonly id: number; readonly publicId: string }
interface ReferenceLabel<TKey extends string> { readonly publicId: TKey; readonly label: string }
export interface ActivityReferenceCounts { readonly id: number; readonly count: number }

export interface ActivityReferenceSet<TKey extends string = string> {
    readonly identities: readonly ReferenceIdentity[];
    readonly labels: readonly ReferenceLabel<TKey>[];
}

/** Natural IDs only correlate server aggregates. Authorized references supply every client identity and label. */
export function projectActivityReferenceCounts<TKey extends string>(references: ActivityReferenceSet<TKey>, counts: readonly ActivityReferenceCounts[]): ActivityFacetItem<TKey>[] {
    const countById = new Map(counts.map(row => [row.id, row.count]));
    const idByPublicId = new Map(references.identities.map(row => [row.publicId, row.id]));
    return references.labels.flatMap(row => {
        const id = idByPublicId.get(row.publicId);
        const count = id === undefined ? undefined : countById.get(id);
        return count === undefined ? [] : [{ key: row.publicId, label: row.label, count }];
    });
}

export function authorizedActivityReferenceIds(references: ActivityReferenceSet, publicIds: readonly string[]): number[] {
    const allowed = new Set(references.labels.map(row => row.publicId));
    return references.identities.filter(row => allowed.has(row.publicId) && publicIds.includes(row.publicId)).map(row => row.id);
}

function requireLabel(value: string | null | undefined): string {
    if (value === undefined) {
        throw new Error("An authorized activity reference is missing its label.");
    }
    // An authorized localized field can have no available text; keep the same blank label as navigation.
    return value ?? "";
}

export async function readActivityFacetReferences(context: DB3ReadContext, input: FacetedBreakdownInput,
    candidates: { readonly songIds: number[]; readonly eventIds: number[]; readonly wikiPageIds: number[];
        readonly menuLinkIds: number[]; readonly customLinkIds: number[] }) {
    const bandId = context.authorization.requireBand().id;
    const database = context.database;
    // Reads are explicit so the compiler checks each entity's schema and band ownership.
    const songIdentities = await database.song.findMany({ where: { bandId, OR: [{ id: { in: candidates.songIds } }, { publicId: { in: [...input.facetFilters.includeSongIds, ...input.facetFilters.excludeSongIds] } }] }, select: { id: true, publicId: true } });
    const eventIdentities = await database.event.findMany({ where: { bandId, OR: [{ id: { in: candidates.eventIds } }, { publicId: { in: [...input.facetFilters.includeEventIds, ...input.facetFilters.excludeEventIds] } }] }, select: { id: true, publicId: true } });
    const wikiIdentities = await database.wikiPage.findMany({ where: { bandId, OR: [{ id: { in: candidates.wikiPageIds } }, { publicId: { in: [...input.facetFilters.includeWikiPageIds, ...input.facetFilters.excludeWikiPageIds] } }] }, select: { id: true, publicId: true } });
    const menuIdentities = await database.menuLink.findMany({ where: { bandId, OR: [{ id: { in: candidates.menuLinkIds } }, { publicId: { in: [...input.facetFilters.includeMenuLinkIds, ...input.facetFilters.excludeMenuLinkIds] } }] }, select: { id: true, publicId: true } });
    const customIdentities = await database.customLink.findMany({ where: { bandId, OR: [{ id: { in: candidates.customLinkIds } }, { publicId: { in: [...input.facetFilters.includeCustomLinkIds, ...input.facetFilters.excludeCustomLinkIds] } }] }, select: { id: true, publicId: true } });
    const preferences = { bandPublicId: input.bandPublicId, routeLocale: input.routeLocale, browserLanguages: input.browserLanguages, cmdbQueryContext: "activity facet references" };
    const songs = await readReferences(context, { ...preferences, view: songReferenceView, filter: { publicIds: songIdentities.map(row => parsePublicId<"Song">(row.publicId)) } });
    const events = await readReferences(context, { ...preferences, view: eventReferenceView, filter: { publicIds: eventIdentities.map(row => parsePublicId<"Event">(row.publicId)) } });
    const wiki = await readReferences(context, { ...preferences, view: wikiPageReferenceView, filter: { publicIds: wikiIdentities.map(row => parsePublicId<"WikiPage">(row.publicId)) } });
    const menu = await readReferences(context, { ...preferences, view: menuLinkReferenceView, filter: { publicIds: menuIdentities.map(row => parsePublicId<"MenuLink">(row.publicId)) } });
    const custom = await readReferences(context, { ...preferences, view: customLinkReferenceView, filter: { publicIds: customIdentities.map(row => parsePublicId<"CustomLink">(row.publicId)) } });
    return {
        songs: { identities: songIdentities, labels: songs.map(row => ({ publicId: row.publicId, label: requireLabel(row.name) })) },
        events: { identities: eventIdentities, labels: events.map(row => ({ publicId: row.publicId, label: requireLabel(row.name) })) },
        wikiPages: { identities: wikiIdentities, labels: wiki.map(row => ({ publicId: row.publicId, label: requireLabel(row.slug) })) },
        menuLinks: { identities: menuIdentities, labels: menu.map(row => ({ publicId: row.publicId, label: requireLabel(row.caption) })) },
        customLinks: { identities: customIdentities, labels: custom.map(row => ({ publicId: row.publicId, label: requireLabel(row.name) })) },
    };
}
