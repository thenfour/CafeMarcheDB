'use client';

import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import type { CMDBTableFilterModel } from "../shared/apiTypes";
import type { GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import type { AnyDB3CrudView, ClientOf } from "../db3";
import {
    bindLegacyTableClientSpecToView,
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
): xTableRenderClient<TView> {
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
    const tableSpec = args.tableSpec.args.view
        // The union's view-bearing arm was checked against args.view above;
        // TypeScript cannot narrow an invariant generic from that property.
        ? args.tableSpec as xTableClientSpec<TView>
        : bindLegacyTableClientSpecToView({
            view: args.view,
            // Only the migration arm can lack a runtime view.
            tableSpec: args.tableSpec as xTableClientSpec<undefined>,
        });
    const tableClient = useTableRenderContext({
        requestedCaps: args.paginated
            ? xTableClientCaps.PaginatedQuery
            : xTableClientCaps.Query,
        tableSpec,
        referenceProvider: dashboardContext.referenceStore,
        filterModel: args.filterModel,
        sortModel: args.sortModel,
        paginationModel: args.paginationModel,
        includeDeleted: args.includeDeleted,
        queryOptions: args.queryOptions,
    });
    const commands = useCrudViewCommands({ view: args.view, tableClient });

    tableClient.doInsertMutation = row => {
        // For TView constrained to AnyDB3CrudView, TableClientRowOf is exactly
        // ClientOf<TView>; TypeScript does not reduce that conditional inside
        // a generic function body.
        return commands.create(row as Partial<ClientOf<TView>>);
    };
    tableClient.doUpdateMutation = async (row, previousRow) => {
        if (!previousRow) {
            throw new Error(
                `Command-backed updates for '${args.view.viewID}' require the previous row.`,
            );
        }
        // The same conditional-type limitation applies to both hydrated rows.
        return commands.update(
            row as ClientOf<TView>,
            previousRow as ClientOf<TView>,
        );
    };
    tableClient.doDeleteMutation = commands.delete;

    return tableClient;
}
