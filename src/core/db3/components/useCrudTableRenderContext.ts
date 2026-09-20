'use client';

import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import type { CMDBTableFilterModel } from "../shared/apiTypes";
import type { GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import type { AnyDB3CrudView, ClientOf } from "../db3";
import { createEntityCrudUpdatePatch, hasGeneratedDeleteCommand } from "../db3";
import {
    useTableRenderContext,
    type xTableClientSpec,
    xTableClientCaps,
    type xTableRenderClient,
} from "./DB3ClientCore";
import { useDB3Command } from "./useDB3Command";

export interface UseCrudTableRenderContextArgs<TView extends AnyDB3CrudView> {
    readonly view: TView;
    readonly tableSpec: xTableClientSpec;
    readonly filterModel?: CMDBTableFilterModel;
    readonly sortModel?: GridSortModel;
    readonly paginationModel?: GridPaginationModel;
    readonly includeDeleted?: boolean;
    readonly queryOptions?: any;
    readonly paginated?: boolean;
}

/**
 * Command-backed TableClient facade for conventional row editors. Reads use
 * the named view; writes retain the existing client-column preparation and
 * invoke the CRUD commands carried by that view.
 */
export function useCrudTableRenderContext<TView extends AnyDB3CrudView>(
    args: UseCrudTableRenderContextArgs<TView>,
): xTableRenderClient<ClientOf<TView>> {
    if (args.tableSpec.args.table !== args.view.entity.schema) {
        throw new Error(
            `DB3 CRUD view '${args.view.viewID}' does not belong to table '${args.tableSpec.args.table.tableID}'.`,
        );
    }

    const dashboardContext = useDashboardContext();
    const create = useDB3Command(args.view.crud.createCommand);
    const update = useDB3Command(args.view.crud.updateCommand);
    const deleteCommand = useDB3Command(
        hasGeneratedDeleteCommand(args.view.crud)
            ? args.view.crud.deleteCommand
            : undefined,
    );
    const tableClient = useTableRenderContext<ClientOf<TView>>({
        requestedCaps: args.paginated
            ? xTableClientCaps.PaginatedQuery
            : xTableClientCaps.Query,
        tableSpec: args.tableSpec,
        queryView: args.view,
        referenceProvider: dashboardContext.referenceStore,
        filterModel: args.filterModel,
        sortModel: args.sortModel,
        paginationModel: args.paginationModel,
        includeDeleted: args.includeDeleted,
        queryOptions: args.queryOptions,
    });

    const refresh = async () => {
        await tableClient.refetch();
        dashboardContext.refreshCachedData();
    };

    tableClient.doInsertMutation = async row => {
        const values = tableClient.prepareInsertMutation(row);
        const result = await create.invoke(values);
        await refresh();
        return result;
    };
    tableClient.doUpdateMutation = async (row, previousRow) => {
        if (!previousRow) {
            throw new Error(
                `Command-backed updates for '${args.view.viewID}' require the previous row.`,
            );
        }
        const identity = args.view.getIdentity(row);
        const previousValues = tableClient.prepareMutation(previousRow, "update");
        const nextValues = tableClient.prepareMutation(row, "update");
        const patch = createEntityCrudUpdatePatch(previousValues, nextValues);
        const result = await update.invoke({ identity, patch });
        await refresh();
        return result;
    };
    tableClient.doDeleteMutation = async identity => {
        if (!deleteCommand) {
            throw new Error(`DB3 editor view '${args.view.viewID}' does not permit deletion.`);
        }
        const result = await deleteCommand.invoke({ identity });
        await refresh();
        return result;
    };

    return tableClient;
}
