import { ColorPaletteEntry } from "shared/color";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/utils";


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

export type FieldAssociationWithTable = "tableColumn" | "associationRecord" | "foreignObject";

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

    // return either falsy, or an object like { name: { contains: query } }
    abstract getQuickFilterWhereClause: (query: string) => TAnyModel | boolean;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    abstract ValidateAndParse: (args: ValidateAndParseArgs<FieldDataType>) => ValidateAndParseResult<FieldDataType | null>;// => {

    // SANITIZED values are passed in. That means no nulls, and ValidateAndParse has already been called.
    abstract isEqual: (a: FieldDataType, b: FieldDataType) => boolean;

    abstract ApplyClientToDb: (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => void;
    abstract ApplyDbToClient: (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => void; // apply the value from db to client.
}


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
    viewPermission: Permission;
    editPermission: Permission;
    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;
    naturalOrderBy?: TAnyModel;
};

// we don't care about createinput, because updateinput is the same thing with optional fields so it's a bit too redundant.
export class xTable implements TableDesc {
    tableName: string;
    columns: FieldBase<unknown>[];

    localInclude: unknown;

    viewPermission: Permission;
    editPermission: Permission;

    defaultObject: TAnyModel;
    pkMember: string;

    rowNameMember?: string;
    rowDescriptionMember?: string;
    naturalOrderBy?: TAnyModel;

    createInsertModelFromString?: (input: string) => TAnyModel; // if omitted, then creating from string considered not allowed.
    getRowInfo: (row: TAnyModel) => RowInfo;

    constructor(args: TableDesc) {
        Object.assign(this, args);

        // this CAN safely happen when clients refresh data
        //console.assert(!gAllTables[args.tableName]); // don't define a table multiple times. effectively singleton.

        gAllTables[args.tableName] = this;

        this.defaultObject = {};
        args.columns.forEach(field => {
            this.defaultObject[field.member] = field.defaultValue;
        });
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

    getClientModel = (dbModel: TAnyModel, mode: DB3RowMode) => {
        const ret: TAnyModel = {};
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            field.ApplyDbToClient(dbModel, ret, mode);
        }
        return ret;
    }
}

////////////////////////////////////////////////////////////////
export const gAllTables: { [key: string]: xTable } = {
    // populated at runtime. required in order for client to call an API, and the API able to access the same schema.
};
