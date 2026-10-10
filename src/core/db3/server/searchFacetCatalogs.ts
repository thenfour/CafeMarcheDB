import { z } from "zod";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import type { SearchResultsFacetOption } from "../shared/apiTypes";
import type { xTable } from "../shared/db3core";
import type { AnyDB3View } from "../shared/core/db3View";
import { eventStatusDashboardView, eventTagDashboardView, eventTypeDashboardView, fileTagDashboardView, instrumentDashboardView, songTagDashboardView, userTagDashboardView } from "../shared/references/dashboardReferences";
import { bandRoleListView } from "../shared/entities/user/bandRoleViews";
import type { DB3ReadContext } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

// The search field selects a catalog at runtime; its registered view validates the concrete DTO.
const facetViews: readonly AnyDB3View[] = [
    eventTypeDashboardView,
    eventStatusDashboardView,
    eventTagDashboardView,
    songTagDashboardView,
    fileTagDashboardView,
    instrumentDashboardView,
    userTagDashboardView,
    bandRoleListView,
];
const FacetLabelSchema = z.object({
    publicId: z.string(),
    name: z.string().nullable(),
    description: z.string().nullable().optional(),
    // Instruments use the functional group's color.
    color: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
    sortOrder: z.number(),
});

/** SQL counts identities; shared catalog views resolve labels, inheritance and ordering. */
export async function resolveSearchFacetLabels(
    target: xTable | undefined,
    items: SearchResultsFacetOption[],
    context: DB3ReadContext,
    preferences: LocalePreferenceInput,
): Promise<SearchResultsFacetOption[]> {
    if (target?.queryStrategy !== "resolved") {
        return items;
    }
    const view = facetViews.find(view => view.tableID === target.tableID);
    if (!view) {
        throw new Error(`No search facet view for ${target.tableID}.`);
    }
    // Result recovery settings apply to the searched rows, never to catalog choices.
    const catalog = await queryView({
        view,
        routeLocale: preferences.routeLocale,
        browserLanguages: preferences.browserLanguages,
        filter: {}, cmdbQueryContext: "search facet labels"
    }, context.authorization, context);
    const counts = new Map(items.map(item => [item.id, item.rowCount]));
    const labels = catalog.items.map(item => FacetLabelSchema.parse(item));
    // QueryView uses the catalog's effective natural order, including localized-name ties.
    return [
        ...items.filter(item => item.id === null),
        ...labels.map(row => ({
            id: row.publicId, rowCount: counts.get(row.publicId) ?? 0,
            label: row.name, tooltip: row.description ?? null, color: row.color ?? null,
            iconName: row.iconName ?? null, shape: undefined,
        })),
    ];
}
