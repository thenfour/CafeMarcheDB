'use client';

import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import type { CMDBTableFilterModel } from "../shared/apiTypes";
import type { GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import type { AnyDB3CrudView, ClientOf } from "../db3";
import {
    useTableRenderContext,
    type xTableClientSpec,
    xTableClientCaps,
    type xTableRenderClient,
} from "./DB3ClientCore";
import { useCrudViewCommands } from "./useCrudViewCommands";

export interface UseCrudTableRenderContextArgs<TView extends AnyDB3CrudView> {
    readonly view: TView;
    /**
     * The first arm is the new view-bound contract. The undefined arm is an
     * explicit migration allowance for table-only specs created by the legacy
     * constructor; it provides no row or column inference.
     */
    readonly tableSpec: xTableClientSpec<TView> | xTableClientSpec<undefined>;
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
    if (args.tableSpec.args.view && args.tableSpec.args.view !== args.view) {
        throw new Error(
            `DB3 table client view '${args.tableSpec.args.view.viewID}' cannot be used with CRUD view '${args.view.viewID}'.`,
        );
    }
    if (args.tableSpec.args.table !== args.view.entity.schema) {
        throw new Error(
            `DB3 CRUD view '${args.view.viewID}' does not belong to table '${args.tableSpec.args.table.tableID}'.`,
        );
    }

    const dashboardContext = useDashboardContext();
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
    const commands = useCrudViewCommands({ view: args.view, tableClient });

    tableClient.doInsertMutation = commands.create;
    tableClient.doUpdateMutation = async (row, previousRow) => {
        if (!previousRow) {
            throw new Error(
                `Command-backed updates for '${args.view.viewID}' require the previous row.`,
            );
        }
        return commands.update(row, previousRow);
    };
    tableClient.doDeleteMutation = commands.delete;

    return tableClient;
}
