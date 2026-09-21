'use client';

import type { TAnyModel } from "@/shared/rootroot";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import type { AnyDB3CrudView } from "../db3";
import { createEntityCrudUpdatePatch } from "../db3";
import type { xTableRenderClient } from "./DB3ClientCore";
import { useDB3Command } from "./useDB3Command";

export interface CrudViewCommandClient {
    create(row: TAnyModel): Promise<unknown>;
    update(row: TAnyModel, previousRow: TAnyModel): Promise<unknown>;
    delete(identity: number | string): Promise<unknown>;
}

/**
 * Invokes a CRUD view's generated commands while retaining a TableClient only
 * for its established editor-value preparation and query refresh behavior.
 * The client's query view may be richer than the CRUD view's strict write DTO.
 */
export function useCrudViewCommands(args: {
    readonly view: AnyDB3CrudView;
    readonly tableClient: xTableRenderClient;
}): CrudViewCommandClient {
    if (args.tableClient.schema !== args.view.entity.schema) {
        throw new Error(
            `DB3 CRUD view '${args.view.viewID}' does not belong to table '${args.tableClient.schema.tableID}'.`,
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
