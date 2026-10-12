import { CalculateMatchStrengthForTags, type ParseQuickFilterResult } from "shared/quickFilter";
import type { AnyDB3Field, xTable } from "../shared/db3core";
import type { SearchCatalogs } from "./searchCatalogs";

export interface QuickSearchTagMatches {
    readonly names: ReadonlyMap<string, string>;
    readonly publicIdsByToken: readonly string[][];
}

/** #tag grammar uses literal substrings of authorized, resolved labels. */
export async function readQuickSearchTags(table: xTable, field: AnyDB3Field,
    query: ParseQuickFilterResult, catalogs: SearchCatalogs,
): Promise<QuickSearchTagMatches> {
    const names = new Map<string, string>();
    const auth = catalogs.context.authorization;
    if (query.tags.length && table.authorizeColumnForView({ model: null, auth, columnName: field.member })) {
        const target = field.getDiscreteCriterionTargetTable();
        if (!target) {
            throw new Error(`Tag search requires a relation: ${table.tableID}.${field.member}.`);
        }
        for (const label of await catalogs.readableNames(target)) {
            if (label.name !== null) {
                names.set(label.publicId, label.name);
            }
        }
    }
    return {
        names,
        // A bare # retains the reference constraint that a readable tag must exist.
        publicIdsByToken: query.tags.map(token => [...names].flatMap(([id, name]) =>
            name.toLowerCase().includes(token.toLowerCase()) ? [id] : [])),
    };
}

export function quickSearchTagStrength(publicIds: readonly string[], tags: QuickSearchTagMatches, query: ParseQuickFilterResult) {
    const names = publicIds.flatMap(publicId => {
        const name = tags.names.get(publicId);
        return name === undefined ? [] : [{ name }];
    });
    return CalculateMatchStrengthForTags({ fieldName: "name", fieldType: "string", strengthMultiplier: 1 }, names, query);
}
