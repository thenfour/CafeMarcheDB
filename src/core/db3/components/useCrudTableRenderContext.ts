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
import { type CrudViewCommandClient, useCrudViewCommands } from "./useCrudViewCommands";

export interface UseCrudTableRenderContextArgs<TView extends AnyDB3CrudView> {
    readonly view: TView;
    readonly tableSpec: xTableClientSpec<TView>;
    readonly filterModel?: CMDBTableFilterModel;
    readonly sortModel?: GridSortModel;
    readonly paginationModel?: GridPaginationModel;
    readonly includeDeleted?: boolean;
    readonly queryOptions?: any;
    readonly paginated?: boolean;
}

export type CrudTableRenderContext<TView extends AnyDB3CrudView> =
    xTableRenderClient<TView> & {
        readonly crud: CrudViewCommandClient<TView, ClientOf<TView>>;
    };

/**
 * Command-backed TableClient facade for conventional row editors. Reads use
 * the named view; writes retain the existing client-column preparation and
 * invoke the CRUD commands carried by that view.
 */
export function useCrudTableRenderContext<TView extends AnyDB3CrudView>(
    args: UseCrudTableRenderContextArgs<TView>,
): CrudTableRenderContext<TView> {
    const specView = args.tableSpec.args.view;
    if (specView !== args.view) {
        throw new Error(
            `DB3 table client view '${specView?.viewID ?? "<missing>"}' cannot be used with CRUD view '${args.view.viewID}'.`,
        );
    }
    if (args.tableSpec.args.table !== args.view.entity) {
        throw new Error(
            `DB3 CRUD view '${args.view.viewID}' does not belong to table '${args.tableSpec.args.table.tableID}'.`,
        );
    }

    const dashboardContext = useDashboardContext();
    const tableClient = useTableRenderContext({
        requestedCaps: args.paginated
            ? xTableClientCaps.PaginatedQuery
            : xTableClientCaps.Query,
        tableSpec: args.tableSpec,
        referenceProvider: dashboardContext.referenceStore,
        filterModel: args.filterModel,
        sortModel: args.sortModel,
        paginationModel: args.paginationModel,
        includeDeleted: args.includeDeleted,
        queryOptions: args.queryOptions,
    });
    const commands = useCrudViewCommands({ view: args.view, tableClient });

    return Object.assign(tableClient, { crud: commands });
}
