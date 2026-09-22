import type { TAnyModel } from "@/shared/rootroot";
import {
    ZodToPrismaSelection,
    type ZodPrismaSelection,
} from "@/shared/prismaUtils";
import type { Prisma } from "db";
import type { z } from "zod";
import type { CMDBTableFilterModel } from "../apiTypes";
import type { DB3Authorization } from "../db3Authorization";
import type { DB3ReferenceProvider } from "./db3Hydration";
import type { AnyDB3Entity, PrismaDelegateOf } from "./db3Entity";

type ArrayItem<T> = T extends readonly (infer TItem)[] ? TItem : never;

export interface DB3ViewSelectionContext {
    readonly filter: CMDBTableFilterModel;
    readonly authorization: DB3Authorization;
}

export type DB3ViewSelectionArgs<TEntity extends AnyDB3Entity> = Partial<Pick<
    Prisma.Args<PrismaDelegateOf<TEntity>, "findMany">,
    "select" | "include"
>>;

export type DerivedDB3ViewSelection<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
> = ZodPrismaSelection<TDtoSchema> & DB3ViewSelectionArgs<TEntity>;

export interface DB3View<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
> {
    // viewID is needed similar to tableID - the server does its own lookup and
    // verification
    readonly viewID: string;
    readonly entity: TEntity;
    readonly tableID: string;
    readonly tableName: string;
    readonly dtoSchema: TDtoSchema;
    readonly getSelectionArgs: (context: DB3ViewSelectionContext) => TSelection;
    readonly hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;

    parseDto(value: unknown): z.infer<TDtoSchema>;
}

export type AnyDB3View = DB3View<AnyDB3Entity, any, z.ZodTypeAny, TAnyModel>;

export type EntityOf<TView extends AnyDB3View> = TView["entity"];

export type DbPayloadOf<TView extends AnyDB3View> = ArrayItem<Prisma.Result<
    PrismaDelegateOf<EntityOf<TView>>,
    ReturnType<TView["getSelectionArgs"]>,
    "findMany"
>>;

export type DtoOf<TView extends AnyDB3View> = z.infer<TView["dtoSchema"]>;

export type ClientOf<TView extends AnyDB3View> = ReturnType<TView["hydrate"]>;

const views = new Map<string, AnyDB3View>();

interface DefineViewBaseArgs<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
> {
    viewID: string;
    entity: TEntity;
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
}

type DB3ViewSelectionInput<
    TSelection,
> = TSelection | ((context: DB3ViewSelectionContext) => TSelection);

// overload with no selection specified (will be deduced from the DTO schema)
export function defineView<
    TEntity extends AnyDB3Entity,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient> & {
    selection?: undefined;
}): DB3View<
    TEntity,
    DerivedDB3ViewSelection<TEntity, TDtoSchema>,
    TDtoSchema,
    TClient
>;

// overload with a selection specified explicitly and concretely.
export function defineView<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient> & {
    selection: DB3ViewSelectionInput<TSelection>;
}): DB3View<TEntity, TSelection, TDtoSchema, TClient>;

// implementation handling both overloads
export function defineView<
    TEntity extends AnyDB3Entity,
    TSelection extends DB3ViewSelectionArgs<TEntity>,
    TDtoSchema extends z.AnyZodObject,
    TClient extends TAnyModel,
>(args: DefineViewBaseArgs<TEntity, TDtoSchema, TClient> & {
    selection?: DB3ViewSelectionInput<TSelection>;
}): DB3View<TEntity, TSelection, TDtoSchema, TClient> {
    const derivedSelection = args.selection === undefined
        ? ZodToPrismaSelection(args.dtoSchema)
        : undefined;
    const view: DB3View<TEntity, TSelection, TDtoSchema, TClient> = {
        viewID: args.viewID,
        entity: args.entity,
        tableID: args.entity.schema.tableID,
        tableName: args.entity.schema.tableName,
        dtoSchema: args.dtoSchema,
        getSelectionArgs: args.selection === undefined
            ? () => derivedSelection as TSelection
            : typeof args.selection === "function"
                ? args.selection as (context: DB3ViewSelectionContext) => TSelection
                : () => args.selection as TSelection,
        hydrate: args.hydrate,
        parseDto: value => args.dtoSchema.parse(value),
    };

    const existing = views.get(view.viewID);
    if (existing && existing.entity.entityID !== view.entity.entityID) {
        throw new Error(
            `DB3 view '${view.viewID}' is already registered for ${existing.entity.entityID}.`,
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
    dto: DtoOf<TView>,
    references: DB3ReferenceProvider,
): ClientOf<TView> {
    return view.hydrate(dto, references) as ClientOf<TView>;
}
