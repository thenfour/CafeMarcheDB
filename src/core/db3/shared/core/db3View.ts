import type { TAnyModel } from "@/shared/rootroot";
import {
    ZodToPrismaSelection,
    type ZodPrismaSelection,
} from "@/shared/prismaUtils";
import type { Prisma } from "db";
import type { z } from "zod";
import type { CMDBTableFilterModel } from "../apiTypes";
import type { DB3Authorization } from "../db3Authorization";
import type { AnyDB3Table, DB3PrismaDelegateOf } from "../db3core";
import {
    emptyReferenceContract,
    type AnyDB3ReferenceContract,
    type DB3ReferenceProvider,
} from "./db3Hydration";

type ArrayItem<T> = T extends readonly (infer TItem)[] ? TItem : never;

export interface DB3ViewSelectionContext {
    readonly filter: CMDBTableFilterModel;
    readonly authorization: DB3Authorization;
}

export type DB3ViewSelectionArgs<TEntity extends AnyDB3Table> = Partial<Pick<
    Prisma.Args<DB3PrismaDelegateOf<TEntity>, "findMany">,
    "select" | "include"
>>;

export type DB3ViewWhere<TEntity extends AnyDB3Table> = NonNullable<
    Prisma.Args<DB3PrismaDelegateOf<TEntity>, "findMany">["where"]
>;

export type DerivedDB3ViewSelection<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
> = ZodPrismaSelection<TDtoSchema> & DB3ViewSelectionArgs<TEntity>;

export interface DB3View<
    TEntity extends AnyDB3Table,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
> {
    // viewID is needed similar to tableID - the server does its own lookup and
    // verification
    readonly viewID: string;
    readonly entity: TEntity;
    readonly tableID: string;
    readonly tableName: string;
    readonly dtoSchema: TDtoSchema;
    readonly referenceContract: TReferences;
    readonly getSelectionArgs: (context: DB3ViewSelectionContext) => TSelection;
    readonly getWhereClause: (
        context: DB3ViewSelectionContext,
    ) => DB3ViewWhere<TEntity> | undefined;
    readonly hydrate: (
        dto: z.infer<TDtoSchema>,
        references: DB3ReferenceProvider<TReferences>,
    ) => TClient;

    parseDto(value: unknown): z.infer<TDtoSchema>;
}

export type AnyDB3View = DB3View<AnyDB3Table, any, z.ZodTypeAny, TAnyModel, any>;

export type TableOf<TView extends AnyDB3View> = TView["entity"];

export type DbPayloadOf<TView extends AnyDB3View> = ArrayItem<Prisma.Result<
    DB3PrismaDelegateOf<TableOf<TView>>,
    ReturnType<TView["getSelectionArgs"]>,
    "findMany"
>>;

export type DtoOf<TView extends AnyDB3View> = z.infer<TView["dtoSchema"]>;

export type ClientOf<TView extends AnyDB3View> = ReturnType<TView["hydrate"]>;

export type ReferenceContractOf<TView extends AnyDB3View> = TView["referenceContract"];

const views = new Map<string, AnyDB3View>();

interface DefineViewBaseArgs<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TReferences extends AnyDB3ReferenceContract,
> {
    viewID: string;
    entity: TEntity;
    dtoSchema: TDtoSchema;
    references?: TReferences;
    where?: DB3ViewWhereInput<TEntity>;
    hydrate: (
        dto: z.infer<TDtoSchema>,
        references: DB3ReferenceProvider<TReferences>,
    ) => TClient;
}

type DB3ViewSelectionInput<
    TSelection,
> = TSelection | ((context: DB3ViewSelectionContext) => TSelection);

type DB3ViewWhereInput<TEntity extends AnyDB3Table> =
    | DB3ViewWhere<TEntity>
    | ((context: DB3ViewSelectionContext) => DB3ViewWhere<TEntity>);

// overload with no selection specified (will be deduced from the DTO schema)
export function defineView<
    TEntity extends AnyDB3Table,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient, TReferences> & {
    selection?: undefined;
}): DB3View<
    TEntity,
    DerivedDB3ViewSelection<TEntity, TDtoSchema>,
    TDtoSchema,
    TClient,
    TReferences
>;

// overload with a selection specified explicitly and concretely.
export function defineView<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient, TReferences> & {
    selection: DB3ViewSelectionInput<TSelection>;
}): DB3View<TEntity, TSelection, TDtoSchema, TClient, TReferences>;

// implementation handling both overloads
export function defineView<
    TEntity extends AnyDB3Table,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
    TReferences extends AnyDB3ReferenceContract = typeof emptyReferenceContract,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient, TReferences> & {
    selection?: DB3ViewSelectionInput<TSelection>;
}): DB3View<TEntity, TSelection, TDtoSchema, TClient, TReferences> {
    const derivedSelection = args.selection === undefined
        ? ZodToPrismaSelection(args.dtoSchema)
        : undefined;
    const view: DB3View<TEntity, TSelection, TDtoSchema, TClient, TReferences> = {
        viewID: args.viewID,
        entity: args.entity,
        tableID: args.entity.tableID,
        tableName: args.entity.tableName,
        dtoSchema: args.dtoSchema,
        referenceContract: args.references
            ?? (emptyReferenceContract as TReferences),
        getSelectionArgs: args.selection === undefined
            ? () => derivedSelection as TSelection
            : typeof args.selection === "function"
                ? args.selection as (context: DB3ViewSelectionContext) => TSelection
                : () => args.selection as TSelection,
        getWhereClause: args.where === undefined
            ? () => undefined
            : typeof args.where === "function"
                ? args.where
                : () => args.where,
        hydrate: args.hydrate,
        parseDto: value => args.dtoSchema.parse(value),
    };

    const existing = views.get(view.viewID);
    if (existing && existing.entity.tableID !== view.entity.tableID) {
        throw new Error(
            `DB3 view '${view.viewID}' is already registered for ${existing.entity.tableID}.`,
        );
    }
    views.set(view.viewID, view as AnyDB3View);
    return view;
}

export function getDB3View(viewID: string): AnyDB3View {
    const view = views.get(viewID);
    if (!view) throw new Error(`DB3 view '${viewID}' was not found.`);
    return view;
}

export function hydrateView<TView extends AnyDB3View>(
    view: TView,
    dto: DtoOf<NoInfer<TView>>,
    references: DB3ReferenceProvider<ReferenceContractOf<NoInfer<TView>>>,
): ClientOf<TView> {
    return view.hydrate(dto, references) as ClientOf<TView>;
}
