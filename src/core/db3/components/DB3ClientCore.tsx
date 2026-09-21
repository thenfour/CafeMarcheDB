'use client';

import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";

// so originally this started as a general API (hence the "capabilities" bitfield). but it's really just geared towards datagrids.
// for a more conventional "client side API" look at clientAPI.tsx et al.

// xTable is server-side code; for client-side things we enrich it here.
// so all UI stuff, react stuff, any behavioral stuff on the client should be here.
//
// the server code is basically a re-statement of the schema with other db/permissions code.
//
// this is for rendering in various places on the site front-end. a datagrid will require pretty much
// a mirroring of the schema for example, but with client rendering descriptions instead of db schema.

import { type RestPaginatedResult, type RestQueryResult, useMutation, usePaginatedQuery, useQuery } from "@blitzjs/rpc";
import React from "react";
//import * as db3 from "../db3";
import type { GridColDef, GridPaginationModel, GridSortModel } from "@mui/x-data-grid";
import { assert } from "blitz";
import { Coalesce, HasFlag, gQueryOptions } from "shared/utils";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { GenerateDefaultDescriptionSettingName, SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as db3 from "../db3";
import db3mutations from "../mutations/db3mutations";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import db3queries from "../queries/db3queries";
import type { CMDBTableFilterModel } from "../shared/apiTypes";
import type { SettingKey } from "shared/settingKeys";
import { TAnyModel } from "@/shared/rootroot";


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface NewDialogAPI {
    // call like, params.api.setFieldValues({ [this.columnName]: val });
    setFieldValues: (fieldValues: { [key: string]: any }) => void,
};

export interface RenderForNewItemDialogArgs {
    key: any;
    row: TAnyModel; // row
    value: unknown;
    validationResult?: db3.ValidateAndComputeDiffResult;
    api: NewDialogAPI,

    autoFocus: boolean; // should the renderer set focus on mount?
};

export interface RenderViewerArgs<T> {
    key: any;
    row: TAnyModel; // row
    value: T;
    className?: string;
};

export interface IColumnClientArgs<TColumnName extends string = string> {
    // NB: keep IColumnClient in sync with these fields.
    columnName: TColumnName;
    headerName: string;
    editable: boolean;
    visible: boolean;
    width: number;
    isAutoFocusable: boolean;

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: string | null | undefined;
    className: string | undefined;

    GridColProps?: Partial<GridColDef>;
};

export abstract class IColumnClient<
    TColumnName extends string = string,
    TValue = unknown,
    TMutationPatch extends TAnyModel = Partial<Record<TColumnName, TValue>>,
> {
    // IColumnClientArgs here...
    columnName: TColumnName;
    /** Type-only marker consumed by the view-bound table-spec factory. */
    readonly __columnValueType?: TValue;
    /** Type-only marker for the values this UI column contributes to a write. */
    readonly __mutationPatchType?: TMutationPatch;
    headerName: string;
    editable: boolean;
    visible: boolean;
    width: number;

    fieldCaption: string | undefined;
    fieldDescriptionSettingName: SettingKey | null | undefined;
    className: string | undefined;

    isAutoFocusable: boolean;

    GridColProps?: Partial<GridColDef>;

    abstract renderForNewDialog?: (params: RenderForNewItemDialogArgs) => React.ReactNode; // will render as a child of <FormControl>
    abstract renderViewer: (params: RenderViewerArgs<unknown>) => React.ReactNode; // will render as a child of <FormControl>

    // new better-typed replacement for ApplyClientToPostClient
    // allows a column to define how its value should be projected into a
    // mutation patch (e.g. date range columns work on multiple members)
    projectMutation?: (clientRow: TAnyModel, mode: db3.DB3RowMode) => TMutationPatch;

    /** @deprecated Migration-only mutable projection. New columns use projectMutation(). */
    abstract ApplyClientToPostClient?: (clientRow: TAnyModel, updateModel: TAnyModel, mode: db3.DB3RowMode) => void;
    abstract onSchemaConnected(tableClient: xTableRenderClient<any, any>): void;

    schemaTable: db3.xTable;
    schemaColumn: db3.AnyDB3Field;

    constructor(args: IColumnClientArgs<TColumnName>) {
        Object.assign(this, args);
        // safety.
        assert(this.visible !== undefined, "visible is required; maybe a column client type forgot to include this in the ctor?");
        this.visible = Coalesce(this.visible, true);
    }

    // called when the table client is initialized to make sure this column object knows about its sibling column in the schema.
    connectColumn = (schemaTable: db3.xTable, tableClient: xTableRenderClient<any, any>) => {
        console.assert(this.columnName.length > 0);
        this.schemaTable = schemaTable;
        this.schemaColumn = schemaTable.columns.find(c => c.member === this.columnName)!;
        if (!this.schemaColumn) {
            console.error(`column '${schemaTable.tableName}'.'${this.columnName}' doesn't have a corresponding field in the core schema.`);
        }
        this.onSchemaConnected && this.onSchemaConnected(tableClient);
    };

    // child classes call this when you want default rendering.
    defaultRenderer = ({ value, className, isReadOnly, validationResult }: { value: React.ReactNode, className?: string, isReadOnly: boolean, validationResult: undefined | db3.ValidateAndComputeDiffResult }) => {
        const defaultDescriptionSettingName = GenerateDefaultDescriptionSettingName(this.schemaTable.tableName, this.columnName);
        return <NameValuePair
            key={this.columnName} // not 100% accurate but probably 99.99%
            name={this.fieldCaption || this.columnName}
            description={<SettingMarkdown setting={this.fieldDescriptionSettingName || defaultDescriptionSettingName} />}
            value={value}
            fieldName={this.columnName}
            isReadOnly={isReadOnly}
            className={`${className} ${this.className || ""}`}
            validationResult={validationResult}
        />;
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// the class that describes front-end behavior of a model. i.e. a restatement of the db schema, but describing how it translates to GUI.
// this is the client-side analog to xTable.

/** Legacy table-only specification; new specs use defineTableClientSpec(). */
export interface xTableClientSpecArgs {
    table: db3.xTable;
    columns: AnyIColumnClient[];
};

type NormalizedTableClientSpecArgs<TView extends db3.AnyDB3View | undefined> = {
    table: db3.xTable;
    view?: TView;
    columns: AnyIColumnClient[];
    legacyMutationProjection: boolean;
};

export class xTableClientSpec<
    TView extends db3.AnyDB3View | undefined = undefined,
> {
    args: NormalizedTableClientSpecArgs<TView>;

    /**
     * Migration-only table construction. It intentionally carries no view
     * type, so it cannot participate in new column/result inference.
     * @deprecated Use defineTableClientSpec(), defineLegacyTableClientSpec(),
     * or defineLegacyDynamicTableClientSpec() so the intended contract is explicit.
     */
    constructor(args: xTableClientSpecArgs) {
        this.args = {
            ...args,
            legacyMutationProjection: true,
        };
    };

    /** @internal Use defineTableClientSpec() for the typed public entry point. */
    static fromView<TView extends db3.AnyDB3View>(args: {
        view: TView;
        columns: AnyIColumnClient[];
        legacyMutationProjection?: boolean;
    }): xTableClientSpec<TView> {
        const spec = new xTableClientSpec({
            table: args.view.entity.schema,
            columns: args.columns,
        });
        // The legacy constructor deliberately produces the `undefined` view
        // specialization. This assignment upgrades that same argument bag
        // only after storing the concrete view that owns its schema.
        (spec.args as unknown as NormalizedTableClientSpecArgs<TView>).view = args.view;
        spec.args.legacyMutationProjection = args.legacyMutationProjection ?? false;

        // This cast changes only the phantom view parameter. The runtime view
        // stored above is the same concrete value that supplied the table.
        return spec as unknown as xTableClientSpec<TView>;
    }

    getColumn = (name: string): AnyIColumnClient => this.args.columns.find(c => c.columnName === name)!;

    renderViewer = <T extends TAnyModel,>(columnName: string, row: T) => {
        return this.getColumn(columnName).renderViewer({
            row,
            key: columnName,
            value: row[columnName]
        });
    }

    renderEditor = <T extends TAnyModel,>(columnName: string, row: T, validationResult: db3.ValidateAndComputeDiffResult, onChange: (row: T) => void, autoFocus: boolean) => {
        const col = this.getColumn(columnName);

        return col.renderForNewDialog && col.renderForNewDialog({
            validationResult,
            autoFocus,
            api: {
                setFieldValues: (fieldValues: { [key: string]: any }) => {
                    const newValue = { ...row, ...fieldValues };
                    onChange(newValue);
                },
            },
            row,
            key: columnName,
            value: row[columnName],

        });
    }

};

type ColumnValueOf<TColumn> =
    TColumn extends IColumnClient<any, infer TValue> ? TValue : never;

export type DB3ClientColumnFactory<TColumn extends AnyIColumnClient = AnyIColumnClient> =
    (columnName: string) => TColumn;

export type DB3ClientColumnFactoryMap = Readonly<Record<string, DB3ClientColumnFactory>>;

type RebindClientColumnName<TColumn, TColumnName extends string> =
    TColumn extends IColumnClient<any, infer TValue>
    ? TColumn & IColumnClient<TColumnName, TValue>
    : never;

export type DB3ClientColumnSet<TFactories extends DB3ClientColumnFactoryMap> = {
    readonly [K in keyof TFactories]: K extends string
    ? RebindClientColumnName<ReturnType<TFactories[K]>, K>
    : never;
};

export type DB3ClientColumnSelection<TColumns extends readonly AnyIColumnClient[]> = {
    readonly [TColumn in TColumns[number]as TColumn["columnName"]]: () => TColumn;
};

type ColumnValueOfFactory<TFactory> =
    TFactory extends DB3ClientColumnFactory<infer TColumn>
    ? ColumnValueOf<TColumn>
    : never;

type InvalidViewColumnFactoryKeys<TRow, TFactories extends DB3ClientColumnFactoryMap> = {
    [K in keyof TFactories]: K extends keyof TRow
    ? Exclude<TRow[K], undefined> extends ColumnValueOfFactory<TFactories[K]>
    ? never
    : K
    : K;
}[keyof TFactories];

function instantiateClientColumnSet(factories: DB3ClientColumnFactoryMap): Record<string, AnyIColumnClient> {
    const columns: Record<string, AnyIColumnClient> = {};
    Object.keys(factories).forEach(columnName => {
        const column = factories[columnName]!(columnName);
        if (column.columnName !== columnName) {
            throw new Error(
                `DB3 client-column factory '${columnName}' produced runtime column '${column.columnName}'.`,
            );
        }
        columns[columnName] = column;
    });
    return columns;
}

/**
 * Constructs a reusable set of client columns whose object keys are the sole
 * source of their runtime column names.
 */
export function makeClientColumnSet<
    TFactories extends { [K in keyof TFactories]: DB3ClientColumnFactory },
>(factories: TFactories): DB3ClientColumnSet<TFactories> {
    const columns = instantiateClientColumnSet(factories);
    // Each factory was invoked with its object key and the runtime check above
    // proved that every resulting column retained that exact key.
    return columns as DB3ClientColumnSet<TFactories>;
}

/**
 * Adapts already-constructed named columns for a table spec without requiring
 * callers to repeat those names as object keys.
 */
export function makeClientColumnSelection<TColumns extends readonly AnyIColumnClient[]>(
    ...columns: TColumns
): DB3ClientColumnSelection<TColumns> {
    const selection: Record<string, DB3ClientColumnFactory> = {};
    columns.forEach(column => {
        if (selection[column.columnName]) {
            throw new Error(`Duplicate DB3 client column '${column.columnName}' in selection.`);
        }
        selection[column.columnName] = () => column;
    });

    // The map is populated only from each column's own typed runtime name, and
    // the duplicate check proves that every selected name has exactly one value.
    return selection as DB3ClientColumnSelection<TColumns>;
}

function instantiateClientColumns(factories: DB3ClientColumnFactoryMap): AnyIColumnClient[] {
    return Object.values(instantiateClientColumnSet(factories));
}

/**
 * New view-bound table specification. Its column tuple is checked against the
 * hydrated client row inferred from the concrete view.
 */
export function defineTableClientSpec<
    TView extends db3.AnyDB3View,
    TFactories extends { [K in keyof TFactories]: DB3ClientColumnFactory },
>(args: {
    view: TView;
    columns: TFactories;
} & ([InvalidViewColumnFactoryKeys<db3.ClientOf<TView>, TFactories>] extends [never]
    ? unknown
    : { readonly __invalidColumnKeys: InvalidViewColumnFactoryKeys<db3.ClientOf<TView>, TFactories> })
): xTableClientSpec<TView> {
    return xTableClientSpec.fromView({
        view: args.view,
        columns: instantiateClientColumns(args.columns),
    });
}

type TableFieldKeys<TTable extends db3.xTable> =
    TTable extends db3.xTable<infer TFields>
    ? Extract<keyof TFields, string>
    : string;

type InvalidLegacyColumnFactoryKeys<
    TTable extends db3.xTable,
    TFactories extends DB3ClientColumnFactoryMap,
> = {
    [K in keyof TFactories]: K extends TableFieldKeys<TTable> ? never : K;
}[keyof TFactories];

/**
 * Migration-only keyed construction for table clients that do not yet own a
 * named view. It validates table keys but deliberately provides no hydrated
 * row type; use defineTableClientSpec() whenever a view exists.
 */
export function defineLegacyTableClientSpec<
    TTable extends db3.xTable,
    TFactories extends { [K in keyof TFactories]: DB3ClientColumnFactory },
>(args: {
    table: TTable;
    columns: TFactories;
} & ([InvalidLegacyColumnFactoryKeys<TTable, TFactories>] extends [never]
    ? unknown
    : { readonly __invalidColumnKeys: InvalidLegacyColumnFactoryKeys<TTable, TFactories> })
): xTableClientSpec<undefined> {
    return new xTableClientSpec({
        table: args.table,
        columns: instantiateClientColumns(args.columns),
    });
}

/**
 * Legacy escape hatch for callers whose schema or column names are selected at
 * runtime. Those names cannot be checked as a static keyed column set and this
 * result deliberately carries no hydrated view type.
 */
export function defineLegacyDynamicTableClientSpec(
    args: xTableClientSpecArgs,
): xTableClientSpec<undefined> {
    return new xTableClientSpec(args);
}

/**
 * Explicit migration adapter for an existing table-only spec whose runtime
 * columns are known to edit a concrete view. New code should define the spec
 * with defineTableClientSpec() instead.
 */
export function bindLegacyTableClientSpecToView<TView extends db3.AnyDB3View>(args: {
    readonly view: TView;
    readonly tableSpec: xTableClientSpec<undefined>;
}): xTableClientSpec<TView> {
    if (args.tableSpec.args.table !== args.view.entity.schema) {
        throw new Error(
            `Legacy DB3 table client '${args.tableSpec.args.table.tableID}' cannot be bound to view '${args.view.viewID}'.`,
        );
    }
    return xTableClientSpec.fromView({
        view: args.view,
        columns: args.tableSpec.args.columns,
        legacyMutationProjection: true,
    });
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// xTableRenderClient is an object that React components use to access functionality, access the items in the table etc.

export const CalculateOrderBy = (sortModel?: GridSortModel) => {
    let orderBy: any = undefined;//{id: "asc" }; // default order
    if (sortModel && sortModel.length > 0) {
        orderBy = { [sortModel[0]!.field]: sortModel[0]!.sort }; // only support 1 ordering (grid does too afaik)
    }
    return orderBy;
};

export type TMutateFn = (args: db3.MutatorInput) => Promise<unknown>;

// Query models contain every field the caller may view, which can be a wider
// set than the fields they may edit. Keep those read-only values out of normal
// client mutations; the server remains the authority and still rejects forged
// or unknown fields.
export const omitUnauthorizedMutationFields = (args: {
    schema: db3.xTable;
    model: TAnyModel;
    existingModel: TAnyModel;
    mode: "new" | "update";

    publicData: db3.DB3Authorization;
}): TAnyModel => {
    const authorization = args.schema.authorizeAndSanitize({
        contextDesc: "DB3 client mutation preparation",
        model: args.model,
        existingModel: args.existingModel,
        rowMode: args.mode,
        publicData: args.publicData,
        fallbackOwnerId: null,
    });

    // Do not turn a row-level authorization failure into an apparently valid
    // empty update. Preserve it so the server rejects the request explicitly.
    if (!authorization.rowIsAuthorized) return args.model;

    return {
        ...authorization.authorizedModel,
        // Unknown fields are preserved deliberately so schema drift and forged
        // requests fail closed at the server instead of being silently ignored.
        ...authorization.unknownModel,
    };
};

export enum xTableClientCaps {
    None = 0,
    PaginatedQuery = 1,
    Query = 2,
    /** @deprecated Existing migration inventory only. Use a CRUD view or named command. */
    Mutation = 4,
};

export type AnyIColumnClient = IColumnClient<any, any, any>;

export type TableClientRowOf<
    TView extends db3.AnyDB3View | undefined,
    TLegacyRow extends TAnyModel = TAnyModel,
> = TView extends db3.AnyDB3View ? db3.ClientOf<TView> : TLegacyRow;

export type TableClientIdentityOf<TView extends db3.AnyDB3View | undefined> =
    TView extends db3.AnyDB3View
    ? db3.EntityIdOf<db3.EntityOf<TView>>
    : number | string;

export type PreparedTableMutationOf<TView extends db3.AnyDB3View | undefined> =
    TView extends db3.AnyDB3View
    ? db3.DB3SchemaMutationModel<
        db3.ClientOf<TView>,
        db3.DB3FieldsOf<db3.SchemaOf<db3.EntityOf<TView>>>
    >
    // A table-only client has no view/field-map contract from which to infer a
    // prepared DTO. Its deliberately explicit legacy API retains the old type.
    : any;

export interface xTableClientArgs<TView extends db3.AnyDB3View | undefined = undefined> {
    tableSpec: xTableClientSpec<TView>,
    referenceProvider?: db3.DB3ReferenceProvider,

    requestedCaps: xTableClientCaps,


    // optional for example for new item dialog which doesn't do any querying at all.
    sortModel?: GridSortModel,
    filterModel?: CMDBTableFilterModel,
    paginationModel?: GridPaginationModel,
    includeDeleted?: boolean,

    queryOptions?: any; // of gQueryOptions
};

export class xTableRenderClient<
    TView extends db3.AnyDB3View | undefined = undefined,
    TLegacyRow extends TAnyModel = TAnyModel,
> {
    tableSpec: xTableClientSpec<TView>;
    args: xTableClientArgs<TView>;
    mutateFn: TMutateFn;

    items: TableClientRowOf<TView, TLegacyRow>[];
    rowCount: number;
    remainingQueryResults: any;
    remainingQueryStatus: RestQueryResult<unknown, unknown>;
    remainingPaginatedQueryStatus: RestPaginatedResult<unknown, unknown>;

    // after a query, this gets populated.
    queryResultInfo: {
        executionTimeMillis: number,
        resultId: string,
        //resultPayloadSize: number,
    };

    refetch: () => void;
    publicData: db3.DB3Authorization;

    get schema() {
        return this.tableSpec.args.table;
    }
    get clientColumns() {
        return this.tableSpec.args.columns;
    }

    getColumn(name: string) {
        return this.tableSpec.getColumn(name);
    }

    constructor(args: xTableClientArgs<TView>, publicData: db3.DB3Authorization) {
        this.tableSpec = args.tableSpec;
        this.args = args;
        this.publicData = publicData;

        this.queryResultInfo = {
            executionTimeMillis: 0,
            resultId: "",
            //resultPayloadSize: 0,
        };


        if (HasFlag(args.requestedCaps, xTableClientCaps.Mutation)) {
            this.mutateFn = useMutation(db3mutations)[0] as TMutateFn;
        }

        const orderBy = CalculateOrderBy(args.sortModel);

        const skip = !!args.paginationModel ? (args.paginationModel.pageSize * args.paginationModel.page) : undefined;
        const take = !!args.paginationModel ? (args.paginationModel.pageSize) : undefined;

        for (let i = 0; i < this.clientColumns.length; ++i) {
            this.clientColumns[i]?.connectColumn(args.tableSpec.args.table, this);
        }

        let items_: unknown[] = [];

        const filter: CMDBTableFilterModel = args.filterModel || { items: [] };

        if (HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.Query)); // don't do both. why would you do both types of queries.??
            if (skip === undefined || take === undefined) {
                throw new Error("Paginated DB3 queries require a pagination model.");
            }
            const paginatedQueryInput: db3.PaginatedQueryRequestInput = {
                table: {
                    tableID: this.args.tableSpec.args.table.tableID,
                    tableName: this.args.tableSpec.args.table.tableName,
                    viewID: this.tableSpec.args.view?.viewID,
                },
                orderBy,
                skip,
                take,
                filter,
                includeDeleted: args.includeDeleted,
                cmdbQueryContext: `xTableRenderClient/paginated for ${args.tableSpec.args.table.tableName}`,
            };

            const queryResult = usePaginatedQuery(db3paginatedQueries, paginatedQueryInput, args.queryOptions || gQueryOptions.default);
            //const { items, count } = queryResult[0];
            //items_ = items as TAnyModel[];

            if (!queryResult[0]) {
                items_ = [];
                this.rowCount = 0;
            } else {
                items_ = queryResult[0].items;
                this.rowCount = queryResult[0].count;//queryResult[0].items.length;
                this.remainingQueryResults = { ...queryResult[0] };
                this.queryResultInfo = {
                    executionTimeMillis: queryResult[0].executionTimeMillis,
                    resultId: queryResult[0].resultId,
                    //resultPayloadSize: JSON.stringify(items_).length,
                };
            }

            //this.rowCount = count;
            //this.remainingQueryResults = { ...queryResult[0] };
            this.remainingQueryStatus = { ...queryResult[1] };
            this.refetch = queryResult[1].refetch;
        }

        if (HasFlag(args.requestedCaps, xTableClientCaps.Query)) {
            console.assert(!HasFlag(args.requestedCaps, xTableClientCaps.PaginatedQuery)); // don't do both. why would you do both types of queries.??
            console.assert(skip === 0 || skip === undefined);

            const queryInput: db3.QueryRequestInput = {
                table: {
                    tableID: this.args.tableSpec.args.table.tableID,
                    tableName: this.args.tableSpec.args.table.tableName,
                    viewID: this.tableSpec.args.view?.viewID,
                },
                orderBy,
                take,
                filter,
                includeDeleted: args.includeDeleted,
                cmdbQueryContext: `xTableRenderClient/query for ${args.tableSpec.args.table.tableName}`,
            };

            const queryResult = useQuery(db3queries, queryInput, args.queryOptions || gQueryOptions.default);

            // results may be undefined.
            if (!queryResult[0]) {
                items_ = [];
                this.rowCount = 0;
            } else {
                items_ = queryResult[0].items;
                this.rowCount = queryResult[0].items.length;
                this.remainingQueryResults = { ...queryResult[0] };
            }
            this.remainingQueryStatus = { ...queryResult[1] };
            this.queryResultInfo = {
                executionTimeMillis: queryResult[0].executionTimeMillis,
                resultId: queryResult[0].resultId,
                //resultPayloadSize: JSON.stringify(items_).length,
            }
            this.refetch = queryResult[1].refetch;
        }

        // convert items from a database result to a client-side object.
        this.items = items_.map(dbitem => {
            const view = this.tableSpec.args.view;
            if (view) {
                if (!this.args.referenceProvider) {
                    throw new Error(`DB3 view '${view.viewID}' requires a reference provider.`);
                }
                const hydrated = db3.hydrateView(
                    view,
                    view.parseDto(dbitem),
                    this.args.referenceProvider,
                );
                // TView determines both hydrate() and TableClientRowOf. The
                // conditional row alias cannot be narrowed by this runtime
                // presence check, so expose that already-proven relationship.
                return hydrated as TableClientRowOf<TView, TLegacyRow>;
            }
            // This is the explicitly legacy table-only path. Its row type is a
            // caller declaration because no view exists to infer one from.
            return this.schema.getClientModel(dbitem as TAnyModel, "view") as TableClientRowOf<TView, TLegacyRow>;
        });

        this.refetch = this.refetch || (() => { });

        // if (process.env.NODE_ENV === "development") {
        //     React.useEffect(() => {
        //         console.log(`db3 query executed on '${this.tableSpec.args.table.tableID}': ${this.queryResultInfo.executionTimeMillis} ms; resultpayload=${formatFileSize(this.queryResultInfo.resultPayloadSize)}`);
        //         console.log(this.items);
        //     }, [this.queryResultInfo.resultId]);
        // }
    }; // ctor

    prepareMutation = (
        row: Partial<TableClientRowOf<TView, TLegacyRow>>,
        mode: "new" | "update",
    ): PreparedTableMutationOf<TView> => {
        const postClientModel = {}; // when applying values, it's client-value -> post-client-value -> db-value. there are 2 stages, to allow client columns to work AND the schema column.
        const dbModel = {};

        this.clientColumns.forEach(clientCol => {
            if (clientCol.projectMutation) {
                Object.assign(postClientModel, clientCol.projectMutation(row, mode));
            } else if (clientCol.ApplyClientToPostClient) {
                if (!this.tableSpec.args.legacyMutationProjection) {
                    throw new Error(
                        `Typed DB3 client column '${clientCol.columnName}' must use projectMutation(); `
                        + "ApplyClientToPostClient is available only through an explicit legacy table spec.",
                    );
                }
                // Explicit legacy adapter: older foreign/composite columns
                // mutate an accumulator instead of returning a typed patch.
                clientCol.ApplyClientToPostClient(row, postClientModel, mode);
            } else {
                postClientModel[clientCol.columnName] = row[clientCol.columnName]; // by default just copy the value.
            }
        });

        this.schema.columns.forEach(schemaCol => {
            schemaCol.ApplyClientToDb(postClientModel, dbModel, mode);
        });

        const ret = omitUnauthorizedMutationFields({
            schema: this.schema,
            model: dbModel,
            existingModel: row,
            mode,
            publicData: this.publicData,
        });

        // The typed xTable field map defines the same-key encoded result. The
        // runtime authorization pass may only remove keys from that model.
        return ret as PreparedTableMutationOf<TView>;
    };

    // the row as returned by the db is not the same model as the one to be passed in for updates / creation / etc.
    // all the columns in our spec though represent logical values which can be passed into mutations.
    // that is, all the columns comprise the updation model completely.
    // for things like FK, 
    doUpdateMutation = async (
        row: TableClientRowOf<TView, TLegacyRow>,
        _previousRow?: TableClientRowOf<TView, TLegacyRow>,
    ) => {
        console.assert(!!this.mutateFn); // make sure you request this capability!

        const dbModel = this.prepareMutation(row, "update");

        const identity = row[this.schema.clientIdMember];

        // sanity. this is not a perfect check: in theory, non-string publicids could exist.
        if (this.schema.publicIdMember && typeof identity !== "string") {
            throw new Error(`Expected public ID for ${this.schema.tableName}`);
        }
        // also not perfect: in theory, non-numeric natural ids could also exist.
        if (!this.schema.publicIdMember && typeof identity !== "number") {
            throw new Error(`Expected natural ID for ${this.schema.tableName}`);
        }
        const ret = await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            mutationType: "update",
            ...(this.schema.publicIdMember
                ? { updatePublicId: identity }
                : { updateId: identity }),
            updateModel: dbModel,
        });
        this.refetch();
        return ret;
    };

    prepareInsertMutation = (
        row: Partial<TableClientRowOf<TView, TLegacyRow>>,
    ): PreparedTableMutationOf<TView> => {
        const dbModel = this.prepareMutation(row, "new");
        return dbModel;
    };

    doInsertMutation = async (row: Partial<TableClientRowOf<TView, TLegacyRow>>) => {
        const dbModel = this.prepareInsertMutation(row);
        return await this.mutateFn({
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            mutationType: "insert",
            insertModel: dbModel,
        });
    };

    doDeleteMutation = async (
        identity: TableClientIdentityOf<TView>,
        deleteType: "softWhenPossible" | "hard",
    ) => {
        const common = {
            tableID: this.args.tableSpec.args.table.tableID,
            tableName: this.tableSpec.args.table.tableName,
            mutationType: "delete" as const,
            deleteType,
        };
        if (this.schema.publicIdMember) {
            // sanity, but this is not 100% accurate. in theory, non-string publicids could exist.
            if (typeof identity !== "string") {
                throw new Error(`Expected public ID for ${this.schema.tableName}`);
            }
            return await this.mutateFn({ ...common, deletePublicId: identity });
        }
        // sanity; not accurate: in theory, non-numeric natural ids could exist.
        if (typeof identity !== "number") {
            throw new Error(`Expected natural ID for ${this.schema.tableName}`);
        }
        return await this.mutateFn({ ...common, deleteId: identity });
    };

};


export const useTableRenderContext = <TView extends db3.AnyDB3View,>(
    args: xTableClientArgs<TView>,
): xTableRenderClient<TView> => {
    const publicData = useDB3Authorization();
    return new xTableRenderClient(args, publicData);
};

export type xLegacyTableRenderClient<TRow extends TAnyModel = TAnyModel> =
    xTableRenderClient<undefined, TRow>;

/** Table-only migration path; it cannot infer a hydrated row without a view. */
export const useLegacyTableRenderContext = <TRow extends TAnyModel = TAnyModel,>(
    args: xTableClientArgs<undefined>,
): xLegacyTableRenderClient<TRow> => {
    const publicData = useDB3Authorization();
    return new xTableRenderClient<undefined, TRow>(args, publicData);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface FetchAsyncArgs<T> {
    schema: db3.xTable;
    view?: db3.AnyDB3View;
    referenceProvider?: db3.DB3ReferenceProvider;

    sortModel?: GridSortModel,
    filterModel?: CMDBTableFilterModel,
    take?: number | undefined;
    queryOptions?: any; // of gQueryOptions
    delayMS?: number;
    includeDeleted?: boolean;
};

export interface FetchAsyncResult<T> {
    items: T[];
    isLoading: boolean;
    refetch: () => void;
    queryResult: undefined | RestQueryResult<any, any>;
};

// allows fetching without suspense interaction
export function fetchUnsuspended<T>(args: FetchAsyncArgs<T>): FetchAsyncResult<T> {
    if (args.view && args.view.entity.schema !== args.schema) {
        throw new Error(
            `DB3 view '${args.view.viewID}' does not belong to table '${args.schema.tableID}'.`,
        );
    }
    const queryInput: db3.QueryRequestInput = {
        table: {
            tableID: args.schema.tableID,
            tableName: args.schema.tableName,
            viewID: args.view?.viewID,
        },
        orderBy: CalculateOrderBy(args.sortModel),
        take: args.take,
        filter: args.filterModel || { items: [] },
        includeDeleted: args.includeDeleted,
        delayMS: args.delayMS,
        cmdbQueryContext: `fetchAsync for ${args.schema.tableName} / ${args.schema.tableID}`,
    };

    const [queryRet, blitzQueryStatus] = useQuery(db3queries, queryInput, {
        ...(args.queryOptions || gQueryOptions.default),
        suspense: false,
        useErrorBoundary: false,
    });

    let dbItems: TAnyModel[] = [];
    let rowCount = 0;

    if (queryRet) {
        dbItems = queryRet.items;
        rowCount = queryRet.items.length;
    }

    // convert items from a database result to a client-side object.
    const clientItems: T[] = dbItems.map(dbitem => {
        if (args.view) {
            if (!args.referenceProvider) {
                throw new Error(`DB3 view '${args.view.viewID}' requires a reference provider.`);
            }
            return db3.hydrateView(
                args.view,
                args.view.parseDto(dbitem),
                args.referenceProvider,
            ) as T;
        }
        return args.schema.getClientModel(dbitem, "view") as T;
    });

    return {
        items: clientItems,
        isLoading: blitzQueryStatus.isLoading,
        refetch: blitzQueryStatus.refetch || (() => { }),
        queryResult: blitzQueryStatus,
    };
}; // ctor



// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

