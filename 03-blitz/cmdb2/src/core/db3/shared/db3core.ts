import { ColorPaletteEntry } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/utils";
import db, { Prisma } from "db";


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
    tableName: string;
    insertModel?: TAnyModel;
    deleteId?: number;
    updateId?: number;
    updateModel?: TAnyModel;
};

////////////////////////////////////////////////////////////////
export interface PaginatedQueryInput {
    tableName: string;
    skip: number | undefined;
    take: number | undefined;
    where: TAnyModel | undefined;
    orderBy: TAnyModel | undefined;
};

////////////////////////////////////////////////////////////////
export interface QueryInput {
    tableName: string;
    where: TAnyModel | undefined;
    orderBy: TAnyModel | undefined;
    take?: number | undefined;
};

////////////////////////////////////////////////////////////////
export interface ValidateAndParseResult<FieldType> {
    success: boolean;
    errorMessage?: string;
    // when success, this is the "parsed" sanitized value. when error, this is the original value. for convenience so in every case this value can be used after the call.
    // therefore it must also support string and null (possibly invalid values)
    parsedValue: string | FieldType;
};

export const SuccessfulValidateAndParseResult = <FieldType>(parsedValue: FieldType | string): ValidateAndParseResult<FieldType> => {
    return {
        success: true,
        parsedValue,
    };
};

export const ErrorValidateAndParseResult = <FieldType>(errorMessage: string, inputValue: FieldType | string): ValidateAndParseResult<FieldType> => {
    return {
        success: false,
        errorMessage,
        parsedValue: inputValue,
    };
};

export interface ValidateAndComputeDiffResultFields {
    success: boolean;
    errors: { [key: string]: string };
    hasChanges: boolean; // only meaningful if success
    changes: { [key: string]: [any, any] }; // only meaningful if success
};

export class ValidateAndComputeDiffResult implements ValidateAndComputeDiffResultFields {
    success: boolean = true;
    errors: { [key: string]: string } = {};
    hasChanges: boolean = false; // only meaningful if success
    changes: { [key: string]: [any, any] } = {}; // only meaningful if success

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
    hasChanges: false,
});

export const EmptyValidateAndComputeDiffResult = SuccessfulValidateAndComputeDiffResult;


// allow client users to specify cmdb-specific queries.
// normal filtering & quick filtering is great but this allows for example custom filtering like tagIds.
export interface TableClientSpecFilterModelCMDBExtras {
    cmdb?: {
        tagIds: number[];
    };
};

const UserWithRolesArgs = Prisma.validator<Prisma.UserArgs>()({
    include: {
        role: {
            include: {
                permissions: true,
            }
        }
    }
});

type UserWithRolesPayload = Prisma.UserGetPayload<typeof UserWithRolesArgs>;



////////////////////////////////////////////////////////////////
//export type FieldSignificanceOptions = "name" | "description" | "none" | "color";
export type DB3RowMode = "new" | "view" | "update";

export interface FieldBaseArgs<FieldDataType> {
    //fieldType: string;
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    label: string;
    defaultValue: FieldDataType | null;
    //fieldSignificance: FieldSignificanceOptions;
}

export interface ValidateAndParseArgs<FieldDataType> {
    value: FieldDataType | null;
    row: TAnyModel;
    mode: DB3RowMode;
};

export abstract class FieldBase<FieldDataType> {
    //fieldType: string;
    fieldTableAssociation: FieldAssociationWithTable;
    member: string;
    label: string;
    defaultValue: FieldDataType | null;

    constructor(args: FieldBaseArgs<FieldDataType>) {
        Object.assign(this, args);
    };

    // field child classes impl this to get established. for example pk fields will set the table's pk here.
    abstract connectToTable: (table: xTable) => void;

    // return either falsy, or a "WhereInput" object like { name: { contains: query } }
    abstract getQuickFilterWhereClause: (query: string) => TAnyModel | boolean;
    abstract getCustomFilterWhereClause: (query: TableClientSpecFilterModelCMDBExtras) => TAnyModel | boolean;
    abstract getOverallWhereClause: (clientIntention: xTableClientUsageContext) => TAnyModel | boolean;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    abstract ValidateAndParse: (args: ValidateAndParseArgs<FieldDataType>) => ValidateAndParseResult<FieldDataType | null>;// => {

    abstract ApplyToNewRow: (args: TAnyModel, clientIntention: xTableClientUsageContext) => void;

    // SANITIZED values are passed in. That means no nulls, and ValidateAndParse has already been called.
    abstract isEqual: (a: FieldDataType, b: FieldDataType) => boolean;

    abstract ApplyClientToDb: (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => void;
    abstract ApplyDbToClient: (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => void; // apply the value from db to client.
};

export enum xTableClientUsageCustomContextType {
    UserInsertDialog,
    AdminInsertDialog,
}

export interface xTableClientUsageCustomContextBase {
    type: xTableClientUsageCustomContextType, // a way to identify the type of custom context provided.
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
    intention: "user" | "admin";

    // will be filled in by the table client so not necessary from client code.
    currentUser?: UserWithRolesPayload;

    // does your xTable need to act differently when it's being used to populate a dropdown for a related key of some field? use this to do whatever.
    customContext?: xTableClientUsageCustomContextBase;
};


export interface SortModel {
    field: string,
    order: "asc" | "desc",
};

export interface RowInfo {
    name: string;
    description?: string;
    color?: ColorPaletteEntry | null;
};

export interface TableDesc {
    tableName: string;
    columns: FieldBase<unknown>[];
    localInclude: unknown, // the includes:{} clause for local items. generally returns some of the foreign members
    staticWhereClause?: unknown, // a *Where object applied to everything.
    viewPermission: Permission;
    editPermission: Permission;
    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    naturalOrderBy?: TAnyModel;
    clientLessThan?: (a: TAnyModel, b: TAnyModel) => boolean; // for performing client-side sorting (when ORDER BY can't cut it -- see EventNaturalOrderBy for more notes)
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.
};

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable implements TableDesc {
    tableName: string;
    columns: FieldBase<unknown>[];

    localInclude: unknown;
    staticWhereClause?: unknown; // a *Where object applied to everything.

    viewPermission: Permission;
    editPermission: Permission;

    pkMember: string;

    rowNameMember?: string;
    rowDescriptionMember?: string;
    naturalOrderBy?: TAnyModel;
    clientLessThan?: (a: TAnyModel, b: TAnyModel) => boolean; // for performing client-side sorting (when ORDER BY can't cut it -- see EventNaturalOrderBy for more notes)
    getParameterizedWhereClause?: (params: TAnyModel, clientIntention: xTableClientUsageContext) => (TAnyModel[] | false); // for overall filtering the query based on parameters.

    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;

    constructor(args: TableDesc) {
        Object.assign(this, args);

        // this CAN safely happen when clients refresh data
        //console.assert(!gAllTables[args.tableName]); // don't define a table multiple times. effectively singleton.

        gAllTables[args.tableName] = this;

        args.columns.forEach(field => {
            field.connectToTable(this);
        });
    }

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: TAnyModel, newItem: TAnyModel, mode: DB3RowMode): ValidateAndComputeDiffResult {
        const ret: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
            changes: {},
            errors: {},
            success: true,
            hasChanges: false,
        });
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;

            // clients are not required to provide values for all values. only care about fields which are in a or b.
            const a = oldItem[field.member];
            const b_raw = newItem[field.member];

            if (a === undefined && b_raw === undefined) {
                continue;
            }

            const b_parseResult = field.ValidateAndParse({ value: b_raw, row: newItem, mode }); // because `a` comes from the db, it's not necessary to validate it for the purpose of computing diff.

            if (!b_parseResult.success) {
                ret.success = false;
                ret.errors[field.member] = b_parseResult.errorMessage!;
                continue;
            }
            const b = b_parseResult.parsedValue;

            const a_isNully = ((a === null) || (a === undefined));
            const b_isNully = ((b === null) || (b === undefined));
            if (a_isNully && b_isNully) {
                // they are both null, therefore equal.
                continue;
            }
            if (a_isNully !== b_isNully) {
                // one is null, other is not. guaranteed change.
                ret.hasChanges = true;
                ret.changes[field.member] = [a, b];
                continue;
            }

            if (!field.isEqual(a, b)) {
                ret.hasChanges = true;
                ret.changes[field.member] = [a, b];
                continue;
            }
        }

        // console.log(`ValidateAndComputeDiff. old, new, result:`);
        // console.log(oldItem);
        // console.log(newItem);
        // console.log(ret);

        return ret;
    };

    GetQuickFilterWhereClauseExpression = (query: string) => { // takes a quick filter string, return an array of expressions to be OR'd together, like [ { name: { contains: q } }, { email: { contains: q } }, ]
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getQuickFilterWhereClause(query);
            if (clause) {
                ret.push(clause);
            }
        }
        return ret;
    };

    GetCustomWhereClauseExpression = (filterModel: TableClientSpecFilterModelCMDBExtras) => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getCustomFilterWhereClause(filterModel);
            if (clause) {
                ret.push(clause);
            }
        }
        return { AND: ret };
    };

    GetOverallWhereClauseExpression = (clientIntention: xTableClientUsageContext) => {
        const ret = [] as any[];
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            const clause = field.getOverallWhereClause(clientIntention);
            if (clause) {
                ret.push(clause);
            }
        }
        return { AND: ret };
    };

    getClientModel = (dbModel: TAnyModel, mode: DB3RowMode) => {
        const ret: TAnyModel = {};
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            field.ApplyDbToClient(dbModel, ret, mode);
        }
        return { ...dbModel, ...ret };
        //return ret;
    }

    getColumn = (name: string) => {
        return this.columns.find(c => c.member === name);
    }

    // create a new row object (no primary key etc)
    // to later be used by insertion.
    createNew = (clientIntention: xTableClientUsageContext) => {
        const ret = {};
        this.columns.forEach(field => {
            field.ApplyToNewRow(ret, clientIntention);
        });
        return ret;
    }
}

////////////////////////////////////////////////////////////////
export const gAllTables: { [key: string]: xTable } = {
    // populated at runtime. required in order for client to call an API, and the API able to access the same schema.
};

export const GetVisibilityWhereClause = (currentUser: UserWithRolesPayload, createdByUserIDColumnName: string) => ({
    OR: [
        {
            // current user has access to the specified visibile permission
            visiblePermissionId: { in: currentUser.role?.permissions.map(p => p.permissionId) }
        },
        {
            // private visibility and you are the creator
            AND: [
                { visiblePermissionId: null },
                { [createdByUserIDColumnName]: currentUser.id }
            ]
        }
    ]
});

