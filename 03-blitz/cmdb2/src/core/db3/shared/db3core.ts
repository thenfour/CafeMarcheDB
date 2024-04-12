import { ColorPaletteEntry } from "shared/color";
import { Permission, gPublicPermissions } from "shared/permissions";
import { CalculateChanges, CalculateChangesResult, TAnyModel, createEmptyCalculateChangesResult, isEmptyArray } from "shared/utils";
import db, { Prisma } from "db";
import { assert } from "blitz";
import { PublicDataType } from "types";
import { EmptyPublicData, PublicData } from "@blitzjs/auth";
import { ComputeChangePlan } from "shared/associationUtils";


// server-side code for db schema expression.
// this is meant to describe behaviors of the schema that we need from code but can't get from Prisma.* directly.
// for example:
// - validation of fields, whether they're nullable or not, case sensitivity
// - which items get included in queries (include clause)
// - permissions required
// - default values


// ok parameterization.
// in order to drill down to stuff there needs to be parameters given for a table view.
// so far i have avoided this by showing ALL rows for a given table view, and any filtering is done by the user and has no impact on the data.
// but for example i need to be able to see comments for an event.
// i should see a link in the event row to see comments.
// when i view the comments table then (on a new page), it will have the eventId as a parameter.
// easy right? just add like a "parameters" thing which gets added to the where clause.
// then when i create new, we also need that parameter to be used to populate a field in the new object.
// and that field should probably not be editable in the edit page. or for admins maybe yes? not sure there.

// ok special / common field handling...
// createdAt
// updatedAt
// isDeleted - soft delete
// these types of fields are not really editable by users and get intercepted by actions.
// what is the best way to generalize these fields' behaviors'?
// 1. column flag
// benefits: very clear in column defs
// potential issue where the core may not always do the right thing. the backend now will need
// to understand the user action rather than the db action. maybe that's not a bad idea too.
// so like, all mutations should specify what type of symbolic user action it is.
//
// 2. just let clients do it.
// benefits: avoids complexifying the design, in many ways a more direct design.
// already possible.
// so for soft delete, the client will just send an update with isDeleted=true.

// considering #2 is already possible and potentially a step towards #1, just go #2.

////////////////////////////////////////////////////////////////
// in order for mutations to understand how to handle each field; this could be a boolean but this is more expressive.
// associations must be inserted / updated very differently from the local row.
// export const FieldAssociationWithTableOptions = {
//     tableColumn: "tableColumn", // normal table column
//     associationRecord: "associationRecord", // for many-to-many relations
// } as const;

export type FieldAssociationWithTable = "tableColumn" | "associationRecord" | "foreignObject" | "calculated";

////////////////////////////////////////////////////////////////
// the mutation needs to be able to access the xtable in order to
// validate etc.
export interface MutatorInput {
    tableID: string;
    tableName: string;
    insertModel?: TAnyModel;
    deleteId?: number;
    updateId?: number;
    updateModel?: TAnyModel;
    clientIntention: xTableClientUsageContext;
};

export interface CMDBTableFilterItem { // from MUI GridFilterItem
    id?: number | string;
    field: string;
    value?: any;
    operator: "equals";
}

// allow client users to specify cmdb-specific queries.
// normal filtering & quick filtering is great but this allows for example custom filtering like tagIds.
export interface CMDBTableFilterModel {
    items: CMDBTableFilterItem[];
    quickFilterValues?: any[];

    tagIds?: number[];
    tableParams?: TAnyModel;
};


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
    //hasChanges: boolean; // only meaningful if success
    //changes: { [key: string]: [any, any] }; // only meaningful if success
    // a complete validated model based on the incoming model. because validation can sanitize values, after validating you should use this
    // **IF** successful.
    successfulModel: TAnyModel;
    changeResult: CalculateChangesResult;
};

export class ValidateAndComputeDiffResult implements ValidateAndComputeDiffResultFields {
    success: boolean = true;
    errors: { [key: string]: string } = {};
    //hasChanges: boolean = false; // only meaningful if success
    //changes: { [key: string]: [any, any] } = {}; // only meaningful if success
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

export const UserWithRolesArgs = Prisma.validator<Prisma.UserArgs>()({
    include: {
        role: {
            include: {
                permissions: true,
            }
        }
    }
});

export type UserWithRolesPayload = Prisma.UserGetPayload<typeof UserWithRolesArgs>;



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
};




export type DB3AuthorizationContext = keyof DB3AuthContextPermissionMap;// "PostQuery" | "PostQueryAsOwner" | "PreInsert" | "PreMutate" | "PreMutateAsOwner";

export type FieldBaseArgs<FieldDataType> = {
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    //label: string;
    defaultValue: FieldDataType | null;
    authMap: DB3AuthContextPermissionMap | null;
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
};

export type DB3AuthorizeAndSanitizeFieldInput<T extends TAnyModel> = DB3AuthorizeAndSanitizeInput<T> & {
    rowInfo: RowInfo | null;
    authContext: DB3AuthorizationContext;
    isOwner: boolean;
};


export interface DB3AuthorizeForViewColumnArgs<T extends TAnyModel> {
    model: T | null,
    publicData: EmptyPublicData | Partial<PublicDataType>,
    clientIntention: xTableClientUsageContext,
    columnName: string;
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

export abstract class FieldBase<FieldDataType> {
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    defaultValue: FieldDataType | null;

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
        assert(!!this.authMap, `one of authMap or customAuth are required; field:${this.member}, contextDesc:${args.contextDesc}`);
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
    order: "asc" | "desc",
};

export interface RowInfo {
    name: string;
    description?: string;
    color?: ColorPaletteEntry | null;
    iconName?: string | null;
    ownerUserId: number | null; // if the row has an "owner" set this. helps with authorization
};


export interface CalculateWhereClauseArgs {
    filterModel: CMDBTableFilterModel;
    clientIntention: xTableClientUsageContext;
    skipVisibilityCheck?: boolean;
};

export interface SoftDeleteSpec {
    isDeletedColumnName: string;
};
export interface VisibilitySpec {
    visiblePermissionIDColumnName: string;
    ownerUserIDColumnName: string;
};

export interface TableDesc {
    tableName: string;
    tableUniqueName?: string; // DB tables have multiple variations (event vs. event verbose / permission vs. permission for visibility / et al). therefore tableName is not sufficient. use this instead.
    columns: FieldBase<unknown>[];

    softDeleteSpec?: SoftDeleteSpec;
    visibilitySpec?: VisibilitySpec; // visibility

    getInclude: (clientIntention: xTableClientUsageContext) => TAnyModel,
    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.

    tableAuthMap: DB3AuthTablePermissionMap;
};

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable implements TableDesc {
    tableName: string;
    tableID: string; // unique name for the instance
    columns: FieldBase<unknown>[];

    getInclude: (clientIntention: xTableClientUsageContext) => TAnyModel;

    softDeleteSpec?: SoftDeleteSpec;
    visibilitySpec?: VisibilitySpec; // visibility

    pkMember: string;

    rowNameMember?: string;
    rowDescriptionMember?: string;
    naturalOrderBy?: TAnyModel;
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.

    tableAuthMap: DB3AuthTablePermissionMap;

    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;

    constructor(args: TableDesc) {
        Object.assign(this, args);

        this.tableID = args.tableUniqueName || args.tableName;
        gAllTables[this.tableID.toLowerCase()] = this;

        args.columns.forEach(field => {
            field.connectToTable(this);
        });
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

    // if model is empty, then 
    authorizeAndSanitize = (args: DB3AuthorizeAndSanitizeInput<TAnyModel>): DB3AuthorizeAndSanitizeResult<TAnyModel> => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const isOwner = rowInfo ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === rowInfo.ownerUserId) : false;
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

        const fieldInput: DB3AuthorizeAndSanitizeFieldInput<TAnyModel> = { ...args, authContext, rowInfo, isOwner };

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
            rowInfo,
        });
    };

    authorizeColumnForEdit = <T extends TAnyModel,>(args: DB3AuthorizeForViewColumnArgs<T>) => {
        const rowInfo = args.model ? this.getRowInfo(args.model) : null;
        const isOwner = rowInfo ? ((args.publicData.userId || 0) > 0) && (args.publicData.userId === rowInfo.ownerUserId) : false;
        const col = this.getColumn(args.columnName);
        if (!col) return false;
        return col.authorize({
            clientIntention: args.clientIntention,
            authContext: isOwner ? "PreMutateAsOwner" : "PreMutate",
            rowMode: "update",
            isOwner: isOwner,
            contextDesc: "(authorizeColumnForView)",
            model: args.model,
            publicData: args.publicData,
            rowInfo,
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
            rowInfo: null,
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

    CalculateInclude = (clientIntention: xTableClientUsageContext): TAnyModel | undefined => {
        // create a deep copy so our modifications don't spill into other stuff.
        const include = JSON.parse(JSON.stringify(this.getInclude(clientIntention)));
        this.ApplyIncludeFiltering(include, clientIntention);

        // tables with no relations do not support `include` at all. even if it's empty.
        // talk to Prisma about that but in that case we must return undefined so the query doesn't have the empty `include` clause.
        if (Object.entries(include).length === 0) return undefined;

        return include;
    };

    // takes an "include" Prisma clause, and adds a WHERE clause to it to exclude objects that should be hidden.
    // really it just delegates down to columns.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext): void => {
        this.columns.forEach(col => {
            col.ApplyIncludeFiltering(include, clientIntention);
        });
    };

    CalculateWhereClause = async ({ filterModel, clientIntention, skipVisibilityCheck }: CalculateWhereClauseArgs) => {
        const and: any[] = [];
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

        const overallWhere = this.GetOverallWhereClauseExpression(clientIntention);
        and.push(...overallWhere);

        // add soft delete clause.
        if (this.softDeleteSpec) {
            if (clientIntention.intention !== "admin") {
                and.push({ [this.softDeleteSpec.isDeletedColumnName || "isDeleted"]: false });
            }
        }

        // and visibility
        if (this.visibilitySpec && !skipVisibilityCheck) {
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
                    [this.visibilitySpec.visiblePermissionIDColumnName || "visiblePermissionId"]: { in: publicRole.permissions.map(p => p.permissionId) }
                };
                and.push(spec);
            } else {
                assert(!!clientIntention.currentUser, "current user is required in this line.");
                const spec: Prisma.EventWhereInput = { // EventWhereInput for practical type checking.
                    OR: [
                        {
                            // current user has access to the specified visibile permission
                            [this.visibilitySpec.visiblePermissionIDColumnName || "visiblePermissionId"]: { in: clientIntention.currentUser!.role!.permissions.map(p => p.permissionId) }
                        },
                        {
                            // private visibility and you are the creator
                            AND: [
                                { [this.visibilitySpec.visiblePermissionIDColumnName || "visiblePermissionId"]: null },
                                { [this.visibilitySpec.ownerUserIDColumnName || "createdByUserId"]: clientIntention.currentUser!.id }
                            ]
                        }
                    ]
                };
                and.push(spec);
            }
        }

        const ret = (and.length > 0) ? { AND: and } : undefined;
        // console.log(`calculate where clause on table ${this.tableName}`);
        // console.log(ret);
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

//let gIndent = 0;

////////////////////////////////////////////////////////////////
export const ApplyIncludeFilteringToRelation = async (include: TAnyModel, memberName: string, localTableName: string, foreignMemberOnAssociation: string, foreignTableID: string, clientIntention: xTableClientUsageContext) => {
    // console.log(`${"--".repeat(gIndent)}{{ ApplyIncludeFilteringToRelation(${localTableName}.${memberName}, foreign:${foreignTableID}) incoming include:`);
    // console.log(include);
    // gIndent++;
    const foreignTable = GetTableById(foreignTableID);
    let member = include[memberName];
    if (!member) { // applies to === false, === null, === undefined
        // this member is not present in the include; nothing to be done; silent NOP.
        // console.log(`${"--".repeat(gIndent)}-> nothing to do; this member (${memberName}) is not in the include. (include:)`);
        // console.log(include);
        // gIndent--;
        // console.log(`${"--".repeat(gIndent)}}}`);
        return;
    }
    if (member !== true) {
        // assume member is an object which is the typical case, like Prisma.UserInclude.
        // if there's already a where clause there, it's not clear what to do. likely "AND" them, but overall not worth supporting this case.
        if (member.where) {
            //console.log(member.where);
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

    // console.log(`${"--".repeat(gIndent)}WHERE clause for table:${localTableName} col:${memberName} with foreignTable:${foreignTableID}`);
    // console.log(where);

    // console.log(`${"--".repeat(gIndent)}about to update include for member. here is before:`);
    // console.log(include[memberName]);

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

    // console.log(`${"--".repeat(gIndent)}updated include so now its:`);
    // console.log(include[memberName]);

    // now we should do children. for all members, apply its table filtering. see the example hierarchy:
    if (include[memberName].include) {
        //console.log(`${"--".repeat(gIndent)}applying include for children`);
        foreignTable.ApplyIncludeFiltering(include[memberName].include, newClientIntention);
    }

    // gIndent--;
    // console.log(`${"--".repeat(gIndent)}}}`);
};

export const ApplySoftDeleteWhereClause = (ret: Array<any>, clientIntention: xTableClientUsageContext, isDeletedColumnName?: string) => {
    if (clientIntention.intention === "user") {
        ret.push({ [isDeletedColumnName || "isDeleted"]: false });
    }
}

////////////////////////////////////////////////////////////////
// apply conditions for visibility. usually columns visiblePermissionId + createdByUserId.
// NOT applying a clause means always visible.
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
            visiblePermissionId: { in: publicRole.permissions.map(p => p.permissionId) }
        };
        ret.push(spec);
    } else {
        // intention is user
        assert(clientIntention.intention === "user", "checking we're handling all cases");
        assert(!!clientIntention.currentUser, "current user is required in this line.");

        ret.push({
            OR: [
                {
                    // current user has access to the specified visibile permission
                    visiblePermissionId: { in: clientIntention.currentUser?.role?.permissions.map(p => p.permissionId) }
                },
                {
                    // private visibility and you are the creator
                    AND: [
                        { visiblePermissionId: null },
                        { [createdByUserIDColumnName]: clientIntention.currentUser?.id }
                    ]
                }
            ]
        });
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
