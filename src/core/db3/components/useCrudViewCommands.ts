'use client';

import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import type { TAnyModel } from "@/shared/rootroot";
import type { AnyDB3CrudView, ClientOf, EntityIdOf, EntityOf } from "../db3";
import { createEntityCrudUpdatePatch } from "../db3";
import type { xTableRenderClient } from "./DB3ClientCore";
import { useDB3Command } from "./useDB3Command";

export interface CrudViewCommandClient<
    TView extends AnyDB3CrudView = AnyDB3CrudView,
    TRow extends TAnyModel = ClientOf<TView>,
> {
    create(row: Partial<TRow>): Promise<unknown>;
    update(row: TRow, previousRow: TRow): Promise<unknown>;
    delete(identity: EntityIdOf<EntityOf<TView>>): Promise<unknown>;
}

/**
 * Invokes a CRUD view's generated commands while retaining a TableClient only
 * for its established editor-value preparation and query refresh behavior.
 * The client's query view may be richer than the CRUD view's strict write DTO.
 */
export function useCrudViewCommands<
    TView extends AnyDB3CrudView,
    TTableClient extends xTableRenderClient<any, any>,
>(args: {
    readonly view: TView;
    readonly tableClient: TTableClient;
}): CrudViewCommandClient<
    TView,
    TTableClient extends xTableRenderClient<TView, any> ? ClientOf<TView> : TAnyModel
> {
    // Legacy read schemas can select a richer shape under a distinct tableID
    // (for example xEventArgs_Verbose) while still describing the same
    // persistence table and editor-value conversion contract.
    if (args.tableClient.schema.tableName !== args.view.entity.schema.tableName) {
        throw new Error(
            `DB3 CRUD view '${args.view.viewID}' does not belong to table '${args.tableClient.schema.tableName}'.`,
        );
    }

    const dashboardContext = useDashboardContext();
    const create = useDB3Command(args.view.crud.operations.create?.command);
    const update = useDB3Command(args.view.crud.operations.update.command);
    const deleteCommand = useDB3Command(args.view.crud.operations.delete?.command);

    const refresh = async () => {
        await args.tableClient.refetch();
        dashboardContext.refreshCachedData();
    };

    return {
        create: async row => {
            if (!create) {
                throw new Error(`DB3 editor view '${args.view.viewID}' does not permit creation.`);
            }
            const values = args.tableClient.prepareInsertMutation(row);
            const result = await create.invoke(values);
            await refresh();
            return result;
        },
        update: async (row, previousRow) => {
            const identity = args.view.entity.getIdentity(row);
            const previousValues = args.tableClient.prepareMutation(previousRow, "update");
            const nextValues = args.tableClient.prepareMutation(row, "update");
            const patch = createEntityCrudUpdatePatch(previousValues, nextValues);
            const result = await update.invoke({ identity, patch });
            await refresh();
            return result;
        },
        delete: async identity => {
            if (!deleteCommand) {
                throw new Error(`DB3 editor view '${args.view.viewID}' does not permit deletion.`);
            }
            const result = await deleteCommand.invoke({ identity });
            await refresh();
            return result;
        },
    };
}

/**
 * Migration adapter for editors whose local enriched row is intentionally not
 * the client model declared by their CRUD view.
 */
export function useLegacyCrudViewCommands<TView extends AnyDB3CrudView>(args: {
    readonly view: TView;
    readonly tableClient: xTableRenderClient<any, any>;
}): CrudViewCommandClient<TView, TAnyModel> {
    const commands = useCrudViewCommands(args);
    // The legacy contract deliberately erases only the editor-row parameter;
    // command identity and runtime preparation still come from the typed view.
    return commands as CrudViewCommandClient<TView, TAnyModel>;
}
