import type { PermissionRequirement } from "src/auth/shared/permissionRequirement";
import type { AnyDB3Field, xTable } from "../shared/db3core";
import { DiscreteCriterionFilterType } from "../shared/apiTypes";
import { resolvePublicIds } from "./db3PublicIds";
import { SearchCatalogs, searchCatalogNameMatches } from "./searchCatalogs";

export interface SearchReferenceName {
    readonly field: AnyDB3Field;
    readonly permission: PermissionRequirement;
}

/** Relations supply SQL membership predicates; catalog views supply eligible display names. */
export async function buildSearchReferenceNamePredicates(
    table: xTable,
    references: readonly SearchReferenceName[],
    tokens: readonly string[],
    catalogs: SearchCatalogs,
): Promise<ReadonlyMap<string, readonly string[]>> {
    const predicates = new Map<string, string[]>();
    if (!tokens.length) {
        return predicates;
    }
    const { authorization: auth, database } = catalogs.context;
    for (const { field, permission } of references) {
        if (!auth.hasPermission(permission)
            || !table.authorizeColumnForView({ model: null, auth, columnName: field.member })) {
            continue;
        }
        const target = field.getDiscreteCriterionTargetTable();
        if (!target) {
            throw new Error(`Name search requires a relation: ${table.tableID}.${field.member}.`);
        }
        const labels = await catalogs.readableNames(target);
        const matchingLabels = labels.filter(label => tokens.some(token => searchCatalogNameMatches(label.name, token)));
        const ids = await resolvePublicIds(target, matchingLabels.map(label => label.publicId), auth, database);
        for (const token of tokens) {
            const options = matchingLabels.flatMap((label, index) => searchCatalogNameMatches(label.name, token) ? [ids[index]!] : []);
            if (!options.length) {
                continue;
            }
            const criterion = field.SqlGetDiscreteCriterionElements({
                db3Column: field.member, behavior: DiscreteCriterionFilterType.hasSomeOf, options,
            }, "P", auth);
            if (!criterion || criterion.error) {
                throw new Error(`Relation cannot match names: ${table.tableID}.${field.member}.`);
            }
            const expressions = predicates.get(token) ?? [];
            expressions.push(criterion.whereAnd);
            predicates.set(token, expressions);
        }
    }
    return predicates;
}
