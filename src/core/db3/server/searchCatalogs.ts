import { z } from "zod";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import { parsePublicId } from "shared/publicId";
import { matchesDB3Like } from "../shared/core/db3MemoryQuery";
import type { AnyDB3View } from "../shared/core/db3View";
import type { xTable } from "../shared/db3core";
import { bandRoleListView } from "../shared/entities/user/bandRoleViews";
import { eventStatusDashboardView, eventTagDashboardView, eventTypeDashboardView, fileTagDashboardView, instrumentDashboardView, songTagDashboardView, userTagDashboardView, wikiPageTagDashboardView } from "../shared/references/dashboardReferences";
import type { DB3ReadContext } from "./db3ReadExecution";
import { queryView } from "./db3QueryCore";

// Different catalogs share this small presentation contract; their views validate full DTOs.
const catalogViews: readonly AnyDB3View[] = [
    eventTypeDashboardView, eventStatusDashboardView, eventTagDashboardView,
    songTagDashboardView, fileTagDashboardView, instrumentDashboardView,
    userTagDashboardView, bandRoleListView, wikiPageTagDashboardView,
];
const SearchCatalogLabelSchema = z.object({
    publicId: z.string(),
    name: z.string().nullable(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    iconName: z.string().nullable().optional(),
    sortOrder: z.number(),
});
export type SearchCatalogLabel = z.infer<typeof SearchCatalogLabelSchema>;

/** One request's authorized labels, shared by matching and facets in the same snapshot. */
export class SearchCatalogs {
    private readonly reads = new Map<string, Promise<readonly SearchCatalogLabel[]>>();

    constructor(readonly context: DB3ReadContext, private readonly preferences: LocalePreferenceInput) { }

    read(target: xTable): Promise<readonly SearchCatalogLabel[]> {
        const existing = this.reads.get(target.tableID);
        if (existing) {
            return existing;
        }
        const read = this.load(target);
        this.reads.set(target.tableID, read);
        return read;
    }

    async readableNames(target: xTable): Promise<readonly SearchCatalogLabel[]> {
        const auth = this.context.authorization;
        if (!target.authorizeTableForView(auth)
            || !target.authorizeColumnForView({ model: null, auth, columnName: "name" })) {
            return [];
        }
        return this.read(target);
    }

    private async load(target: xTable): Promise<readonly SearchCatalogLabel[]> {
        const view = catalogViews.find(view => view.tableID === target.tableID);
        if (!view) {
            throw new Error(`No search catalog view for ${target.tableID}.`);
        }
        const result = await queryView({
            view,
            bandPublicId: parsePublicId<"Band">(this.context.authorization.requireBand().publicId),
            routeLocale: this.preferences.routeLocale,
            browserLanguages: this.preferences.browserLanguages,
            filter: {},
            cmdbQueryContext: "search catalog labels",
        }, this.context.authorization, this.context);
        return result.items.map(item => SearchCatalogLabelSchema.parse(item));
    }
}

/** Match the same case/accent-insensitive LIKE subset as resolved DB3 text fields. */
export function searchCatalogNameMatches(name: string | null, token: string): boolean {
    // Domain SQL escapes literal percent and backslash; underscore retains LIKE semantics.
    const pattern = `%${token.replace(/[\\%]/g, character => `\\${character}`)}%`;
    return name !== null && matchesDB3Like(name, pattern);
}
