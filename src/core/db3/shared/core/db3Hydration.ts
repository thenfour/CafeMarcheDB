import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3Table,
    DB3IdentityOf,
} from "../db3core";
import {
    deriveReferenceViewContract,
    type DB3ReferenceTransportOf,
    type DB3ReferenceValueOf,
} from "./db3ViewContract";

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
        rows: readonly DB3ReferenceTransportOf<TEntity>[],
    ): void {
        if (!entity.referenceSelection) {
            throw new DB3HydrationError(
                `Unable to register ${entity.tableID}: the table does not declare referenceSelection.`,
            );
        }
        const identityMember = entity.clientIdMember;
        if (entity.referenceTransportSelection?.select?.[identityMember] !== true) {
            throw new DB3HydrationError(
                `Unable to register ${entity.tableID}: reference transport selection must select identity member '${identityMember}'.`,
            );
        }
        const contract = deriveReferenceViewContract(entity);
        this.entities.set(entity.tableID, new Map(
            rows.map(row => {
                const hydrated = contract.hydrate(row, this);
                // The reference selection is required to include the canonical
                // identity. getIdentity's accepted row shape is intentionally
                // independent from the reference consumer contract.
                const identity = entity.getIdentity(hydrated as never);
                return [identity, hydrated];
            }),
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
