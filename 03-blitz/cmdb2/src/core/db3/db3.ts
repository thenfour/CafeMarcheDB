import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPalette } from "shared/color";
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
export interface FieldBaseArgs<FieldDataType> {
    fieldType: string;
    member: string;
    label: string;
    defaultValue: FieldDataType | null;
}

export abstract class FieldBase<FieldDataType> {
    fieldType: string;
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
    abstract ValidateAndParse: (val: FieldDataType | null) => ValidateAndParseResult<FieldDataType | null>;// => {

    abstract isEqual: (a: FieldDataType, b: FieldDataType) => boolean;

    abstract ApplyClientToDb: (clientModel: TAnyModel, mutationModel: TAnyModel) => void;
    abstract ApplyDbToClient: (dbModel: TAnyModel, clientModel: TAnyModel) => void; // apply the value from db to client.
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

        this.defaultObject = {};
        args.columns.forEach(field => {
            this.defaultObject[field.member] = field.defaultValue;
        });
        args.columns.forEach(field => {
            field.connectToTable(this);
        });
    }

    // returns an object describing changes and validation errors.
    ValidateAndComputeDiff(oldItem: TAnyModel, newItem: TAnyModel): ValidateAndComputeDiffResult {
        const ret: ValidateAndComputeDiffResult = new ValidateAndComputeDiffResult({
            changes: {},
            errors: {},
            success: true,
            hasChanges: false,
        });
        console.log(`validate compute diff ...`);
        for (let i = 0; i < this.columns.length; ++i) {
            const field = this.columns[i]!;
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
            if (a_isNully === b_isNully) {
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
}



////////////////////////////////////////////////////////////////
export const gAllTables: { [key: string]: xTable } = {
    // populated at runtime. required in order for client to call an API, and the API able to access the same schema.
};

////////////////////////////////////////////////////////////////
// field types

export interface PKFieldArgs {
    columnName: string;
};

export class PKField extends FieldBase<number> {
    constructor(args: PKFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "PKField",
            defaultValue: null,
            label: args.columnName,
        });
    }

    // field child classes impl this to get established. for example pk fields will set the table's pk here.
    connectToTable = (table: xTable) => {
        table.pkMember = this.member;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    // for pk id fields, there should never be any changes. but it is required to pass into update/delete/whatever so just pass it always.
    ValidateAndParse = (val: number | null): ValidateAndParseResult<number | null> => {
        const ret: ValidateAndParseResult<number | null> = {
            success: true,
            parsedValue: val,
            errorMessage: "",
        };
        return ret;
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        // pkid is not present in the mutations. it's passed as a separate param automatically by client.
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        clientModel[this.member] = dbModel[this.member];
    }
}

export interface GenericStringFieldArgs {
    columnName: string;
    caseSensitive: boolean;
    allowNull: boolean;
    minLength: number;
};

export class GenericStringField extends FieldBase<string> {

    caseSensitive: boolean;
    allowNull: boolean;

    constructor(args: GenericStringFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "GenericStringField",
            defaultValue: args.allowNull ? null : "",
            label: args.columnName,
        });
        this.caseSensitive = args.caseSensitive;
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    // initField = (table: xTable, fieldName: string) => {
    //     this.member = fieldName;
    //     this.label = fieldName;
    //     table.pkMember = fieldName;
    // }; // field child classes impl this to get established. for example pk fields will set the table's pk here.

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

    isEqual = (a: string, b: string) => {
        if (this.caseSensitive) {
            return a === b;
        }
        return a.toLowerCase() === b.toLowerCase();
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        clientModel[this.member] = dbModel[this.member];
    }
};


export interface GenericIntegerFieldArgs {
    columnName: string;
    allowNull: boolean;
};

export class GenericIntegerField extends FieldBase<number> {

    allowNull: boolean;

    constructor(args: GenericIntegerFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "GenericIntegerField",
            defaultValue: args.allowNull ? null : 0,
            label: args.columnName,
        });
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    // initField = (table: xTable, fieldName: string) => {
    //     this.member = fieldName;
    //     this.label = fieldName;
    //     table.pkMember = fieldName;
    // }; // field child classes impl this to get established. for example pk fields will set the table's pk here.

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: number | null): ValidateAndParseResult<number | null> => {
        // val should be coerced into number, convert to integer.
        if (val == null) {
            return {
                parsedValue: null,
                success: this.allowNull,
                errorMessage: this.allowNull ? "" : "field is required; got null instead.",
            };
        }
        if (typeof val === 'string') {
            const s = (val as string).trim();
            if (this.allowNull && s === '') {
                return { // treat empty strings as null (maybe not always desirable?)
                    parsedValue: null,
                    success: true,
                    errorMessage: "",
                };
            }
            const i = parseInt(s, 10);
            if (isNaN(i)) {
                return {
                    parsedValue: null,
                    success: false,
                    errorMessage: "Input string was not convertible to integer",
                };
            }
            val = i;
        }
        // todo here check other constraints?
        return {
            parsedValue: val,
            success: true,
            errorMessage: "",
        };
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        clientModel[this.member] = dbModel[this.member];
    }
};


// this field demonstrates the ability to expose raw db values as structures.
// here the db value is a string, but the exposed value is a ColorPaletteEntry.
// 
// this means the datagrid row model has a ColorPaletteEntry, NOT a string. not both.
// this is the gateway to doing foreign key items.
export interface ColorFieldArgs {
    columnName: string;
    allowNull: boolean;
    palette: ColorPalette;
};

export class ColorField extends FieldBase<ColorPaletteEntry> {
    allowNull: boolean;
    palette: ColorPalette;

    constructor(args: ColorFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "ColorField",
            defaultValue: args.allowNull ? null : args.palette.defaultEntry,
            label: args.columnName,
        });
        this.allowNull = args.allowNull;
        this.palette = args.palette;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: ColorPaletteEntry, b: ColorPaletteEntry) => {
        if (!a || !b) {
            console.log(`yo null`);
        }
        return a.value === b.value;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        const dbVal: string | null = dbModel[this.member];
        clientModel[this.member] = this.palette.findColorPaletteEntry(dbVal);
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        const dbVal: ColorPaletteEntry | null = clientModel[this.member];
        mutationModel[this.member] = (dbVal?.value) || null;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: ColorPaletteEntry | null): ValidateAndParseResult<ColorPaletteEntry | null> => {
        if (val == null) {
            return {
                parsedValue: null,
                success: this.allowNull,
                errorMessage: this.allowNull ? "" : "field is required; got null instead.",
            };
        }
        if (this.palette.findColorPaletteEntry(val.value) == null) {
            // not found in the palette.
            return {
                parsedValue: null,
                success: false,
                errorMessage: "Not found in palette.",
            };
        }
        return {
            parsedValue: val,
            success: true,
            errorMessage: "",
        };
    };

};


////////////////////////////////////////////////////////////////
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
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
    ]
});

const InstrumentTagInclude: Prisma.InstrumentTagInclude = {
    instruments: true,
};

export const xInstrumentTag = new xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    localInclude: InstrumentTagInclude,
    tableName: "instrumentTag",
    columns: [
        new PKField({ columnName: "id" }),
        new GenericStringField({
            columnName: "text",
            allowNull: false,
            caseSensitive: true,
            minLength: 1,
        }),
        new GenericIntegerField({
            columnName: "sortOrder",
            allowNull: false,
        }),
        new ColorField({
            columnName: "color",
            allowNull: true,
            palette: gGeneralPalette,
        }),
        // new ConstEnumField({
        //     columnName: "significance",
        //     allowNull: true,
        // }),
    ]
});
