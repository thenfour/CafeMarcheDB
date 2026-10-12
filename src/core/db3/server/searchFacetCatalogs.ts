import type { SearchResultsFacetOption } from "../shared/apiTypes";
import type { xTable } from "../shared/db3core";
import type { SearchCatalogs } from "./searchCatalogs";

/** SQL counts identities; shared catalog views resolve labels, inheritance and ordering. */
export async function resolveSearchFacetLabels(
    target: xTable | undefined,
    items: SearchResultsFacetOption[],
    catalogs: SearchCatalogs,
): Promise<SearchResultsFacetOption[]> {
    if (target?.queryStrategy !== "resolved") {
        return items;
    }
    // Result recovery settings apply to the searched rows, never to catalog choices.
    const labels = await catalogs.read(target);
    const counts = new Map(items.map(item => [item.id, item.rowCount]));
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
