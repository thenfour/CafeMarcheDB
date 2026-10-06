/** Small catalogs are resolved in a batch before filtering, ordering, and slicing. */
export interface ResolvedCatalogRow {
    readonly publicId: string;
    readonly name: string | null;
    readonly sortOrder: number;
}
export interface ResolvedCatalogQuery {
    readonly search?: string;
    readonly sort?: "name" | "sortOrder";
    readonly direction?: "asc" | "desc";
    readonly skip?: number;
    readonly take?: number;
}

// performs an in-memory query, case-insensitive.
// but this is just a poor duplication of db3's native quick search capabilities.
export function queryResolvedCatalog<T extends ResolvedCatalogRow>(
    rows: readonly T[],
    query: ResolvedCatalogQuery,
    formattingLocale: string
) {
    const collator = new Intl.Collator(formattingLocale, { sensitivity: "base", numeric: true });
    const compareName = (left: T, right: T) => left.name === null ? (right.name === null ? 0 : 1)
        : right.name === null ? -1 : collator.compare(left.name, right.name);

    const needle = query.search?.toLocaleLowerCase(formattingLocale);
    const matches = rows.filter(row => !needle || row.name?.toLocaleLowerCase(formattingLocale).includes(needle));
    const direction = query.direction === "desc" ? -1 : 1;
    matches.sort((left, right) => {
        const comparison = query.sort === "name" ? compareName(left, right)
            : left.sortOrder - right.sortOrder || compareName(left, right);
        // Public identity breaks locale-equivalent ties independently of result order.
        return comparison * direction || (left.publicId < right.publicId ? -1 : left.publicId > right.publicId ? 1 : 0);
    });
    const skip = query.skip ?? 0;
    return {
        items: matches.slice(skip, query.take === undefined ? undefined : skip + query.take),
        count: matches.length
    };
}
