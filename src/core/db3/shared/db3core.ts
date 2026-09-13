export type { DB3Authorization } from "./db3Authorization";
import { type DB3Authorization } from "./db3Authorization";
import { assert } from "blitz";
import { Prisma } from "db";
import { isEmptyArray } from "shared/arrayUtils";
import { CalculateChanges, type CalculateChangesResult, createEmptyCalculateChangesResult } from "shared/associationUtils";
import { SqlCombineAndExpression, SqlCombineOrExpression } from "shared/mysqlUtils";
import { Permission } from "shared/permissions";
import type { SortDirection, TAnyModel } from "shared/rootroot";
import {
    type CMDBTableFilterModel, type CriterionQueryElements,
    type DiscreteCriterion, type GetSearchResultsSortModel,
    SearchCustomDataHookId,
    type SearchResultsFacetQuery, type SortQueryElements
} from "./apiTypes";
import { GetVisibilityWhereExpression } from "./db3Helpers";
import type { UserWithRolesPayload } from "./schema/userPayloads";
import type { ColorPaletteEntry } from "../../components/color/palette";

export type FieldAssociationWithTable = "tableColumn" | "associationRecord" | "foreignObject" | "calculated";

////////////////////////////////////////////////////////////////
// the mutation needs to be able to access the xtable in order to
// validate etc.
export interface MutatorInputBase {
    tableID: string;
    tableName: string;
};

interface MutatorDelete extends MutatorInputBase {
    mutationType: "delete";
    deleteId: number;
    deleteType: "softWhenPossible" | "hard";
};

interface MutatorInsert extends MutatorInputBase {
    mutationType: "insert";
    insertModel: TAnyModel;
};

interface MutatorUpdate extends MutatorInputBase {
    mutationType: "update";
    updateId: number;
    updateModel: TAnyModel;
};

export type MutatorInput = MutatorDelete | MutatorInsert | MutatorUpdate;

////////////////////////////////////////////////////////////////
export interface QueryInputBase {
    tableID: string;
    tableName: string;
    orderBy: TAnyModel | undefined;
    filter: CMDBTableFilterModel;
    cmdbQueryContext: string;
    // Deleted rows are excluded unless the caller explicitly opts in and the
    // table grants its recovery capability. Visibility is still enforced.
    includeDeleted?: boolean;
    delayMS?: number | undefined; // for testing purposes you may want to add an artificial delay to receiving results
};

////////////////////////////////////////////////////////////////
export interface QueryRequestInput extends QueryInputBase {
    take?: number | undefined;
};


////////////////////////////////////////////////////////////////
export interface PaginatedQueryRequestInput extends QueryInputBase {
    skip: number;
    take: number;
};


////////////////////////////////////////////////////////////////
export interface ValidateAndParseResult<FieldType> {
    //success: boolean;
    result: "success" | "error" | "undefined";
    errorMessage?: string;
    // when success, this is the "parsed" sanitized value. when error, this is the original value. for convenience so in every case this value can be used after the call.
    // therefore it must also support string and null (possibly invalid values)
    values: { [k: string]: (string | FieldType) };
};

export const SuccessfulValidateAndParseResult = <FieldType>(values: { [k: string]: (string | FieldType) }): ValidateAndParseResult<FieldType> => {
    return {
        result: "success",
        values,
    };
};

export const ErrorValidateAndParseResult = <FieldType>(errorMessage: string, values: { [k: string]: (string | FieldType) }): ValidateAndParseResult<FieldType> => {
    return {
        result: "error",
        errorMessage,
        values,
    };
};

export const UndefinedValidateAndParseResult = <FieldType>(): ValidateAndParseResult<FieldType> => {
    return {
        result: "undefined",
        values: {},
    };
};

export interface ValidateAndComputeDiffResultFields {
    success: boolean;
    errors: { [key: string]: string };
    // a complete validated model based on the incoming model. because validation can sanitize values, after validating you should use this
    // **IF** successful.
    successfulModel: TAnyModel;
    changeResult: CalculateChangesResult;
};

export class ValidateAndComputeDiffResult implements ValidateAndComputeDiffResultFields {
    success: boolean = true;
    errors: { [key: string]: string } = {};
    changeResult: CalculateChangesResult;
    successfulModel: TAnyModel;

    constructor(args: Partial<ValidateAndComputeDiffResultFields>) {
        Object.assign(this, args);
    }

    hasErrorForField = (key: string): boolean => {
        const ret = (!this.success && !!this.errors[key]);
        return ret;
    };
    getErrorForField = (key: string): (string | null) => {
        if (this.success) return null;
        return this.errors[key]!;
    };
}

export const SuccessfulValidateAndComputeDiffResult: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
    success: true,
    changeResult: createEmptyCalculateChangesResult(),
});

export const EmptyValidateAndComputeDiffResult = SuccessfulValidateAndComputeDiffResult;


////////////////////////////////////////////////////////////////
export type DB3RowMode = "new" | "view" | "update";

////////////////////////////////////////////////////////////////
export type DB3AuthContextPermissionMap = {
    PostQuery: Permission;
    PostQueryAsOwner: Permission;
    PreInsert: Permission;
    PreMutate: Permission;
    PreMutateAsOwner: Permission;
};

export const createAuthContextMap_Mono = (p: Permission): DB3AuthContextPermissionMap => ({
    PostQuery: p,
    PostQueryAsOwner: p,
    PreInsert: p,
    PreMutate: p,
    PreMutateAsOwner: p,
});

export const createAuthContextMap_DenyAll = (): DB3AuthContextPermissionMap => createAuthContextMap_Mono(Permission.never_grant);
export const createAuthContextMap_GrantAll = (): DB3AuthContextPermissionMap => createAuthContextMap_Mono(Permission.always_grant);
export const createAuthContextMap_PK = (): DB3AuthContextPermissionMap => ({
    // A primary key is safe only after the table/row itself has been authorized.
    // It must not be used as the thing that makes an otherwise-protected row visible.
    PostQuery: Permission.always_grant,
    PostQueryAsOwner: Permission.always_grant,
    PreInsert: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreMutateAsOwner: Permission.never_grant,
});

// adding this because crafting auth maps for all fields takes a lot of work and i want to shortcut the effort
export const createAuthContextMap_TODO = (): DB3AuthContextPermissionMap => createAuthContextMap_Mono(Permission.always_grant);


////////////////////////////////////////////////////////////////
export type DB3AuthTablePermissionMap = {
    View: Permission;
    ViewOwn: Permission;
    Edit: Permission;
    EditOwn: Permission;
    Insert: Permission;
    // TODO: support deletes.
    // for now use edit permissions
    // DeleteOwnHard: Permission;
    // DeleteOwnPreferSoft: Permission;
    // DeleteHard: Permission;
    // DeletePreferSoft: Permission;
};



export type DB3AuthSpec = {
    authMap: DB3AuthContextPermissionMap;
} | {
    _customAuth: (args: DB3AuthorizeAndSanitizeInput<TAnyModel>) => boolean;
};


export type DB3AuthorizationContext = keyof DB3AuthContextPermissionMap;// "PostQuery" | "PostQueryAsOwner" | "PreInsert" | "PreMutate" | "PreMutateAsOwner";

export enum SqlSpecialColumnFunction {
    pk = "pk",
    sortOrder = "sortOrder",
    color = "color",
    iconName = "iconName",
    isDeleted = "isDeleted",
    visiblePermission = "visiblePermission",
    ownerUser = "ownerUser",
    name = "name",
    tooltip = "tooltip",
    description = "description",
    createdByUser = "createdByUser",
    updatedByUser = "updatedByUser",
    createdAt = "createdAt",
    updatedAt = "updatedAt",
};

export type FieldBaseArgs<FieldDataType> = {
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    defaultValue: FieldDataType | null;
    authMap: DB3AuthContextPermissionMap | null;
    specialFunction: SqlSpecialColumnFunction | undefined;
    fkidMember?: string | undefined;
    _customAuth: ((args: DB3AuthorizeAndSanitizeInput<TAnyModel>) => boolean) | null;
    _matchesMemberForAuthorization?: ((memberName: string) => boolean) | null;
}

export interface ValidateAndParseArgs<FieldDataType> {
    //value: FieldDataType | null;
    row: TAnyModel;
    mode: DB3RowMode;

};

export interface DB3AuthorizeAndSanitizeInput<T extends TAnyModel> {
    includeDeleted?: boolean;
    contextDesc: string,
    model: T | null,
    // For updates, field authorization is applied to `model` (the proposed
    // values) while row ownership and table authorization are derived from
    // the persisted row.
    existingModel?: T | null,
    rowMode: DB3RowMode,
    publicData: DB3Authorization,

    fallbackOwnerId: number | null;
};

export type DB3AuthorizeAndSanitizeFieldInput<T extends TAnyModel> = DB3AuthorizeAndSanitizeInput<T> & {
    //rowInfo: RowInfo | null;
    authContext: DB3AuthorizationContext;
    isOwner: boolean;
};


export interface DB3AuthorizeForViewColumnArgs<T extends TAnyModel> {
    model: T | null,
    publicData: DB3Authorization,

    columnName: string;
};


export interface DB3AuthorizeForEditColumnArgs<T extends TAnyModel> {
    model: T | null,
    publicData: DB3Authorization,

    columnName: string;
    fallbackOwnerId: number | null;
};


export interface DB3AuthorizeForRowArgs<T extends TAnyModel> {
    includeDeleted?: boolean;
    model: T | null,
    publicData: DB3Authorization,

};

export interface DB3AuthorizeForBeforeInsertArgs<T extends TAnyModel> {
    //model: T | null,
    publicData: DB3Authorization,

};

export interface DB3AuthorizeAndSanitizeResult<T> {
    authorizedModel: Partial<T>,
    unauthorizedModel: Partial<T>,
    unknownModel: Partial<T>,
    authorizedColumnCount: number, // if 0, the whole row is not authorized.
    unauthorizedColumnCount: number,
    unknownColumnCount: number,
    rowIsAuthorized: boolean, // in theory you could have access to view some fields of a row, but not the row itself or its existence.
};

export interface SqlGetSortableQueryElementsAPI {
    sortModel: GetSearchResultsSortModel;
    primaryTableAlias: string;
    getColumnAlias: () => string; // for getting a unique alias name for select expressions
    getTableAlias: () => string; // for getting a unique table alias for joins
};

export abstract class FieldBase<FieldDataType> {
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    fkidMember?: string | undefined; // if this is a foreign key field, this is the member name of the foreign key column.
    defaultValue: FieldDataType | null;
    specialFunction: SqlSpecialColumnFunction | undefined;

    authMap: DB3AuthContextPermissionMap | null;
    _customAuth: ((args: DB3AuthorizeAndSanitizeFieldInput<TAnyModel>) => boolean) | null;
    _matchesMemberForAuthorization?: ((memberName: string) => boolean) | null; // needed for multi-member columns like foreignsingle

    constructor(args: FieldBaseArgs<FieldDataType>) {
        Object.assign(this, args);
    };

    // field child classes impl this to get established. for example pk fields will set the table's pk here.
    abstract connectToTable: (table: xTable) => void;

    // return either falsy, or a "WhereInput" object like { name: { contains: query } }
    abstract getQuickFilterWhereClause: (query: string) => TAnyModel | boolean;
    abstract getCustomFilterWhereClause: (query: CMDBTableFilterModel) => TAnyModel | boolean;
    abstract getOverallWhereClause: () => TAnyModel | boolean;

    // provide the sql expression for filtering a column on this 1 token. e.g. if the token is "conce", return "(Name like "%conce%")"
    // be sure to sql escape the token.
    // the reason i pass the whole quickFilterTokens in as well is because for example pk fields only want to be searched when it's
    // the only token in the query.
    // return null to not support filtering
    abstract SqlGetQuickFilterElementsForToken: (token: string, quickFilterTokens: string[]) => string | null;

    // return null to not perform filtering on this criterion.
    abstract SqlGetDiscreteCriterionElements: (crit: DiscreteCriterion, tableAlias: string) => CriterionQueryElements | null;

    // return a SQL query
    // return null to not calculate any facet info for this criterion
    abstract SqlGetFacetInfoQuery: (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion) => SearchResultsFacetQuery | null;

    // return a SQL expression for sorting by this value ascending.
    abstract SqlGetSortableQueryElements: (api: SqlGetSortableQueryElementsAPI) => SortQueryElements | null;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    abstract ValidateAndParse: (args: ValidateAndParseArgs<FieldDataType>) => ValidateAndParseResult<FieldDataType | null | undefined>;// => {

    matchesMemberForAuthorization = (memberName: string): boolean => {
        if (this._matchesMemberForAuthorization) {
            return this._matchesMemberForAuthorization(memberName);
        }
        return (memberName.toLowerCase() === this.member.toLowerCase());
    };

    authorize = (args: DB3AuthorizeAndSanitizeFieldInput<TAnyModel>): boolean => {
        if (!!this._customAuth) {
            return this._customAuth(args);
        }
        if (!this.authMap) {
            switch (this.specialFunction) {
                case SqlSpecialColumnFunction.createdAt:
                case SqlSpecialColumnFunction.updatedAt:
                case SqlSpecialColumnFunction.createdByUser:
                case SqlSpecialColumnFunction.updatedByUser:
                    // exempt from any authorization checks.
                    return true;
                default:
                    assert(false, `one of authMap or customAuth are required; field:${this.member}, contextDesc:${args.contextDesc}`);
            }
        }
        const requiredPermission = this.authMap[args.authContext];
        return args.publicData.effectivePermissions.includesName(requiredPermission);
    }

    abstract ApplyToNewRow: (args: TAnyModel, currentUser: UserWithRolesPayload | null) => void;

    // SANITIZED values are passed in. That means no nulls, and ValidateAndParse has already been called.
    abstract isEqual: (a: FieldDataType, b: FieldDataType) => boolean;

    abstract ApplyClientToDb: (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => void;
    abstract ApplyDbToClient: (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode, currentUser?: UserWithRolesPayload | null) => void; // apply the value from db to client.

    // for foreign "includes", we need to apply a WHERE clause which excludes soft deletes, irrelevant things, & records the user doesn't have access to.
    abstract ApplyIncludeFiltering: (include: TAnyModel, publicData: DB3Authorization, includeDeleted: boolean) => void | Promise<void>;
};

export interface SortModel {
    field: string,
    order: SortDirection,
};

export interface RowInfo {
    pk: number;
    name: string;
    tooltip?: string | undefined;
    description?: string | undefined;
    color?: ColorPaletteEntry | null | undefined;
    iconName?: string | null | undefined;

    ownerUserId: number | null; // if the row has an "owner" set this. helps with authorization
};

export type SqlSpecialColumnFunctionMap = {
    [K in SqlSpecialColumnFunction]: FieldBase<unknown> | undefined;
};

export interface CalculateWhereClauseArgs {
    includeDeleted?: boolean;
    filterModel: CMDBTableFilterModel;

    publicData: DB3Authorization;
};

export type DB3QueryParameterKind = "boolean" | "date" | "integer" | "integerArray" | "string" | "stringArray";

export interface DB3QueryParameterSpec {
    kind: DB3QueryParameterKind;
    // The DB3 field(s) whose view permission is required before this parameter
    // may influence a query. Use null only for a parameter that cannot reveal
    // protected row data (for example, a cache-refresh serial).
    authorizeAs: string | readonly string[] | null;
    nullable?: boolean;
    required?: boolean;
};

export type DB3QueryParameterMap = Record<string, DB3QueryParameterSpec>;

export interface TableDesc {
    tableName: string;
    tableUniqueName?: string; // DB tables have multiple variations (event vs. event verbose / permission vs. permission for visibility / et al). therefore tableName is not sufficient. use this instead.
    columns: FieldBase<unknown>[];

    getSelectionArgs: (filterModel: CMDBTableFilterModel) => TAnyModel,
    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    doesItemExactlyMatchText?: (row: TAnyModel, filterText: string) => boolean,
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, publicData: DB3Authorization) => (TAnyModel[] | false); // for overall filtering the query based on parameters.
    queryParameters?: DB3QueryParameterMap; // runtime contract for untrusted generic DB3 requests

    // for things like attendance options, where options can go stale and become "inactive", allow table schemas to filter items out.
    activeAsSelectable?: (params: TAnyModel) => boolean;

    tableAuthMap: DB3AuthTablePermissionMap;

    // Opts this table into the scoped reorder mutation. The caller must name
    // every row in the currently rendered reorder scope; rows outside that
    // explicit scope never participate. The schema owns the exact column that
    // defines an independent ordering group, when applicable.
    sortOrderPolicy?: {
        groupingColumn: string | null;
        scope: "explicitRowIds";
    };

    // Wraps generic writes, audit rows, and mutation hooks in one transaction.
    // kinda a special case, for role/permission association changes which need
    // to invalidate sessions after mutation.
    requiresTransactionalMutation?: boolean;

    // Required so every table declares its generic-delete behavior alongside
    // its schema. This prevents a central table-name registry from drifting.
    deletePolicy: DB3DeletePolicy;

    // specify the permission required to view or restore soft-deleted content
    viewDeletedPermission?: Permission;
    restorePermission?: Permission;

    // this allows tables to supplement search results with extra "customdata".
    SearchCustomDataHookId?: SearchCustomDataHookId | undefined;
};

export type DB3DeletePolicy = "disabled" | "hard" | "softOnly";

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable /* implements TableDesc*/ {
    tableName: string;
    tableID: string; // unique name for the instance
    columns: FieldBase<unknown>[];

    getSelectionArgs: (filterModel: CMDBTableFilterModel) => TAnyModel;

    deletePolicy: DB3DeletePolicy;
    viewDeletedPermission?: Permission;
    restorePermission?: Permission;
    pkMember: string;
    rowNameMember?: string;
    rowDescriptionMember?: string;
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, publicData: DB3Authorization) => (TAnyModel[] | false); // for overall filtering the query based on parameters.
    queryParameters?: DB3QueryParameterMap;

    activeAsSelectable?: (params: TAnyModel) => boolean;

    tableAuthMap: DB3AuthTablePermissionMap;
    sortOrderPolicy?: {
        groupingColumn: string | null;
        scope: "explicitRowIds";
    };
    requiresTransactionalMutation: boolean;

    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    doesItemExactlyMatchText: (row: TAnyModel, filterText: string) => boolean;
    SqlSpecialColumns: SqlSpecialColumnFunctionMap;

    SearchCustomDataHookId?: SearchCustomDataHookId | undefined;

    constructor(args: TableDesc) {
        Object.assign(this, args);
        this.requiresTransactionalMutation = args.requiresTransactionalMutation ?? false;

        if (this.getParameterizedWhereClause && !this.queryParameters) {
            throw new Error(`Table ${args.tableUniqueName || args.tableName} has parameterized filtering without a runtime parameter contract.`);
        }

        // does default behavior of case-insensitive, trimmed compare.
        const itemExactlyMatches_defaultImpl = (value: TAnyModel, filterText: string): boolean => {
            const rowInfo = this.getRowInfo(value);
            return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        }

        if (!this.doesItemExactlyMatchText) {
            this.doesItemExactlyMatchText = itemExactlyMatches_defaultImpl;
        }

        this.tableID = args.tableUniqueName || args.tableName;
        gAllTables[this.tableID.toLowerCase()] = this;

        // for each sql special column, find its field.
        const findFieldWithFunction = (functionName: SqlSpecialColumnFunction): FieldBase<unknown> | undefined => {
            const ret = args.columns.find(c => c.specialFunction === functionName);
            return ret;
        };

        // for each value of SqlSpecialColumnFunction, find the field with that function.

        this.SqlSpecialColumns = {} as SqlSpecialColumnFunctionMap;
        for (const functionName of Object.values(SqlSpecialColumnFunction)) {
            this.SqlSpecialColumns[functionName] = findFieldWithFunction(functionName);
        }

        assert(
            this.deletePolicy === "disabled"
            || this.deletePolicy === "hard"
            || this.deletePolicy === "softOnly",
            `Table ${this.tableID} does not declare a valid delete policy.`,
        );
        assert(
            this.deletePolicy !== "softOnly" || !!this.SqlSpecialColumns.isDeleted,
            `Table ${this.tableID} is soft-delete-only but has no isDeleted field.`,
        );
        assert(
            this.deletePolicy !== "hard" || !this.SqlSpecialColumns.isDeleted,
            `Table ${this.tableID} allows hard deletion despite having an isDeleted field.`,
        );
        assert(
            (!this.viewDeletedPermission && !this.restorePermission) || this.deletePolicy === "softOnly",
            `Table ${this.tableID} declares recovery permissions without soft deletion.`,
        );
        assert(
            (!!this.viewDeletedPermission) === (!!this.restorePermission),
            `Table ${this.tableID} must declare both viewDeletedPermission and restorePermission.`,
        );

        args.columns.forEach(field => {
            field.connectToTable(this);
        });

        if (this.sortOrderPolicy) {
            assert(
                !!this.SqlSpecialColumns.sortOrder,
                `Table ${this.tableID} enables generic reordering without a sort-order field.`,
            );
            if (this.sortOrderPolicy.groupingColumn !== null) {
                assert(
                    !!this.getColumnForAuthorization(this.sortOrderPolicy.groupingColumn),
                    `Table ${this.tableID} groups generic reordering by unknown field ${this.sortOrderPolicy.groupingColumn}.`,
                );
            }
        }

        Object.entries(this.queryParameters || {}).forEach(([parameterName, spec]) => {
            if (spec.authorizeAs === null) return;
            const fieldNames = typeof spec.authorizeAs === "string" ? [spec.authorizeAs] : spec.authorizeAs;
            fieldNames.forEach(fieldName => {
                assert(!!this.getColumnForAuthorization(fieldName),
                    `Query parameter ${this.tableID}.${parameterName} authorizes against unknown field ${fieldName}.`);
            });
        });

        // sanity checks.
        // we could check if there are conflicting or dupilcate columns / functions.
        if (this.SqlSpecialColumns.visiblePermission && !this.SqlSpecialColumns.ownerUser) {
            // fallback to a createdByUser
            if (this.SqlSpecialColumns.createdByUser) {
                this.SqlSpecialColumns.ownerUser = this.SqlSpecialColumns.createdByUser;
            } else {
                // if no owner user, then we cannot have a visiblePermission column. this allows "private" visibility.
                assert(false, `table ${this.tableID} has a visiblePermission column but no owner column. this is not allowed.`);
            }
        }
    }

    // AND this into your query to apply visibility & soft delete logic.
    SqlGetVisFilterExpression(currentUser: UserWithRolesPayload, tableAlias: string) {
        const AND: string[] = [];
        if (this.SqlSpecialColumns.isDeleted) {
            AND.push(`(${tableAlias}.${this.SqlSpecialColumns.isDeleted.member} = false)`);
        }
        if (this.SqlSpecialColumns.visiblePermission) {
            const ownerColumn = this.SqlSpecialColumns.ownerUser;
            assert(!!ownerColumn, `Table ${this.tableID} requires an owner for private visibility.`);
            const permissionColumn = this.SqlSpecialColumns.visiblePermission.fkidMember!;
            const permissionIds = currentUser.role?.permissions.map(p => p.permissionId) || [];
            const permissionIdList = permissionIds.length > 0 ? permissionIds.join(",") : "NULL";
            AND.push(SqlCombineOrExpression([
                `(${tableAlias}.${permissionColumn} IN (${permissionIdList}))`,
                `(${tableAlias}.${permissionColumn} is NULL AND ${tableAlias}.${ownerColumn.fkidMember || ownerColumn.member} = ${currentUser.id})`,
            ]));
        }
        return SqlCombineAndExpression(AND);
    }

    // authorization is at the field level, and serves to:
    // - filter fields from db queries (db payload)
    // - filter out fields before committing to DB (db payload)
    // - filter out fields coming from the db (db payload)
    // - allow client-side to check if a field should be displayed

    // for each field, the following contexts should be specified:
    // - post-query normal
    // - post-query owner/creator
    // - pre-insert
    // - pre-mutate normal
    // - pre-mutate owner/creator

    authorizeAndSanitize = (args: DB3AuthorizeAndSanitizeInput<TAnyModel>): DB3AuthorizeAndSanitizeResult<TAnyModel> => {
        const authorizationModel = args.rowMode === "new"
            ? null
            : args.rowMode === "update" && args.existingModel !== undefined
                ? args.existingModel
                : args.model;
        const rowInfo = authorizationModel ? this.getRowInfo(authorizationModel) : null;
        const ownerUserId = this.getOwnerUserId(authorizationModel, rowInfo?.ownerUserId, args.fallbackOwnerId);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);
        let authContext: DB3AuthorizationContext = "PostQuery";
        switch (args.rowMode) {
            case "new":
                authContext = "PreInsert";
                break;
            case "update":
                authContext = isOwner ? "PreMutateAsOwner" : "PreMutate";
                break;
            case "view":
                authContext = isOwner ? "PostQueryAsOwner" : "PostQuery";
                break;
        }

        // authorize & filter each column.
        const ret = {
            authorizedModel: {},
            unauthorizedModel: {},
            unknownModel: {},
            authorizedColumnCount: 0,
            unauthorizedColumnCount: 0,
            unknownColumnCount: 0,
            rowIsAuthorized: false,
        };

        const fieldInput: DB3AuthorizeAndSanitizeFieldInput<TAnyModel> = { ...args, authContext, isOwner };
        let rowIsAuthorized: boolean;
        switch (args.rowMode) {
            case "new":
                rowIsAuthorized = this.authorizeRowBeforeInsert(args);
                break;
            case "update":
                rowIsAuthorized = this.authorizeRowForEdit({
                    model: authorizationModel,
                    publicData: args.publicData,
                });
                break;
            case "view":
                rowIsAuthorized = this.authorizeRowForView(args);
                break;
        }

        if (args.model) {
            Object.entries(args.model).forEach(e => {
                const col = this.columns.find(c => c.matchesMemberForAuthorization(e[0]));
                if (!col) {
                    console.log(`unknown column: ${e[0]}, tableID:${this.tableID}`);
                    debugger;
                    ret.unknownColumnCount++;
                    ret.unknownModel[e[0]] = e[1];
                    return;
                }
                if (!rowIsAuthorized) {
                    ret.unauthorizedColumnCount++;
                    ret.unauthorizedModel[e[0]] = e[1];
                    return;
                }
                if (col.authorize(fieldInput)) {
                    ret.authorizedColumnCount++;
                    ret.authorizedModel[e[0]] = e[1];
                    return;
                }
                ret.unauthorizedColumnCount++;
                ret.unauthorizedModel[e[0]] = e[1];
            });
        } else {
            // no model means we have to deduce columns from schema.
            this.columns.forEach((col, i) => {
                const member = col.member;
                if (col.authorize(fieldInput)) {
                    ret.authorizedColumnCount++;
                    ret.authorizedModel[member] = null;
                    return;
                }
                ret.unauthorizedColumnCount++;
                ret.unauthorizedModel[member] = null;
            });
        }

        ret.rowIsAuthorized = rowIsAuthorized;
        return ret;
    };

    authorizeColumnForView = <T extends TAnyModel,>(args: DB3AuthorizeForViewColumnArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = this.getOwnerUserId(args.model, rowInfo?.ownerUserId, null);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);
        const col = this.getColumnForAuthorization(args.columnName);
        if (!col) return false;
        return col.authorize({
            authContext: isOwner ? "PostQueryAsOwner" : "PostQuery",
            rowMode: "view",
            isOwner: isOwner,
            contextDesc: "(authorizeColumnForView)",
            model: args.model,
            publicData: args.publicData,
            fallbackOwnerId: null, // for viewing this is not currently necessary
        });
    };

    authorizeColumnForEdit = <T extends TAnyModel,>(args: DB3AuthorizeForEditColumnArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = this.getOwnerUserId(args.model, rowInfo?.ownerUserId, args.fallbackOwnerId);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);
        const col = this.getColumn(args.columnName);
        if (!col) return false;
        return col.authorize({
            authContext: isOwner ? "PreMutateAsOwner" : "PreMutate",
            rowMode: "update",
            isOwner,
            contextDesc: "(authorizeColumnForView)",
            model: args.model,
            publicData: args.publicData,
            fallbackOwnerId: ownerUserId,
        });
    };

    authorizeColumnForInsert = <T extends TAnyModel,>(args: DB3AuthorizeForViewColumnArgs<T>) => {
        const col = this.getColumn(args.columnName);
        if (!col) return false;
        return col.authorize({
            authContext: "PreInsert",
            rowMode: "new",
            isOwner: false,
            contextDesc: "(authorizeColumnForView)",
            model: null,
            publicData: args.publicData,
            fallbackOwnerId: null,
        });
    };

    private isRowVisibleToActor = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>): boolean => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = this.getOwnerUserId(args.model, rowInfo?.ownerUserId, null);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);

        if (args.model) {
            const visiblePermissionColumn = this.SqlSpecialColumns.visiblePermission;
            if (visiblePermissionColumn) {
                const visiblePermissionId = args.model[visiblePermissionColumn.fkidMember!];
                if (visiblePermissionId == null) {
                    if (!isOwner) return false;
                } else {
                    if (!args.publicData.effectivePermissions.includesId(visiblePermissionId)) return false;
                }
            }
        }

        return true;
    };

    canViewDeletedRows = (
        publicData: DB3Authorization,
    ): boolean => !!this.viewDeletedPermission && this.hasPermission(publicData, this.viewDeletedPermission);

    authorizeIncludeDeleted = (
        publicData: DB3Authorization,
        includeDeleted: boolean,
    ): boolean => !includeDeleted
        || (!!this.SqlSpecialColumns.isDeleted && this.canViewDeletedRows(publicData));

    authorizeRowForRestore = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>): boolean => {
        if (!this.restorePermission || !this.hasPermission(args.publicData, this.restorePermission)) return false;
        return this.isRowVisibleToActor(args);
    };

    authorizeRowForView = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = this.getOwnerUserId(args.model, rowInfo?.ownerUserId, null);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);

        if (args.model) {
            const isDeletedColumn = this.SqlSpecialColumns.isDeleted;
            if (isDeletedColumn && args.model[isDeletedColumn.member] === true) {
                if (!args.includeDeleted || !this.canViewDeletedRows(args.publicData)) {
                    return false;
                }
            }
        }
        if (!this.isRowVisibleToActor(args)) return false;

        const requiredPermission = isOwner ? this.tableAuthMap.ViewOwn : this.tableAuthMap.View;
        return this.hasPermission(args.publicData, requiredPermission);
    };

    private hasPermission = (publicData: DB3Authorization, permission: Permission): boolean => {
        return publicData.effectivePermissions.includesName(permission);
    };

    private getOwnerUserId = (
        model: TAnyModel | null,
        rowInfoOwnerUserId: number | null | undefined,
        fallbackOwnerId: number | null,
    ): number | null => {
        if (rowInfoOwnerUserId != null) return rowInfoOwnerUserId;

        const ownerColumn = this.SqlSpecialColumns.ownerUser;
        if (model && ownerColumn) {
            const directOwnerId = model[ownerColumn.fkidMember || ownerColumn.member];
            if (typeof directOwnerId === "number") return directOwnerId;

            const ownerObject = model[ownerColumn.member] as { id?: unknown } | null | undefined;
            if (typeof ownerObject?.id === "number") return ownerObject.id;
        }

        return fallbackOwnerId;
    };

    // Returns undefined when all rows are table-authorized, an ownership clause
    // for ViewOwn-only access, and null when the table cannot be queried at all.
    getRowAuthorizationWhereClause = (publicData: DB3Authorization): TAnyModel | null | undefined => {
        if (this.hasPermission(publicData, this.tableAuthMap.View)) return undefined;

        const ownerColumn = this.SqlSpecialColumns.ownerUser;
        if ((publicData.userId || 0) > 0
            && ownerColumn
            && this.hasPermission(publicData, this.tableAuthMap.ViewOwn)) {
            return {
                [ownerColumn.fkidMember || ownerColumn.member]: publicData.userId,
            };
        }

        return null;
    };

    authorizeTableForView = (publicData: DB3Authorization): boolean => {
        return this.getRowAuthorizationWhereClause(publicData) !== null;
    };

    // Reject actors with neither edit grant before reading a mutation target.
    // The persisted row still determines whether Edit or EditOwn applies.
    authorizeTableForEdit = (publicData: DB3Authorization): boolean => {
        return this.hasPermission(publicData, this.tableAuthMap.Edit)
            || ((publicData.userId || 0) > 0 && this.hasPermission(publicData, this.tableAuthMap.EditOwn));
    };

    authorizeQueryParameter = (
        parameterName: string,
        publicData: DB3Authorization,
    ): boolean => {
        const spec = this.queryParameters?.[parameterName];
        if (!spec) return false;
        if (spec.authorizeAs === null) return true;
        const fieldNames = typeof spec.authorizeAs === "string" ? [spec.authorizeAs] : spec.authorizeAs;
        return fieldNames.every(columnName => this.authorizeColumnForView({
            model: null,
            publicData,
            columnName,
        }));
    };

    authorizeRowForEdit = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = this.getOwnerUserId(args.model, rowInfo?.ownerUserId, null);
        const isOwner = ownerUserId != null
            && ((args.publicData.userId || 0) > 0)
            && (args.publicData.userId === ownerUserId);
        const requiredPermission = isOwner ? this.tableAuthMap.EditOwn : this.tableAuthMap.Edit;
        return args.publicData.effectivePermissions.includesName(requiredPermission);
    };

    authorizeRowForDeletePreferSoft = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        // todo!
        return this.authorizeRowForEdit(args);
    };

    authorizeRowForDeleteHard = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        // todo!
        return this.authorizeRowForEdit(args);
    };

    authorizeRowBeforeInsert = <T extends TAnyModel,>(args: DB3AuthorizeForBeforeInsertArgs<T>) => {
        const requiredPermission = this.tableAuthMap.Insert;
        return args.publicData.effectivePermissions.includesName(requiredPermission);
    };

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: TAnyModel, newItem: TAnyModel, mode: DB3RowMode): ValidateAndComputeDiffResult {
        const ret: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
            errors: {},
            success: true,
            successfulModel: {},
            //hasChanges: false,
            //changes: {},
        });
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;

            // clients are not required to provide values for all values. only care about fields which are in a or b.
            //const a = oldItem[field.member];

            const b_parseResult = field.ValidateAndParse({ row: newItem, mode }); // because `a` comes from the db, it's not necessary to validate it for the purpose of computing diff.

            if (b_parseResult.result === "undefined") continue;

            if (b_parseResult.result === "error") {
                ret.success = false;
                ret.errors[field.member] = b_parseResult.errorMessage!;
                continue;
            }
            //const b = b_parseResult.parsedValue;

            Object.assign(ret.successfulModel, b_parseResult.values);

            //const a_isNully = ((a === null) || (a === undefined));
            //const b_isNully = ((b === null) || (b === undefined));
            // if (a_isNully && b_isNully) {
            //     // they are both null, therefore equal.
            //     continue;
            // }
            // if (a_isNully !== b_isNully) {
            //     // one is null, other is not. guaranteed change.
            //     ret.hasChanges = true;
            //     ret.changes[field.member] = [a, b];
            //     continue;
            // }

            // if (!field.isEqual(a, b)) {
            //     ret.hasChanges = true;
            //     ret.changes[field.member] = [a, b];
            //     continue;
            // }
        }

        //ComputeChangePlan(oldItem, ret.successfulModel, );
        ret.changeResult = CalculateChanges(oldItem, ret.successfulModel);

        return ret;
    };

    CalculateSelectionArgs = async (publicData: DB3Authorization, filterModel: CMDBTableFilterModel, includeDeleted = false): Promise<TAnyModel | undefined> => {
        // create a deep copy so our modifications don't spill into other stuff.
        const selectionArgs = JSON.parse(JSON.stringify(this.getSelectionArgs(filterModel)));

        // selection args can be like,
        // { include: { field1: true, field2: true } }
        // or { select: { field1: true, field2: true } }

        const include = selectionArgs.include || selectionArgs.select; // either one can be used, but we only support one of them.

        // tables with no relations do not support `include` at all. even if it's empty.
        // talk to Prisma about that but in that case we must return undefined so the query doesn't have the empty `include` clause.
        if (!!include) {
            if (Object.entries(include).length === 0) return undefined;
        }

        await this.ApplyIncludeFiltering(include, publicData, includeDeleted);

        return selectionArgs;
    };

    // takes an "include" Prisma clause, and adds a WHERE clause to it to exclude objects that should be hidden.
    // really it just delegates down to columns.
    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3Authorization, includeDeleted = false): Promise<void> => {
        await Promise.all(this.columns.map(col => col.ApplyIncludeFiltering(include, publicData, includeDeleted)));
    };

    CalculateWhereClause = async ({ filterModel, publicData, includeDeleted = false }: CalculateWhereClauseArgs) => {
        const and: Prisma.EventWhereInput[] = [];

        const rowAuthorizationWhere = this.getRowAuthorizationWhereClause(publicData);
        if (rowAuthorizationWhere === null) {
            // Relations should resolve to an empty set instead of causing an
            // otherwise-authorized parent query to fail. Primary queries are
            // rejected by the server preflight before reaching this point.
            and.push({ [this.pkMember]: { in: [] } });
        } else if (rowAuthorizationWhere) {
            and.push(rowAuthorizationWhere);
        }

        // QUICK FILTER
        if (filterModel && filterModel.quickFilterValues) { // quick filtering
            // each "item" is a token typically.
            const quickFilterItems = filterModel.quickFilterValues.filter(q => q.length > 0).map(q => {// for each token
                return {
                    OR: this.GetQuickFilterWhereClauseExpression(q, publicData)
                };
            });
            and.push(...quickFilterItems);
        }

        // GENERAL FILTER (allows custom) -- TODO: maybe this is redundant. parameterized where clauses kinda cover this.
        if (filterModel) {
            and.push(...this.GetCustomWhereClauseExpression(filterModel, publicData));
        }

        if (filterModel && filterModel.items && filterModel.items.length > 0) { // non-quick normal filtering.
            // convert items to prisma filter
            const filterItems = filterModel.items.map((i) => {
                assert(this.authorizeColumnForView({
                    model: null,
                    publicData,
                    columnName: i.field,
                }), `Unauthorized DB3 filter field on table ${this.tableID}.`);
                return { [i.field]: { [i.operator]: i.value } }
            });
            and.push(...filterItems);
        }

        if (this.getParameterizedWhereClause) {
            Object.keys(filterModel.tableParams || {}).forEach(parameterName => {
                assert(this.authorizeQueryParameter(parameterName, publicData),
                    `Unauthorized DB3 query parameter on table ${this.tableID}.`);
            });
            const filterItems = this.getParameterizedWhereClause(filterModel.tableParams || {}, publicData);
            if (filterItems) {
                and.push(...filterItems);
            }
        }

        if (filterModel && filterModel.pks) {
            assert(this.authorizeColumnForView({
                model: null,
                publicData,
                columnName: this.pkMember,
            }), `Unauthorized DB3 primary-key filter on table ${this.tableID}.`);
            const expr: Prisma.EventWhereInput = {
                [this.pkMember]: {
                    in: filterModel.pks
                }
            };
            and.push(expr);
        }

        const overallWhere = this.GetOverallWhereClauseExpression();
        and.push(...overallWhere);

        const canIncludeDeleted = includeDeleted && this.canViewDeletedRows(publicData);
        if (this.SqlSpecialColumns.isDeleted && !canIncludeDeleted) {
            and.push({ [this.SqlSpecialColumns.isDeleted.member]: false });
        }
        if (this.SqlSpecialColumns.visiblePermission) {
            and.push(GetVisibilityWhereExpression({
                permissionIds: [...publicData.effectivePermissions.ids],
                visiblePermissionIdColumnName: this.SqlSpecialColumns.visiblePermission.fkidMember,
                ownerUserId: publicData.userId || undefined,
                ownerUserIdColumnName: this.SqlSpecialColumns.ownerUser?.fkidMember || this.SqlSpecialColumns.ownerUser?.member,
            }));
        }

        const ret = (and.length > 0) ? { AND: and } : undefined;
        return ret;
    };

    GetQuickFilterWhereClauseExpression = (query: string, publicData: DB3Authorization) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            if (!this.authorizeColumnForView({
                model: null,
                publicData,
                columnName: field.member,
            })) continue;
            const clause = field.getQuickFilterWhereClause(query);
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    GetCustomWhereClauseExpression = (filterModel: CMDBTableFilterModel, publicData: DB3Authorization) => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            if (!this.authorizeColumnForView({
                model: null,
                publicData,
                columnName: field.member,
            })) continue;
            const clause = field.getCustomFilterWhereClause(filterModel);
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    GetOverallWhereClauseExpression = () => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getOverallWhereClause();
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    getClientModel = (dbModel: TAnyModel, mode: DB3RowMode, currentUser?: UserWithRolesPayload | null) => {
        const ret: TAnyModel = {};
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            field.ApplyDbToClient(dbModel, ret, mode, currentUser);
        }
        return { ...dbModel, ...ret };
        //return ret;
    }

    clientToDbModel = <T extends TAnyModel,>(clientModel: T, mode: DB3RowMode): TAnyModel => {
        const dbModel = {};

        this.columns.forEach(schemaCol => {
            schemaCol.ApplyClientToDb(clientModel, dbModel, mode);
        });
        return dbModel;
    };

    getColumn = (name: string) => {
        return this.columns.find(c => c.member === name);
    }

    getColumnForAuthorization = (name: string) => {
        return this.columns.find(c => c.matchesMemberForAuthorization(name));
    }

    // create a new row object (no primary key etc)
    // to later be used by insertion.
    createNew = (currentUser: UserWithRolesPayload | null): any => {
        const ret = {};
        this.columns.forEach(field => {
            field.ApplyToNewRow(ret, currentUser);
        });
        return ret;
    }

};

////////////////////////////////////////////////////////////////
export const gAllTables: { [key: string]: xTable } = {
    // populated at runtime. required in order for client to call an API, and the API able to access the same schema.
};

export const GetTableById = (tableID: string): xTable => {
    const ret = gAllTables[tableID.toLowerCase()];
    if (!ret) throw new Error(`tableID ${tableID} was not found.`);
    return ret;
}

////////////////////////////////////////////////////////////////
export const ApplyIncludeFilteringToRelation = async (include: TAnyModel, memberName: string, localTableName: string, foreignMemberOnAssociation: string, foreignTableID: string, publicData: DB3Authorization, includeDeleted = false) => {
    const foreignTable = GetTableById(foreignTableID);
    let member = include[memberName];
    if (!member) { // applies to === false, === null, === undefined
        // this member is not present in the include; nothing to be done; silent NOP.
        return;
    }
    if (member !== true) {
        // assume member is an object which is the typical case, like Prisma.UserInclude.
        // if there's already a where clause there, it's not clear what to do. likely "AND" them, but overall not worth supporting this case.
        if (member.where) {
            throw new Error(`can't apply a WHERE clause when one already exists. probably a bug. table.member: ${localTableName}.${memberName}`);
        }
    } else {
        // member === true is a shorthand; in order to support adding our WHERE clause it must be an object.
        member = {};
    }

    const where = await foreignTable.CalculateWhereClause({
        publicData,
        includeDeleted,
        filterModel: { // clobber the filter; we don't propagate any filter values through relations for this.
            items: [],
        }
    });

    // replace it. no longer use `member` after this.
    // include[memberName] = {
    //     ...member,
    //     where,
    // };
    include[memberName] = {
        ...member,
        where: {
            [foreignMemberOnAssociation]: where,
        },
    };

    // now we should do children. for all members, apply its table filtering. see the example hierarchy:
    if (include[memberName].include) {
        await foreignTable.ApplyIncludeFiltering(include[memberName].include, publicData, includeDeleted);
    }
};
