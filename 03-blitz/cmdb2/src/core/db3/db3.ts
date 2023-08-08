import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { KeysOf, TAnyModel } from "shared/utils";

// server-side code for db schema expression.
// this is meant to describe behaviors of the schema that we need from code but can't get from Prisma.* directly.
// for example:
// - validation of fields, whether they're nullable or not, case sensitivity
// - which items get included in queries (include clause)
// - permissions required
// - default values

////////////////////////////////////////////////////////////////
// the mutation needs to be able to access the xtable in order to
// validate etc.
export interface MutatorInput {
    tableName: string;
    deleteId?: number;
    insertModel?: TAnyModel;
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
    where: TAnyModel;
    orderBy: TAnyModel;
};

////////////////////////////////////////////////////////////////
export interface ValidateAndParseResult<FieldType> {
    success: boolean;
    errorMessage?: string;
    parsedValue: FieldType; // implementer should set this to the value to be actually used (after zod parse)
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

export const EmptyValidateAndComputeDiffResult: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({});


////////////////////////////////////////////////////////////////

export abstract class FieldBase<FieldDataType> {
    fieldType: string;
    member: string;
    label: string;
    defaultValue: FieldDataType | null;

    constructor(fieldName: string, fieldType: string) {
        this.fieldType = fieldType;
        this.member = fieldName;
        //console.assert(!gAllColumnTypes[fieldType]); // don't define a table multiple times. effectively singleton.
        //gAllColumnTypes[fieldType] = this;
    };

    abstract initField: (table: xTable, fieldName: string) => void; // field child classes impl this to get established. for example pk fields will set the table's pk here.

    // return either falsy, or an object like { name: { contains: query } }
    abstract getQuickFilterWhereClause: (query: string) => TAnyModel | boolean;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    abstract ValidateAndParse: (val: FieldDataType | null) => ValidateAndParseResult<FieldDataType | null>;// => {
    // if (!this.zodSchema) {
    //     // no schema = no validation
    //     return {
    //         parsedValue: val,
    //         success: true,
    //         errorMessage: "",
    //     };
    // }
    // const parseResult = this.zodSchema.safeParse(val) as any; // for some reason some fields are missing from the type, so cast as any.
    // if (this.logParseResult) {
    //     console.log(`parse result for ${this.member}`);
    //     console.log(parseResult);
    // }
    // const ret: ValidateAndParseResult<FieldType> = {
    //     success: parseResult.success,
    //     errorMessage: parseResult.error && parseResult.error.flatten().formErrors.join(", "),
    //     parsedValue: parseResult.data,
    // };
    //return ret;
    //};
}


export interface SortModel {
    field: string,
    order: "asc" | "desc",
};

export interface TableDesc {
    tableName: string;
    columns: FieldBase<unknown>[];
    localInclude: unknown, // the includes:{} clause for local items. generally returns some of the foreign members
    viewPermission: Permission;
    editPermission: Permission;
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

    constructor(args: TableDesc) {
        Object.assign(this, args);

        console.assert(!gAllTables[args.tableName]); // don't define a table multiple times. effectively singleton.

        gAllTables[args.tableName] = this;

        this.defaultObject = Object.fromEntries(Object.entries(args.columns).map(([fieldName, field]) => {
            return [fieldName, field.defaultValue];
        }));

        for (const [fieldName, field] of Object.entries(args.columns)) {
            field.initField(this, fieldName);
        }
    }

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: TAnyModel, newItem: TAnyModel): ValidateAndComputeDiffResult {
        const ret: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
            changes: {},
            errors: {},
            success: true,
            hasChanges: false,
        });
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
            // if (!field.isEditable) {
            //     continue;
            // }
            const a = oldItem[field.member];
            const b_raw = newItem[field.member];
            const b_parseResult = field.ValidateAndParse(b_raw); // because `a` comes from the db, it's not necessary to validate it for the purpose of computing diff.

            if (!b_parseResult.success) {
                ret.success = false;
                ret.errors[field.member] = b_parseResult.errorMessage!;
                continue;
            }
            const b = b_parseResult.parsedValue;

            const a_isNully = ((a === null) || (a === undefined));
            const b_isNully = ((b === null) || (b === undefined));
            if (a_isNully !== b_isNully) {
                // one is null, other is not. guaranteed 
                ret.hasChanges = true;
                ret.changes[field.member] = [a, b];
            }

            // // in order to support fk, we should also pass in the fkid members.
            // if (field.fkidMember) {
            //     if (!field.isEqual(a, b)) {
            //         ret.hasChanges = true;
            //         ret.changes[field.member] = [a, b];
            //         const a_fkid = oldItem[field.fkidMember];
            //         const b_fkid = newItem[field.fkidMember];
            //         ret.changes[field.fkidMember] = [a_fkid, b_fkid];
            //     }
            // } else {
            //     if (!field.isEqual(a, b)) {
            //         ret.hasChanges = true;
            //         ret.changes[field.member] = [a, b];
            //     }
            // }
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
}



////////////////////////////////////////////////////////////////
export const gAllTables: { [key: string]: xTable } = {
    // populated at runtime
};

// export const gAllColumnTypes: { [key: string]: FieldBase<unknown> } = {
//     // populated at runtime
// };


////////////////////////////////////////////////////////////////
// field types

export interface PKFieldArgs {
    columnName: string;
};

export class PKField extends FieldBase<number> {
    constructor(args: PKFieldArgs) {
        super(args.columnName, "PKField");
    }

    initField = (table: xTable, fieldName: string) => {
        this.member = fieldName;
        this.label = fieldName;
        table.pkMember = fieldName;
    }; // field child classes impl this to get established. for example pk fields will set the table's pk here.

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        // return { [this.member]: { contains: query } } as WhereInput;
        return { [this.member]: { equals: query } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: number | null): ValidateAndParseResult<number | null> => {
        const ret: ValidateAndParseResult<number | null> = {
            success: false,
            parsedValue: val,
            errorMessage: "pk fields are not editable",
        };
        return ret;
    };
}

export interface GenericStringFieldArgs {
    columnName: string;
    caseSensitive: boolean,
    minLength: number,
};

export class GenericStringField extends FieldBase<string> {
    constructor(args: GenericStringFieldArgs) {
        super(args.columnName, "GenericStringField");
        this.defaultValue = null;
        Object.assign(this, args);
    }

    initField = <RowModel,>(table: xTable, fieldName: string) => {
        this.member = fieldName;
        this.label = fieldName;
        table.pkMember = fieldName;
    }; // field child classes impl this to get established. for example pk fields will set the table's pk here.

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: string | null): ValidateAndParseResult<string | null> => {
        const ret: ValidateAndParseResult<string | null> = {
            success: true,
            parsedValue: val,
            errorMessage: "",
        };
        return ret;
    };
};

////////////////////////////////////////////////////////////////
const InstrumentLocalInclude: Prisma.InstrumentInclude = {
    functionalGroup: true,
    instrumentTags: {
        include: { tag: true }
    }
};

export const xInstrument = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentLocalInclude,
    tableName: "instrument",
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            caseSensitive: true,
            minLength: 1,
        }),
    ],
});

const InstrumentFunctionalGroupInclude: Prisma.InstrumentFunctionalGroupInclude = {
    instruments: true,
};

export const xInstrumentFunctionalGroup = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentFunctionalGroupInclude,
    tableName: "instrumentFunctionalGroup",
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "name",
            caseSensitive: true,
            minLength: 1,
        }),
        new GenericStringField({
            columnName: "description",
            caseSensitive: true,
            minLength: 1,
        }),
        // sort order
    ]
});

// todo: assert that keys / tablenames are the same
