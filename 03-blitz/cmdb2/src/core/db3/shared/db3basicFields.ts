import db, { Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPalette } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, InstrumentTagSignificance, KeysOf, TAnyModel } from "shared/utils";
import { ErrorValidateAndParseResult, FieldBase, SuccessfulValidateAndParseResult, ValidateAndParseResult, xTable } from "./db3core";

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
        return false;// don't filter on pk id. { [this.member]: { contains: query } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    // for pk id fields, there should never be any changes. but it is required to pass into update/delete/whatever so just pass it always.
    ValidateAndParse = (val: string | number | null): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult(val);
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
    doTrim: boolean;
};

export class GenericStringField extends FieldBase<string> {
    caseSensitive: boolean;
    allowNull: boolean;
    minLength: number;
    doTrim: boolean;

    constructor(args: GenericStringFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "GenericStringField",
            defaultValue: args.allowNull ? null : "",
            label: args.columnName,
        });
        this.caseSensitive = args.caseSensitive;
        this.allowNull = args.allowNull;
        this.minLength = args.minLength;
        this.doTrim = args.doTrim;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ValidateAndParse = (val: string | null): ValidateAndParseResult<string | null> => {
        if (val === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(val);
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        if (typeof val !== 'string') {
            return ErrorValidateAndParseResult("field is of unknown type", val);
        }
        if (this.doTrim) {
            val = val.trim();
        }
        if (val.length < this.minLength) {
            return ErrorValidateAndParseResult("minimum length not satisfied", val);
        }
        return SuccessfulValidateAndParseResult(val);
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

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        const r = this.ValidateAndParse(query);
        if (!r.success) return false;
        return { [this.member]: { equals: r.parsedValue } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: string | number | null): ValidateAndParseResult<number | null> => {
        if (val === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(val);
            }
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        // val should be coerced into number, convert to integer.
        if (typeof val === 'string') {
            const s = (val as string).trim();
            if (this.allowNull && s === '') {
                return SuccessfulValidateAndParseResult(null);
            }
            const i = parseInt(s, 10);
            if (isNaN(i)) {
                return ErrorValidateAndParseResult("Input string was not convertible to integer", val as (string | number));
            }
            val = i;
        }
        // todo here check other constraints like min/max whatever
        return SuccessfulValidateAndParseResult(val);
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        const vr = this.ValidateAndParse(clientModel[this.member]);
        mutationModel[this.member] = vr.parsedValue;
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
        if (val === null && !this.allowNull) {
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        if (this.palette.findColorPaletteEntry(val?.value || null) == null) {
            return ErrorValidateAndParseResult("Not found in palette.", val);
        }
        return SuccessfulValidateAndParseResult(val);
    };

};


// a single select field where
// - the db value is a string (no relationship enforced)
// - the enum value is a const typescript key val object (not an 'enum' type, but rather a const MyEnum { val1: "val1", val2: "val2" })
export interface ConstEnumStringFieldArgs {
    columnName: string,
    options: TAnyModel,
    defaultValue: string | null;
    allowNull: boolean,
};

export class ConstEnumStringField extends FieldBase<string> {
    options: TAnyModel;
    defaultValue: string | null;
    allowNull: boolean;

    constructor(args: ConstEnumStringFieldArgs) {
        super({
            member: args.columnName,
            fieldType: "ConstEnumStringField",
            defaultValue: args.defaultValue,
            label: args.columnName,
        });
        this.options = args.options;
        this.defaultValue = args.defaultValue;
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: string, b: string) => {
        return a === b;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: string | null): ValidateAndParseResult<string | null> => {
        if (val === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(val);
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        // make sure val is actually a member of the enum.
        val = val!.trim();
        if (!Object.values(this.options).some(op => op === val)) {
            return ErrorValidateAndParseResult("unrecognized option", val);
        }
        return SuccessfulValidateAndParseResult(val);
    };

};

////////////////////////////////////////////////////////////////
// a single select field where the items are a db table with relation
// on client side, there is NO foreign key field (like instrumentId). Only the foreign object ('instrument').
export interface ForeignSingleFieldArgs<TForeign> {
    columnName: string; // "instrumentType"
    fkMember: string; // "instrumentTypeId"
    foreignTableSpec: xTable;
    //foreignPkMember: string; // "id" on instrumentType table.
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getForeignQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // quick filter but only for foreign object queries.
    doesItemExactlyMatchText: (item: TForeign, filterText: string) => boolean,
    createInsertModelFromString: (input: string) => Partial<TForeign>,
    allowInsertFromString: boolean;
};

export class ForeignSingleField<TForeign> extends FieldBase<TForeign> {
    fkMember: string;
    foreignTableSpec: xTable;
    //foreignPkMember: string;
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getForeignQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // quick filter but only for foreign object queries.
    doesItemExactlyMatchText: (item: TForeign, filterText: string) => boolean;
    createInsertModelFromString: (input: string) => Partial<TForeign>;
    allowInsertFromString: boolean;

    constructor(args: ForeignSingleFieldArgs<TForeign>) {
        super({
            member: args.columnName,
            fieldType: "ForeignSingleField",
            defaultValue: args.defaultValue,
            label: args.columnName,
        });
        this.fkMember = args.fkMember;
        this.allowNull = args.allowNull;
        this.defaultValue = args.defaultValue;
        this.foreignTableSpec = args.foreignTableSpec;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        this.getForeignQuickFilterWhereClause = args.getForeignQuickFilterWhereClause;
        this.doesItemExactlyMatchText = args.doesItemExactlyMatchText;
        this.createInsertModelFromString = args.createInsertModelFromString;
        this.allowInsertFromString = args.allowInsertFromString;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: TForeign, b: TForeign) => {
        return a[this.foreignTableSpec.pkMember] === b[this.foreignTableSpec.pkMember];
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        // leaves behind the fk id.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        // mutations want ONLY the id, not the object.
        mutationModel[this.fkMember] = clientModel[this.member][this.foreignTableSpec.pkMember];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: TForeign | null): ValidateAndParseResult<TForeign | null> => {
        if (val === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(val);
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        // there's really nothing else to validate here.
        return SuccessfulValidateAndParseResult(val);
    };

};




