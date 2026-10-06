import { AuthorizationError } from "blitz";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import { collectLocalePreferences, selectFormattingLocale } from "src/locale/shared/localePreferences";
import type { LegacyQueryInputBase } from "../shared/db3core";
import { queryResolvedCatalog } from "../shared/core/resolvedCatalogQuery";
import { bandInstrumentGroupView, bandInstrumentView, xBandInstrument, xBandInstrumentFunctionalGroup } from "../shared/entities/instrument/bandInstrumentContracts";
import { loadBandInstrumentCatalog, type InstrumentCatalogDatabase } from "./bandInstrumentCatalog";

/** Named views retain their DTO contracts while their localized fields use batch resolution. */
// TODO: this needs to go. we should use db3 native querying.
export async function readBandInstrumentView(
    database: InstrumentCatalogDatabase,
    auth: CMServerAuthorization,
    input: LegacyQueryInputBase,
    skip = 0,
    take?: number,
) {
    const isInstrument = input.table.tableID === xBandInstrument.tableID;
    const view = isInstrument ? bandInstrumentView : bandInstrumentGroupView;
    if (input.table.tableName !== view.tableName || input.table.viewID !== view.viewID) throw new Error("A registered catalog view is required.");
    if (input.includeDeleted) throw new AuthorizationError("Catalog hiding uses the catalog editor, not deleted-row access.");
    if (input.bandPublicId != null && input.bandPublicId !== auth.requireBand().publicId) throw new AuthorizationError("The request band does not match authorization.");
    if (input.filter.pks || input.filter.tagIds || Object.keys(input.filter.tableParams ?? {}).length) throw new Error("This catalog view accepts public identities and resolved fields.");
    const catalog = await loadBandInstrumentCatalog(database, auth, input);
    const rows = isInstrument ? catalog.instruments : catalog.groups;
    const allowedFields = new Set(["publicId", "name", "description", "sortOrder", ...(isInstrument ? ["functionalGroupId"] : [])]);
    for (const filter of input.filter.items ?? []) {
        if (!allowedFields.has(filter.field) || filter.operator !== "equals") throw new Error("Unsupported catalog filter.");
    }
    const filtered = rows.filter(row => {
        if (input.filter.publicIds && !input.filter.publicIds.includes(row.publicId)) return false;
        return (input.filter.items ?? []).every(filter => {
            switch (filter.field) {
                case "publicId": return row.publicId === filter.value;
                case "name": return row.name === filter.value;
                case "description": return row.description === filter.value;
                case "sortOrder": return row.sortOrder === filter.value;
                case "functionalGroupId": return "functionalGroupId" in row && row.functionalGroupId === filter.value;
                default: return false;
            }
        });
    });
    const order = input.orderBy ? Object.keys(input.orderBy)[0] : "sortOrder";
    if (order !== "name" && order !== "sortOrder") throw new Error("Unsupported catalog sort field.");
    const locale = selectFormattingLocale(collectLocalePreferences(input));
    const searched = filtered.filter(row => (input.filter.quickFilterValues ?? [])
        .every(value => row.name?.toLocaleLowerCase(locale).includes(value.toLocaleLowerCase(locale))));
    return queryResolvedCatalog(searched, { sort: order, direction: input.orderBy?.[order], skip, take }, locale);
}
export const isBandInstrumentTable = (tableID: string) => tableID === xBandInstrument.tableID || tableID === xBandInstrumentFunctionalGroup.tableID;
