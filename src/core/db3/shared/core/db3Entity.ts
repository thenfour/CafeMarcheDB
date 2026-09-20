import type { TAnyModel } from "@/shared/rootroot";
import type { xTable } from "../db3core";

export type DB3EntityId = number | string;

/**
 * The stable, table-level part of DB3. Query shape belongs to DB3View instead.
 *
 * TDelegate is type-only Prisma metadata used by views to derive their exact
 * pre-authorization database payload from a Prisma selection.
 */
export interface DB3Entity<
    TDelegate,
    TClientEntity extends TAnyModel,
    TId extends DB3EntityId,
> {
    readonly entityID: string;
    readonly schema: xTable;
    readonly getIdentity: (entity: TClientEntity) => TId;

    // Phantom members preserve the entity contract without adding runtime data.
    readonly __delegate?: TDelegate;
    readonly __clientEntity?: TClientEntity;
    readonly __identity?: TId;
}

export type AnyDB3Entity = DB3Entity<any, TAnyModel, DB3EntityId>;

export type PrismaDelegateOf<TEntity extends AnyDB3Entity> =
    NonNullable<TEntity["__delegate"]>;

export type ClientEntityOf<TEntity extends AnyDB3Entity> =
    NonNullable<TEntity["__clientEntity"]>;

export type EntityIdOf<TEntity extends AnyDB3Entity> =
    NonNullable<TEntity["__identity"]>;

/**
 * Curried so the Prisma delegate can be supplied once while the client entity
 * and identity types are inferred from getIdentity.
 */
export const defineEntity = <TDelegate,>() => <
    TClientEntity extends TAnyModel,
    TId extends DB3EntityId,
>(args: {
    entityID?: string;
    schema: xTable;
    getIdentity: (entity: TClientEntity) => TId;
}): DB3Entity<TDelegate, TClientEntity, TId> => ({
    entityID: args.entityID || args.schema.tableID,
    schema: args.schema,
    getIdentity: args.getIdentity,
});

