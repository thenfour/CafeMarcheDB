import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3Entity,
    ClientEntityOf,
    EntityIdOf,
} from "./db3Entity";

export class DB3HydrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3HydrationError";
    }
}

export interface DB3ReferenceProvider {
    get<TEntity extends AnyDB3Entity>(
        entity: TEntity,
        id: EntityIdOf<TEntity>,
    ): ClientEntityOf<TEntity> | undefined;

    require<TEntity extends AnyDB3Entity>(
        entity: TEntity,
        id: EntityIdOf<TEntity>,
        path: string,
    ): ClientEntityOf<TEntity>;
}

/**
 * A request/session-scoped normalized reference store. Hydration is deliberately
 * synchronous: fetching and cache population happen before a view is hydrated.
 */
export class DB3ReferenceStore implements DB3ReferenceProvider {
    private readonly entities = new Map<string, Map<number | string, TAnyModel>>();

    register<TEntity extends AnyDB3Entity>(
        entity: TEntity,
        rows: readonly ClientEntityOf<TEntity>[],
    ): void {
        this.entities.set(entity.entityID, new Map(
            rows.map(row => [entity.getIdentity(row), row]),
        ));
    }

    get<TEntity extends AnyDB3Entity>(
        entity: TEntity,
        id: EntityIdOf<TEntity>,
    ): ClientEntityOf<TEntity> | undefined {
        return this.entities.get(entity.entityID)?.get(id) as ClientEntityOf<TEntity> | undefined;
    }

    require<TEntity extends AnyDB3Entity>(
        entity: TEntity,
        id: EntityIdOf<TEntity>,
        path: string,
    ): ClientEntityOf<TEntity> {
        const value = this.get(entity, id);
        if (!value) {
            throw new DB3HydrationError(
                `Unable to hydrate ${path}: ${entity.entityID} '${String(id)}' is not available.`,
            );
        }
        return value;
    }
}

