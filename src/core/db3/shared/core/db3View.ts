import type { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import type { z } from "zod";
import type { CMDBTableFilterModel } from "../apiTypes";
import type { DB3Authorization } from "../db3Authorization";
import type { DB3ReferenceProvider } from "./db3Hydration";
import type { AnyDB3Entity, EntityIdOf, PrismaDelegateOf } from "./db3Entity";

type ArrayItem<T> = T extends readonly (infer TItem)[] ? TItem : never;

export interface DB3ViewSelectionContext {
    readonly filter: CMDBTableFilterModel;
    readonly authorization: DB3Authorization;
}

export interface DB3View<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
> {
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

export function defineView<
    TEntity extends AnyDB3Entity,
    TSelection,
    TDtoSchema extends z.ZodTypeAny,
    TClient extends TAnyModel,
>(args: {
    viewID: string;
    entity: TEntity;
    selection: TSelection | ((context: DB3ViewSelectionContext) => TSelection);
    dtoSchema: TDtoSchema;
    hydrate: (dto: z.infer<TDtoSchema>, references: DB3ReferenceProvider) => TClient;
}): DB3View<TEntity, TSelection, TDtoSchema, TClient> {
    const view: DB3View<TEntity, TSelection, TDtoSchema, TClient> = {
        viewID: args.viewID,
        entity: args.entity,
        tableID: args.entity.schema.tableID,
        tableName: args.entity.schema.tableName,
        dtoSchema: args.dtoSchema,
        getSelectionArgs: typeof args.selection === "function"
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
