import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3Table,
    DB3IdentityOf,
    DB3ReferenceValueOf,
} from "../db3core";

export class DB3HydrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3HydrationError";
    }
}

export interface DB3ReferenceProvider {
    /**
     * Whether this provider owns the complete lookup set for an entity. An
     * unregistered table means normalized hydration is not requested for that
     * relation; a registered table with a missing identity is still an error.
     */
    hasTable<TEntity extends AnyDB3Table>(entity: TEntity): boolean;

    // - if entity is not found, returns undefined
    // - if id is undefined, returns undefined
    // - if id is null, returns null
    // so yea there's no way to know if an entity was not found vs. id undefined.
    get<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
    ): DB3ReferenceValueOf<TEntity> | undefined | null;

    // Preserves the distinction between an authorized empty collection and a
    // collection omitted by field authorization.
    mapOptionalCollection<TAssociation, Treturn>(
        associations: (TAssociation | null | undefined)[] | null | undefined,
        hydrate: (association: TAssociation, index: number) => Treturn,
    ): Treturn[] | undefined;

    require<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
        path: string,
    ): DB3ReferenceValueOf<TEntity>;
}

/**
 * A request/session-scoped normalized reference store. Hydration is deliberately
 * synchronous: fetching and cache population happen before a view is hydrated.
 */
export class DB3ReferenceStore implements DB3ReferenceProvider {
    private readonly entities = new Map<string, Map<number | string, TAnyModel>>();

    register<TEntity extends AnyDB3Table>(
        entity: TEntity,
        rows: readonly DB3ReferenceValueOf<TEntity>[],
    ): void {
        this.entities.set(entity.tableID, new Map(
            rows.map(row => [entity.getIdentity(row), row]),
        ));
    }

    hasTable<TEntity extends AnyDB3Table>(entity: TEntity): boolean {
        return this.entities.has(entity.tableID);
    }

    get<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined, // null/undefined supported for convenience to callers to avoid ternaries everywhere.
    ): DB3ReferenceValueOf<TEntity> | undefined | null {
        if (id === null) {
            return null;
        }
        if (id === undefined) {
            return undefined;
        }
        return this.entities.get(entity.tableID)?.get(id) as DB3ReferenceValueOf<TEntity> | undefined;
    }

    mapOptionalCollection<TAssociation, Treturn>(
        associations: (TAssociation | null | undefined)[] | null | undefined,
        hydrate: (association: TAssociation, index: number) => Treturn,
    ): Treturn[] | undefined {
        if (associations == null) return undefined;
        return associations.flatMap((association, index) => association == null ? [] : [hydrate(association, index)]);
    }


    // wraps get() and throws if the entity is not found.
    require<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
        path: string,
    ): DB3ReferenceValueOf<TEntity> {
        const value = this.get(entity, id);
        if (!value) {
            throw new DB3HydrationError(
                `Unable to hydrate ${path}: ${entity.tableID} '${String(id)}' is not available.`,
            );
        }
        return value;
    }
}
