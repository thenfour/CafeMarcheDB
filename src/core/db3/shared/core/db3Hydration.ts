import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3Table,
    DB3IdentityOf,
} from "../db3core";

export class DB3HydrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3HydrationError";
    }
}

/** A consumer-facing entity value supplied by one reference provider. */
export interface DB3ReferenceDefinition<
    TEntity extends AnyDB3Table,
    TValue,
> {
    readonly entity: TEntity;
    /** Type-only invariant marker. */
    readonly __value?: (value: TValue) => TValue;
}

export type AnyDB3ReferenceDefinition = DB3ReferenceDefinition<AnyDB3Table, any>;

export interface DB3ReferenceContract<
    TDefinitions extends Readonly<Record<string, AnyDB3ReferenceDefinition>>,
> {
    readonly definitions: TDefinitions;
    has(entity: AnyDB3Table): boolean;
}

export type AnyDB3ReferenceContract = DB3ReferenceContract<
    Readonly<Record<string, AnyDB3ReferenceDefinition>>
>;

export function reference<TEntity extends AnyDB3Table>(entity: TEntity) {
    return <TValue>(): DB3ReferenceDefinition<TEntity, TValue> => ({ entity });
}

export function defineReferenceContract<
    const TDefinitions extends Readonly<Record<string, AnyDB3ReferenceDefinition>>,
>(definitions: TDefinitions): DB3ReferenceContract<TDefinitions> {
    const tableIDs = new Set<string>();
    for (const definition of Object.values(definitions)) {
        if (tableIDs.has(definition.entity.tableID)) {
            throw new DB3HydrationError(
                `Reference contract declares DB3 table '${definition.entity.tableID}' more than once.`,
            );
        }
        tableIDs.add(definition.entity.tableID);
    }
    return {
        definitions,
        has: entity => tableIDs.has(entity.tableID),
    };
}

export const emptyReferenceContract = defineReferenceContract({});

type IsAny<TValue> = 0 extends (1 & TValue) ? true : false;

type DB3ReferenceDefinitionsOf<TContract> =
    TContract extends DB3ReferenceContract<infer TDefinitions>
    ? TDefinitions
    : never;

type DB3ReferenceStoreConstructorArgs<TContract> =
    keyof DB3ReferenceDefinitionsOf<TContract> extends never
    ? [contract?: TContract]
    : [contract: TContract];

type IsSameEntity<TLeft, TRight> =
    [TLeft] extends [TRight]
    ? [TRight] extends [TLeft]
    ? true
    : false
    : false;

export type DB3ReferenceEntityOf<TContract> =
    IsAny<TContract> extends true
    ? AnyDB3Table
    : DB3ReferenceDefinitionsOf<TContract>[keyof DB3ReferenceDefinitionsOf<TContract>] extends DB3ReferenceDefinition<infer TEntity, any>
    ? TEntity
    : never;

export type DB3ReferenceValueOf<
    TContract,
    TEntity extends AnyDB3Table,
> = IsAny<TContract> extends true
    ? TAnyModel
    : {
        [TKey in keyof DB3ReferenceDefinitionsOf<TContract>]:
        DB3ReferenceDefinitionsOf<TContract>[TKey] extends DB3ReferenceDefinition<
            infer TDefinedEntity,
            infer TValue
        >
        ? IsSameEntity<TDefinedEntity, TEntity> extends true
        ? TValue
        : never
        : never;
    }[keyof DB3ReferenceDefinitionsOf<TContract>];

export interface DB3ReferenceProvider<
    TContract extends AnyDB3ReferenceContract = any,
> {
    /** Static capability/profile implemented by this runtime provider. */
    readonly contract: TContract;

    // - if entity is not found, returns undefined
    // - if id is undefined, returns undefined
    // - if id is null, returns null
    get<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
    ): unknown | undefined | null;

    mapOptionalCollection<TAssociation, Treturn>(
        associations: (TAssociation | null | undefined)[] | null | undefined,
        hydrate: (association: TAssociation, index: number) => Treturn,
    ): Treturn[] | undefined;

    require<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
        path: string,
    ): unknown;
}

export function getReference<
    TContract extends AnyDB3ReferenceContract,
    TEntity extends DB3ReferenceEntityOf<NoInfer<TContract>>,
>(
    provider: DB3ReferenceProvider<TContract>,
    entity: TEntity,
    id: DB3IdentityOf<TEntity> | null | undefined,
): DB3ReferenceValueOf<TContract, TEntity> | undefined | null {
    // The helper's entity constraint selects the matching contract value;
    // DB3ReferenceProvider stays runtime-oriented and therefore returns unknown.
    return provider.get(entity, id) as
        | DB3ReferenceValueOf<TContract, TEntity>
        | undefined
        | null;
}

export function requireReference<
    TContract extends AnyDB3ReferenceContract,
    TEntity extends DB3ReferenceEntityOf<NoInfer<TContract>>,
>(
    provider: DB3ReferenceProvider<TContract>,
    entity: TEntity,
    id: DB3IdentityOf<TEntity> | null | undefined,
    path: string,
): DB3ReferenceValueOf<TContract, TEntity> {
    // The helper's entity constraint selects the matching contract value;
    // DB3ReferenceProvider stays runtime-oriented and therefore returns unknown.
    return provider.require(entity, id, path) as DB3ReferenceValueOf<TContract, TEntity>;
}

/**
 * Request/session-scoped normalized storage. Registered values are already in
 * their consumer representation; loading and conversion belong to the
 * provider which populates this store.
 */
export class DB3ReferenceStore<
    TContract extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
> implements DB3ReferenceProvider<TContract> {
    private readonly entities = new Map<string, Map<number | string, unknown>>();
    readonly contract: TContract;

    constructor(...args: DB3ReferenceStoreConstructorArgs<TContract>) {
        // The constructor tuple permits omission only for the default empty
        // contract; TypeScript cannot narrow that conditional generic here.
        this.contract = (args[0] ?? emptyReferenceContract) as TContract;
    }

    register<TEntity extends DB3ReferenceEntityOf<TContract>>(
        entity: TEntity,
        values: readonly DB3ReferenceValueOf<TContract, TEntity>[],
        getIdentity: (
            value: DB3ReferenceValueOf<TContract, TEntity>,
        ) => DB3IdentityOf<TEntity>,
    ): void {
        if (!this.contract.has(entity)) {
            throw new DB3HydrationError(
                `Unable to register ${entity.tableID}: the provider contract does not declare it.`,
            );
        }
        this.entities.set(entity.tableID, new Map(
            values.map(value => [getIdentity(value), value]),
        ));
    }

    get<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
    ): DB3ReferenceValueOf<TContract, TEntity> | undefined | null {
        if (id === null) return null;
        if (id === undefined) return undefined;
        // register() admits only values selected by the contract/entity pair;
        // the runtime map is intentionally erased because it stores all pairs.
        return this.entities.get(entity.tableID)?.get(id) as
            | DB3ReferenceValueOf<TContract, TEntity>
            | undefined;
    }

    mapOptionalCollection<TAssociation, Treturn>(
        associations: (TAssociation | null | undefined)[] | null | undefined,
        hydrate: (association: TAssociation, index: number) => Treturn,
    ): Treturn[] | undefined {
        if (associations == null) return undefined;
        return associations.flatMap((association, index) => (
            association == null ? [] : [hydrate(association, index)]
        ));
    }

    require<TEntity extends AnyDB3Table>(
        entity: TEntity,
        id: DB3IdentityOf<TEntity> | null | undefined,
        path: string,
    ): DB3ReferenceValueOf<TContract, TEntity> {
        const value = this.get(entity, id);
        if (value == null) {
            throw new DB3HydrationError(
                `Unable to hydrate ${path}: ${entity.tableID} '${String(id)}' is not available.`,
            );
        }
        return value;
    }
}
