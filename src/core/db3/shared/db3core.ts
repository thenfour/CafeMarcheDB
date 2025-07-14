import { EmptyPublicData } from "@blitzjs/auth";
import { assert } from "blitz";
import db, { Prisma } from "db";
import { isEmptyArray } from "shared/arrayUtils";
import { CalculateChanges, CalculateChangesResult, createEmptyCalculateChangesResult } from "shared/associationUtils";
import { SqlCombineAndExpression } from "shared/mysqlUtils";
import { Permission, gPublicPermissions } from "shared/permissions";
import { SortDirection } from "shared/rootroot";
import { PublicDataType } from "types";
import { CMDBTableFilterModel, CriterionQueryElements, DiscreteCriterion, GetSearchResultsSortModel, SearchCustomDataHookId, SearchResultsFacetQuery, SortQueryElements, TAnyModel } from "./apiTypes";
import { GetPublicVisibilityWhereExpression, GetSoftDeleteWhereExpression, GetUserVisibilityWhereExpression } from "./db3Helpers";
import { UserWithRolesPayload } from "./schema/userPayloads";
import { ColorPaletteEntry } from "../../components/color/palette";

export type FieldAssociationWithTable = "tableColumn" | "associationRecord" | "foreignObject" | "calculated";

////////////////////////////////////////////////////////////////
// the mutation needs to be able to access the xtable in order to
// validate etc.
export interface MutatorInputBase {
    tableID: string;
    tableName: string;
    clientIntention: xTableClientUsageContext;
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
export interface PaginatedQueryInput {
    tableID: string;
    tableName: string;
    skip: number | undefined;
    take: number | undefined;
    orderBy: TAnyModel | undefined;

    filter: CMDBTableFilterModel;
    clientIntention: xTableClientUsageContext;
    cmdbQueryContext: string;
    delayMS?: number | undefined; // for testing purposes you may want to add an artificial delay to receiving results
};

////////////////////////////////////////////////////////////////
export interface QueryInput {
    tableID: string;
    tableName: string;
    orderBy: TAnyModel | undefined;
    take?: number | undefined;

    filter: CMDBTableFilterModel;
    clientIntention: xTableClientUsageContext;
    cmdbQueryContext: string;
    delayMS?: number | undefined; // for testing purposes you may want to add an artificial delay to receiving results
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
    PostQuery: Permission.basic_trust,
    PostQueryAsOwner: Permission.basic_trust,
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
    clientIntention: xTableClientUsageContext;
};

export interface DB3AuthorizeAndSanitizeInput<T extends TAnyModel> {
    contextDesc: string,
    model: T | null,
    rowMode: DB3RowMode,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
    fallbackOwnerId: number | null;
};

export type DB3AuthorizeAndSanitizeFieldInput<T extends TAnyModel> = DB3AuthorizeAndSanitizeInput<T> & {
    //rowInfo: RowInfo | null;
    authContext: DB3AuthorizationContext;
    isOwner: boolean;
};


export interface DB3AuthorizeForViewColumnArgs<T extends TAnyModel> {
    model: T | null,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
    columnName: string;
};


export interface DB3AuthorizeForEditColumnArgs<T extends TAnyModel> {
    model: T | null,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
    columnName: string;
    fallbackOwnerId: number | null;
};


export interface DB3AuthorizeForRowArgs<T extends TAnyModel> {
    model: T | null,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
};

export interface DB3AuthorizeForBeforeInsertArgs<T extends TAnyModel> {
    //model: T | null,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
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
    abstract getQuickFilterWhereClause: (query: string, clientIntention: xTableClientUsageContext) => TAnyModel | boolean;
    abstract getCustomFilterWhereClause: (query: CMDBTableFilterModel) => TAnyModel | boolean;
    abstract getOverallWhereClause: (clientIntention: xTableClientUsageContext) => TAnyModel | boolean;

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
        if (args.publicData.isSysAdmin) return true;
        const requiredPermission = this.authMap[args.authContext];
        if (!args.publicData.permissions) {
            return gPublicPermissions.some(p => p === requiredPermission);
        }
        return args.publicData.permissions.some(p => p === requiredPermission);
    }

    abstract ApplyToNewRow: (args: TAnyModel, clientIntention: xTableClientUsageContext) => void;

    // SANITIZED values are passed in. That means no nulls, and ValidateAndParse has already been called.
    abstract isEqual: (a: FieldDataType, b: FieldDataType) => boolean;

    abstract ApplyClientToDb: (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => void;
    abstract ApplyDbToClient: (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => void; // apply the value from db to client.

    // for foreign "includes", we need to apply a WHERE clause which excludes soft deletes, irrelevant things, & records the user doesn't have access to.
    abstract ApplyIncludeFiltering: (include: TAnyModel, clientIntention: xTableClientUsageContext) => void;
};

// export enum xTableClientUsageCustomContextType {
//     //UserInsertDialog,
//     //AdminInsertDialog,
// }

// export interface xTableClientUsageCustomContextBase {
//     type: xTableClientUsageCustomContextType, // a way to identify the type of custom context provided.
// };

export interface UsageContextPathPart {
    table: string,
    member: string,
};

export interface xTableClientUsageContext {
    // various table interactions depend on how the client is using it. for example
    // when creating an object from an admin table, versus a normal user create dialog.
    // they have different permissions, and even take different values / defaults.
    // so these are kinda "domains" of client interaction or something.
    // originally thinking of specifying the specific area, like "EventsPageNewEventButton"
    // but it's going to bleed too much logic and annoyance into here.
    // then, more generally "UserCreate" vs. "AdminCreate"
    // but the "create" now becomes pretty much redundant with the requestedcaps. Therefore leave the actual operation out, just focus on the domain.
    intention: "public" | "user" | "admin";

    // visibility is different depending on where the object is within a query.
    // if you're viewing a list of Songs, we want to exclude ones which are deleted.
    // if you're viewing an old setlist, then we don't want to exclude songs which are in the setlist but deleted.
    mode: "relation" | "primary";

    // will be filled in by the table client so not necessary from client code.
    currentUser?: UserWithRolesPayload | null;

    // does your xTable need to act differently when it's being used to populate a dropdown for a related key of some field? use this to do whatever.
    //customContext?: xTableClientUsageCustomContextBase;

    // for related objects, this is the hierarchical path. first element is the root.
    relationPath?: UsageContextPathPart[];
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
    filterModel: CMDBTableFilterModel;
    clientIntention: xTableClientUsageContext;
    skipVisibilityCheck?: boolean;
};


export interface TableDesc {
    tableName: string;
    tableUniqueName?: string; // DB tables have multiple variations (event vs. event verbose / permission vs. permission for visibility / et al). therefore tableName is not sufficient. use this instead.
    columns: FieldBase<unknown>[];

    getSelectionArgs: (clientIntention: xTableClientUsageContext, filterModel: CMDBTableFilterModel) => TAnyModel,
    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    doesItemExactlyMatchText?: (row: TAnyModel, filterText: string) => boolean,
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.

    // for things like attendance options, where options can go stale and become "inactive", allow table schemas to filter items out.
    activeAsSelectable?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => boolean;

    tableAuthMap: DB3AuthTablePermissionMap;

    // this allows tables to supplement search results with extra "customdata".
    SearchCustomDataHookId?: SearchCustomDataHookId | undefined;
};

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable /* implements TableDesc*/ {
    tableName: string;
    tableID: string; // unique name for the instance
    columns: FieldBase<unknown>[];

    getSelectionArgs: (clientIntention: xTableClientUsageContext, filterModel: CMDBTableFilterModel) => TAnyModel;

    pkMember: string;
    rowNameMember?: string;
    rowDescriptionMember?: string;
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.

    activeAsSelectable?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => boolean;

    tableAuthMap: DB3AuthTablePermissionMap;

    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    doesItemExactlyMatchText: (row: TAnyModel, filterText: string) => boolean;
    SqlSpecialColumns: SqlSpecialColumnFunctionMap;

    SearchCustomDataHookId?: SearchCustomDataHookId | undefined;

    constructor(args: TableDesc) {
        Object.assign(this, args);

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

        args.columns.forEach(field => {
            field.connectToTable(this);
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
            AND.push(`(${tableAlias}.isDeleted = false)`);
        }
        if (this.SqlSpecialColumns.ownerUser) {
            AND.push(`
            (${tableAlias}.visiblePermissionId IN (${currentUser.role?.permissions.map(p => p.permissionId)}))
            OR (${tableAlias}.visiblePermissionId is NULL AND ${tableAlias}.${this.SqlSpecialColumns.ownerUser.fkidMember} = ${currentUser.id})
            `);
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
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const ownerUserId = rowInfo?.ownerUserId || args.fallbackOwnerId;
        const isOwner = ownerUserId ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === ownerUserId) : false;
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

        if (args.model) {
            Object.entries(args.model).forEach(e => {
                //const col = this.columns.find(c => c.member.toLowerCase() === e[0].toLowerCase());
                const col = this.columns.find(c => c.matchesMemberForAuthorization(e[0]));
                if (e[0].toLowerCase() === this.pkMember.toLowerCase()) {
                    // TODO: this may not be necessary; pk field's authorize() may handle this already.
                    // primary key gets special treatment. actually in no case should this field be stripped as unauthorized.
                    ret.authorizedColumnCount++;
                    ret.authorizedModel[e[0]] = e[1];
                    return;
                }
                if (!col) {
                    console.log(`unknown column: ${e[0]}, tableID:${this.tableID}`);
                    debugger;
                    ret.unknownColumnCount++;
                    ret.unknownModel[e[0]] = e[1];
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

        ret.rowIsAuthorized = ret.authorizedColumnCount > 0;
        return ret;
    };

    authorizeColumnForView = <T extends TAnyModel,>(args: DB3AuthorizeForViewColumnArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const isOwner = rowInfo ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === rowInfo.ownerUserId) : false;
        const col = this.getColumn(args.columnName);
        if (!col) return false;
        return col.authorize({
            clientIntention: args.clientIntention,
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
        const ownerUserId = rowInfo?.ownerUserId || args.fallbackOwnerId;
        const isOwner = ownerUserId ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === ownerUserId) : false;
        const col = this.getColumn(args.columnName);
        if (!col) return false;
        return col.authorize({
            clientIntention: args.clientIntention,
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
            clientIntention: args.clientIntention,
            authContext: "PreInsert",
            rowMode: "new",
            isOwner: false,
            contextDesc: "(authorizeColumnForView)",
            model: null,
            publicData: args.publicData,
            fallbackOwnerId: null,
        });
    };

    authorizeRowForView = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const isOwner = rowInfo ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === rowInfo.ownerUserId) : false;
        if (args.publicData.isSysAdmin) return true;
        const requiredPermission = isOwner ? this.tableAuthMap.ViewOwn : this.tableAuthMap.View;
        if (!args.publicData.permissions) {
            return gPublicPermissions.some(p => p === requiredPermission);
        }
        return args.publicData.permissions.some(p => p === requiredPermission);
    };

    authorizeRowForEdit = <T extends TAnyModel,>(args: DB3AuthorizeForRowArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const isOwner = rowInfo ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === rowInfo.ownerUserId) : false;
        if (args.publicData.isSysAdmin) return true;
        const requiredPermission = isOwner ? this.tableAuthMap.EditOwn : this.tableAuthMap.Edit;
        if (!args.publicData.permissions) {
            return gPublicPermissions.some(p => p === requiredPermission);
        }
        return args.publicData.permissions.some(p => p === requiredPermission);
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
        if (args.publicData.isSysAdmin) return true;
        const requiredPermission = this.tableAuthMap.Insert;
        if (!args.publicData.permissions) {
            return gPublicPermissions.some(p => p === requiredPermission);
        }
        return args.publicData.permissions.some(p => p === requiredPermission);
    };

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: TAnyModel, newItem: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext): ValidateAndComputeDiffResult {
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

            const b_parseResult = field.ValidateAndParse({ row: newItem, mode, clientIntention }); // because `a` comes from the db, it's not necessary to validate it for the purpose of computing diff.

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

    CalculateSelectionArgs = (clientIntention: xTableClientUsageContext, filterModel: CMDBTableFilterModel): TAnyModel | undefined => {
        // create a deep copy so our modifications don't spill into other stuff.
        const selectionArgs = JSON.parse(JSON.stringify(this.getSelectionArgs(clientIntention, filterModel)));

        // selection args can be like,
        // { include: { field1: true, field2: true } }
        // or { select: { field1: true, field2: true } }

        const include = selectionArgs.include || selectionArgs.select; // either one can be used, but we only support one of them.

        // tables with no relations do not support `include` at all. even if it's empty.
        // talk to Prisma about that but in that case we must return undefined so the query doesn't have the empty `include` clause.
        if (!!include) {
            if (Object.entries(include).length === 0) return undefined;
        }

        this.ApplyIncludeFiltering(include, clientIntention);

        return selectionArgs;
    };

    // takes an "include" Prisma clause, and adds a WHERE clause to it to exclude objects that should be hidden.
    // really it just delegates down to columns.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext): void => {
        this.columns.forEach(col => {
            col.ApplyIncludeFiltering(include, clientIntention);
        });
    };

    CalculateWhereClause = async ({ filterModel, clientIntention, skipVisibilityCheck }: CalculateWhereClauseArgs) => {
        const and: Prisma.EventWhereInput[] = [];
        skipVisibilityCheck = !!skipVisibilityCheck; // default to false.

        // QUICK FILTER
        if (filterModel && filterModel.quickFilterValues) { // quick filtering
            // each "item" is a token typically.
            const quickFilterItems = filterModel.quickFilterValues.filter(q => q.length > 0).map(q => {// for each token
                return {
                    OR: this.GetQuickFilterWhereClauseExpression(q, clientIntention)
                };
            });
            and.push(...quickFilterItems);
        }

        // GENERAL FILTER (allows custom) -- TODO: maybe this is redundant. parameterized where clauses kinda cover this.
        if (filterModel) {
            and.push(...this.GetCustomWhereClauseExpression(filterModel));
        }

        if (filterModel && filterModel.items && filterModel.items.length > 0) { // non-quick normal filtering.
            // convert items to prisma filter
            const filterItems = filterModel.items.map((i) => {
                return { [i.field]: { [i.operator]: i.value } }
            });
            and.push(...filterItems);
        }

        if (this.getParameterizedWhereClause) {
            const filterItems = this.getParameterizedWhereClause(filterModel.tableParams || {}, clientIntention);
            if (filterItems) {
                and.push(...filterItems);
            }
        }

        if (filterModel && filterModel.pks) {
            const expr: Prisma.EventWhereInput = {
                [this.pkMember]: {
                    in: filterModel.pks
                }
            };
            and.push(expr);
        }

        const overallWhere = this.GetOverallWhereClauseExpression(clientIntention);
        and.push(...overallWhere);

        // add soft delete clause.
        if (this.SqlSpecialColumns.isDeleted) {
            if (clientIntention.intention !== "admin") {
                and.push({ [this.SqlSpecialColumns.isDeleted.member]: false });
            }
        }

        // and visibility
        if (this.SqlSpecialColumns.visiblePermission && !skipVisibilityCheck) {
            if (clientIntention.intention === "public") {
                const publicRole = await db.role.findFirst({
                    where: {
                        isPublicRole: true,
                    },
                    include: {
                        permissions: true,
                    }
                });
                assert(!!publicRole, "expecting a public role to be assigned in the db");
                const spec: Prisma.EventWhereInput = { // EventWhereInput for practical type checking.
                    // current user has access to the specified visibile permission
                    [this.SqlSpecialColumns.visiblePermission.fkidMember!]: { in: publicRole.permissions.map(p => p.permissionId) }
                };
                and.push(spec);
            } else {
                assert(!!clientIntention.currentUser, "current user is required in this line.");
                let spec: Prisma.EventWhereInput = {};

                if (this.SqlSpecialColumns.ownerUser) {
                    spec = { // EventWhereInput for practical type checking.
                        OR: [
                            {
                                // current user has access to the specified visibile permission
                                [this.SqlSpecialColumns.visiblePermission.fkidMember!]: { in: clientIntention.currentUser!.role!.permissions.map(p => p.permissionId) }
                            },
                            {
                                // private visibility and you are the creator
                                AND: [
                                    { [this.SqlSpecialColumns.visiblePermission.fkidMember!]: null },
                                    { [this.SqlSpecialColumns.ownerUser.fkidMember!]: clientIntention.currentUser!.id }
                                ]
                            }
                        ]
                    };

                } else {
                    // current user has access to the specified visibile permission
                    spec = { [this.SqlSpecialColumns.visiblePermission.fkidMember!]: { in: clientIntention.currentUser!.role!.permissions.map(p => p.permissionId) } };
                }

                and.push(spec);
            }
        }

        const ret = (and.length > 0) ? { AND: and } : undefined;
        return ret;
    };

    GetQuickFilterWhereClauseExpression = (query: string, clientIntention: xTableClientUsageContext) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getQuickFilterWhereClause(query, clientIntention);
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    GetCustomWhereClauseExpression = (filterModel: CMDBTableFilterModel) => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getCustomFilterWhereClause(filterModel);
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    GetOverallWhereClauseExpression = (clientIntention: xTableClientUsageContext) => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getOverallWhereClause(clientIntention);
            if (clause && !isEmptyArray(clause)) {
                ret.push(clause);
            }
        }
        return ret;
    };

    getClientModel = (dbModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        const ret: TAnyModel = {};
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            field.ApplyDbToClient(dbModel, ret, mode, clientIntention);
        }
        return { ...dbModel, ...ret };
        //return ret;
    }

    clientToDbModel = <T extends TAnyModel,>(clientModel: T, mode: DB3RowMode, clientIntention: xTableClientUsageContext): TAnyModel => {
        const dbModel = {};

        this.columns.forEach(schemaCol => {
            schemaCol.ApplyClientToDb(clientModel, dbModel, mode, clientIntention);
        });
        return dbModel;
    };

    getColumn = (name: string) => {
        return this.columns.find(c => c.member === name);
    }

    // create a new row object (no primary key etc)
    // to later be used by insertion.
    createNew = (clientIntention: xTableClientUsageContext): any => {
        const ret = {};
        this.columns.forEach(field => {
            field.ApplyToNewRow(ret, clientIntention);
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
export const ApplyIncludeFilteringToRelation = async (include: TAnyModel, memberName: string, localTableName: string, foreignMemberOnAssociation: string, foreignTableID: string, clientIntention: xTableClientUsageContext) => {
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

    // calculate the where clause
    const newClientIntention: xTableClientUsageContext = { ...clientIntention, mode: "relation" };
    newClientIntention.relationPath = !!newClientIntention.relationPath ? [...newClientIntention.relationPath] : [];
    newClientIntention.relationPath.push({
        table: localTableName,
        member: memberName,
    });

    const where = await foreignTable.CalculateWhereClause({
        skipVisibilityCheck: false,
        clientIntention: newClientIntention,
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
        foreignTable.ApplyIncludeFiltering(include[memberName].include, newClientIntention);
    }
};

// TODO: see db3Helpers and unify with GetSoftDeleteWhereExpression
export const ApplySoftDeleteWhereClause = (ret: Array<any>, clientIntention: xTableClientUsageContext, isDeletedColumnName?: string) => {
    if (clientIntention.intention === "user") {
        ret.push(GetSoftDeleteWhereExpression(isDeletedColumnName));
    }
}

////////////////////////////////////////////////////////////////
// apply conditions for visibility. usually columns visiblePermissionId + createdByUserId.
// NOT applying a clause means always visible.

// TODO: See db3Helpers and GetUserVisibilityWhereExpression; best to unify this.
export const ApplyVisibilityWhereClause = async (ret: Array<any>, clientIntention: xTableClientUsageContext, createdByUserIDColumnName: string) => {
    // for admin grids, always show admins the items. they see the IsDeleted / visibility columns there.
    if (clientIntention.intention === "admin") {
        if (clientIntention.currentUser!.isSysAdmin) return; // sys admins 

        // non-sysadmins just should never see admin content.
        throw new Error(`unauthorized access to admin content`);
    }

    // don't do this, because it would just be confusing. leave that kind of omnicience to admin-specific functions.
    // make user-looking functions operate as close to user as possible.
    //if (clientIntention.currentUser!.isSysAdmin) return; // sys admins can always see everything.

    if (clientIntention.intention === "public" || !clientIntention.currentUser?.roleId) {
        ret.push(GetPublicVisibilityWhereExpression());
    } else {
        // intention is user
        assert(clientIntention.intention === "user", "checking we're handling all cases");
        assert(!!clientIntention.currentUser, "current user is required in this line.");

        ret.push(await GetUserVisibilityWhereExpression(clientIntention.currentUser, createdByUserIDColumnName));
    }
};


////////////////////////////////////////////////////////////////
export const ApplyVisibilityWhereClauseIndirectly = async (ret: Array<any>, clientIntention: xTableClientUsageContext, foreignMemberName: string, createdByUserIDColumnName: string) => {
    const foreignFilter = [];
    await ApplyVisibilityWhereClause(foreignFilter, clientIntention, createdByUserIDColumnName);
    if (foreignFilter.length) {
        // a where clause was constructed. now form it into an indirect one.
        const x: Prisma.EventSongListSongWhereInput = {
            [foreignMemberName]: {
                AND: foreignFilter,
            }
        };
        ret.push(x);
    }
};
