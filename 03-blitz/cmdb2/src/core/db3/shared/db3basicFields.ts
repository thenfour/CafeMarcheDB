import { ColorPalette, ColorPaletteEntry, ColorPaletteList, gGeneralPaletteList } from "shared/color";
import { TAnyModel } from "shared/utils";
import { DB3RowMode, ErrorValidateAndParseResult, FieldBase, SuccessfulValidateAndParseResult, ValidateAndParseArgs, ValidateAndParseResult, xTable } from "./db3core";

////////////////////////////////////////////////////////////////
// field types

export interface PKFieldArgs {
    columnName: string;
};

export class PKField extends FieldBase<number> {
    constructor(args: PKFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
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
    ValidateAndParse = (val: ValidateAndParseArgs<number>): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult(val.value);
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        // pkid is not present in the mutations. it's passed as a separate param automatically by client.
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }
}

// for validation and client UI behavior.
export type StringFieldFormatOptions = "plain" | "email" | "markdown" | "title";

export interface GenericStringFieldArgs {
    columnName: string;
    format: StringFieldFormatOptions;
    allowNull: boolean;
    // minLength?: number;
    caseSensitive?: boolean;
    // doTrim?: boolean;
};

export class GenericStringField extends FieldBase<string> {
    caseSensitive: boolean;
    allowNull: boolean;
    minLength: number;
    doTrim: boolean;
    format: StringFieldFormatOptions;

    constructor(args: GenericStringFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : "",
            label: args.columnName,
        });

        this.format = args.format;
        this.allowNull = args.allowNull;

        switch (args.format) {
            case "email":
                this.minLength = 1;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            case "markdown":
                this.minLength = 0;
                this.doTrim = false; // trailing whitespace is normal on long text entries.
                this.caseSensitive = args.caseSensitive || true;
                break;
            case "plain":
                this.minLength = 0;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            case "title":
                this.minLength = 1;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            default:
                throw new Error(`unknown string field format; columnname: ${args.columnName}`);
        }
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ValidateAndParse = ({ value, ...args }: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null> => {
        if (value === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(value);
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        if (typeof value !== 'string') {
            return ErrorValidateAndParseResult("field is of unknown type", value);
        }
        if (this.doTrim) {
            value = value.trim();
        }
        if (value.length < this.minLength) {
            return ErrorValidateAndParseResult("minimum length not satisfied", value);
        }
        if (this.format === "email") {
            // https://stackoverflow.com/questions/46155/how-can-i-validate-an-email-address-in-javascript
            const validateEmail = (email) => {
                return String(email)
                    .toLowerCase()
                    .match(
                        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                    );
            };
            if (!validateEmail(value)) {
                return ErrorValidateAndParseResult("email not in the correct format", value);
            }
        }
        return SuccessfulValidateAndParseResult(value);
    };

    isEqual = (a: string, b: string) => {
        if (this.doTrim) {
            a = a.trim();
            b = b.trim();
        }
        if (!this.caseSensitive) {
            a = a.toLowerCase();
            b = b.toLowerCase();
        }
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        if (dbModel[this.member] === undefined) return;
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
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : 0,
            label: args.columnName,
        });
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        const r = this.ValidateAndParse({ value: query, row: {}, mode: "view" }); // passing empty row because it's not used by this class.
        if (!r.success) return false;
        return { [this.member]: { equals: r.parsedValue } };
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value }: ValidateAndParseArgs<string | number>): ValidateAndParseResult<number | null> => {
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(value);
            }
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        // val should be coerced into number, convert to integer.
        if (typeof value === 'string') {
            const s = (value as string).trim();
            if (this.allowNull && s === '') {
                return SuccessfulValidateAndParseResult(null);
            }
            const i = parseInt(s, 10);
            if (isNaN(i)) {
                return ErrorValidateAndParseResult("Input string was not convertible to integer", value as (string | number));
            }
            value = i;
        }
        // todo here check other constraints like min/max whatever
        return SuccessfulValidateAndParseResult(value);
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        const vr = this.ValidateAndParse({ value: clientModel[this.member], row: clientModel, mode });
        mutationModel[this.member] = vr.parsedValue;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
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
    palette: ColorPaletteList;
};

export class ColorField extends FieldBase<ColorPaletteEntry> {
    allowNull: boolean;
    palette: ColorPaletteList;

    constructor(args: ColorFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : args.palette.defaultEntry,
            label: args.columnName,
        });
        this.allowNull = args.allowNull;
        this.palette = args.palette;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: ColorPaletteEntry, b: ColorPaletteEntry) => {
        return a.id === b.id;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;// { [this.member]: { contains: query } };
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const dbVal: string | null = dbModel[this.member];
        clientModel[this.member] = this.palette.findEntry(dbVal);
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        const val: ColorPaletteEntry | null = clientModel[this.member];
        mutationModel[this.member] = (val?.id) || null;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value }: ValidateAndParseArgs<ColorPaletteEntry>): ValidateAndParseResult<ColorPaletteEntry | null> => {
        if (value === null) {//&& !this.allowNull) {
            if (this.allowNull)
                return SuccessfulValidateAndParseResult(value);
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        if (this.palette.findEntry(value?.id || null) == null) {
            return ErrorValidateAndParseResult("Not found in palette.", value);
        }
        return SuccessfulValidateAndParseResult(value);
    };

};

// booleans are simple checkboxes; therefore null is not supported.
// for null support use a radio / multi select style field.
export interface BoolFieldArgs {
    columnName: string;
    defaultValue: boolean;
};

export class BoolField extends FieldBase<boolean> {
    constructor(args: BoolFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            label: args.columnName,
        });
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: boolean, b: boolean) => {
        return a === b;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { equals: query } };
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const dbVal: boolean | null = dbModel[this.member]; // db may have null values so need to coalesce
        clientModel[this.member] = dbVal || this.defaultValue;
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: ValidateAndParseArgs<boolean>): ValidateAndParseResult<boolean | null> => {
        return SuccessfulValidateAndParseResult(val.value);
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
            fieldTableAssociation: "tableColumn",
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

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value }: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null> => {
        if (value === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(value);
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        // make sure val is actually a member of the enum.
        value = value!.trim();
        if (!Object.values(this.options).some(op => op === value)) {
            return ErrorValidateAndParseResult(`unrecognized option '${value}'`, value);
        }
        return SuccessfulValidateAndParseResult(value);
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
    defaultValue?: TForeign | null;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    //getForeignQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // quick filter but only for foreign object queries.
    doesItemExactlyMatchText?: (item: TForeign, filterText: string) => boolean,
    //createInsertModelFromString: (input: string) => Partial<TForeign>,
    //allowInsertFromString: boolean;
    // getChipCaption?: (value: TForeign) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipDescription?: (value: TForeign) => string;
    // getChipColor?: (value: TForeign) => ColorPaletteEntry;
};

export class ForeignSingleField<TForeign> extends FieldBase<TForeign> {
    fkMember: string;
    foreignTableSpec: xTable;
    //foreignPkMember: string;
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    //getForeignQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // quick filter but only for foreign object queries.
    doesItemExactlyMatchText: (item: TForeign, filterText: string) => boolean;
    //createInsertModelFromString: (input: string) => Partial<TForeign>;
    //allowInsertFromString: boolean;
    // getChipCaption?: (value: TForeign) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipDescription?: (value: TForeign) => string;
    // getChipColor?: (value: TForeign) => ColorPaletteEntry;

    constructor(args: ForeignSingleFieldArgs<TForeign>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "foreignObject",
            defaultValue: args.defaultValue || null,
            label: args.columnName,
        });

        // does default behavior of case-insensitive, trimmed compare.
        const itemExactlyMatches_defaultImpl = (value: TForeign, filterText: string): boolean => {
            //console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
            // if (!this.getChipCaption) {
            //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On ForeignSingleField ${args.columnName}`);
            // }
            //return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
            const rowInfo = this.foreignTableSpec.getRowInfo(value as TAnyModel);
            return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        }

        this.fkMember = args.fkMember;
        this.allowNull = args.allowNull;
        this.defaultValue = args.defaultValue || null;
        this.foreignTableSpec = args.foreignTableSpec;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        //this.getForeignQuickFilterWhereClause = args.getForeignQuickFilterWhereClause;
        this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
    }

    get allowInsertFromString() {
        return !!this.foreignTableSpec.createInsertModelFromString;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: TForeign, b: TForeign) => {
        return a[this.foreignTableSpec.pkMember] === b[this.foreignTableSpec.pkMember];
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // leaves behind the fk id.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // mutations want ONLY the id, not the object.
        const foreign = clientModel[this.member];
        if (foreign == null) {
            mutationModel[this.fkMember] = null;
            return;
        }
        mutationModel[this.fkMember] = foreign[this.foreignTableSpec.pkMember];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value }: ValidateAndParseArgs<TForeign>): ValidateAndParseResult<TForeign | null> => {
        if (value === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(value);
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        // there's really nothing else to validate here.
        return SuccessfulValidateAndParseResult(value);
    };

};



////////////////////////////////////////////////////////////////
// tags fields are arrays of associations
// on client side, there is NO foreign key field (like instrumentId). Only the foreign object ('instrument').
export interface TagsFieldArgs<TAssociation> {
    columnName: string; // "instrumentType"
    associationTableSpec: xTable;
    foreignTableSpec: xTable;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    doesItemExactlyMatchText?: (item: TAssociation, filterText: string) => boolean;

    // when we get a list of tag options, they're foreign models (tags).
    // but we need our list to be association objects (itemTagAssocitaion)
    createMockAssociation?: (row: TAnyModel, item: TAnyModel) => TAssociation;

    // mutations needs to where:{} to find associations for local rows. so "getForeignID()" is not going to work.
    // better to 
    //getForeignID: (value: TAssociation) => any; // return a unique key for the given association. this sorta feels redundant (with all this metadata can't core deduce this?) but we don't have enough info for this. (which field of association represents the foreign object?)
    //getLocalID:
    associationLocalIDMember: string;
    associationForeignIDMember: string;
    associationLocalObjectMember: string;
    associationForeignObjectMember: string;

    // getChipCaption?: (value: TAssociation) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipDescription?: (value: TAssociation) => string;
    // getChipColor?: (value: TAssociation) => ColorPaletteEntry;
};

export class TagsField<TAssociation> extends FieldBase<TAssociation[]> {
    localTableSpec: xTable;
    associationTableSpec: xTable;
    foreignTableSpec: xTable;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.

    createMockAssociation: (row: TAnyModel, foreignObject: TAnyModel) => TAssociation;
    doesItemExactlyMatchText: (item: TAssociation, filterText: string) => boolean;
    // getChipCaption?: (value: TAssociation) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipColor?: (value: TAssociation) => ColorPaletteEntry;
    // getChipDescription?: (value: TAssociation) => string;

    associationLocalIDMember: string;
    associationForeignIDMember: string;
    associationLocalObjectMember: string;
    associationForeignObjectMember: string;

    get allowInsertFromString() {
        return !!this.foreignTableSpec.createInsertModelFromString;
    }

    constructor(args: TagsFieldArgs<TAssociation>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "associationRecord",
            defaultValue: [],
            label: args.columnName,
        });

        // does default behavior of case-insensitive, trimmed compare.
        const itemExactlyMatches_defaultImpl = (value: TAssociation, filterText: string): boolean => {
            // console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
            // if (!this.getChipCaption) {
            //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On TagsField ${args.columnName}`);
            // }
            // return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
            const rowInfo = this.associationTableSpec.getRowInfo(value as TAnyModel);
            return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        }

        this.associationTableSpec = args.associationTableSpec;
        this.foreignTableSpec = args.foreignTableSpec;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        this.createMockAssociation = args.createMockAssociation || this.createMockAssociation_DefaultImpl;
        this.associationForeignIDMember = args.associationForeignIDMember;
        this.associationLocalIDMember = args.associationLocalIDMember;
        this.associationLocalObjectMember = args.associationLocalObjectMember;
        this.associationForeignObjectMember = args.associationForeignObjectMember;
        this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

    createMockAssociation_DefaultImpl = (row: TAnyModel, foreignObject: TAnyModel): TAssociation => {
        return {
            [this.associationTableSpec.pkMember]: -1, // an ID that we can assume is never valid or going to match an existing. we could also put null which may be more accurate but less safe in terms of query compatibiliy.
            [this.associationLocalObjectMember]: row, // local object
            [this.associationLocalIDMember]: row[this.localTableSpec.pkMember], // local ID
            [this.associationForeignObjectMember]: foreignObject, // local object
            [this.associationForeignIDMember]: foreignObject[this.foreignTableSpec.pkMember], // foreign ID
        } as TAssociation /* trust me */;
    };

    isEqual = (a: TAssociation[], b: TAssociation[]) => {
        console.assert(Array.isArray(a));
        console.assert(Array.isArray(b));
        if (a.length != b.length) {
            return false; // shortcut
        }
        // ok they are equal length arrays; check all items
        const avalues = a.map(x => x[this.associationTableSpec.pkMember]);
        const bvalues = b.map(x => x[this.associationTableSpec.pkMember]);
        avalues.sort();
        bvalues.sort();
        for (let i = 0; i < avalues.length; ++i) {
            if (avalues[i] !== bvalues[i]) return false;
        }
        return true;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // the "includes" clause already returns the correct structure for clients.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // clients work with associations, even mock associations (where id is empty).
        // mutations don't require any of this info; associations are always with existing local & foreign items.
        // so basically we just need to reduce associations down to an update/mutate model.
        mutationModel[this.member] = clientModel[this.member].map(a => a[this.associationForeignIDMember]);
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: ValidateAndParseArgs<TAssociation[]>): ValidateAndParseResult<TAssociation[] | null> => {
        // there's really nothing else to validate here. in theory you can make sure the IDs are valid but it should never be possible plus enforced by the db relationship.
        // therefore not worth the overhead / roundtrip / complexity.
        return SuccessfulValidateAndParseResult(val.value);
    };
};

export type DateTimeFieldGranularity = "year" | "day" | "minute" | "second";

// this is specifically for fields which care about date + time, OR date-only.
// for date-only, the idea is that 2 fields are considered the same even if the time is different.
export interface DateTimeFieldArgs {
    columnName: string;
    allowNull: boolean;
    granularity: DateTimeFieldGranularity;
};

export class DateTimeField extends FieldBase<Date> {

    allowNull: boolean;
    granularity: DateTimeFieldGranularity;

    constructor(args: DateTimeFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : new Date(),
            label: args.columnName,
        });
        this.allowNull = args.allowNull;
        this.granularity = args.granularity;
    }

    connectToTable = (table: xTable) => { };

    // don't support quick filter on date fields
    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value }: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(value);
            }
            return ErrorValidateAndParseResult("field must be non-null", value);
        }
        if (typeof (value) === 'string') {
            // string to date conv.
            //const parseResult = Date.parse(val);
            const parsedDate = new Date(value);
            //  If called with an invalid date string, or if the date to be constructed will have a timestamp less than -8,640,000,000,000,000
            // or greater than 8,640,000,000,000,000 milliseconds, it returns an invalid date (a Date object whose toString() method
            // returns "Invalid Date" and valueOf() method returns NaN).
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
            if (isNaN(parsedDate.valueOf())) {
                return ErrorValidateAndParseResult("Not a valid date", value as unknown as (Date | null));
            }
            value = parsedDate;
        }
        if (value instanceof Date) {
            if (isNaN(value.valueOf())) {
                return ErrorValidateAndParseResult("Date is invalid", value as unknown as (Date | null));
            }
        }
        return SuccessfulValidateAndParseResult(value);
    };

    isEqual = (a: Date, b: Date) => {
        switch (this.granularity) {
            case "year":
                // y[mdhmsm]
                return a.getFullYear() === b.getFullYear();
            case "day":
                // ymd[hmsm]
                return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDay() === b.getDay();
            case "minute":
            case "second": // TODO
                // ymdhm[sm]
                return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDay() === b.getDay() && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
            default:
                throw new Error(`unknown granularity specified for column '${this.member}': ${this.granularity}`);
        }
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        //console.assert(clientModel[this.member] instanceof Date);
        const vr = this.ValidateAndParse({ value: clientModel[this.member], row: clientModel, mode });
        mutationModel[this.member] = vr.parsedValue;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const v = dbModel[this.member];
        if (v === null) {
            clientModel[this.member] = null;
            return;
        }
        console.assert(dbModel[this.member] instanceof Date);
        clientModel[this.member] = dbModel[this.member];
    }
};



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CreatedAtFieldArgs {
    columnName: string;
};

export class CreatedAtField extends FieldBase<Date> {
    constructor(args: CreatedAtFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: new Date(),
            label: args.columnName,
        });
    }

    connectToTable = (table: xTable) => { };

    // don't support quick filter on date fields
    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value, ...args }: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        // we don't care about the input; for creations just generate a new date always.
        if (args.mode === "new") {
            return SuccessfulValidateAndParseResult(new Date());
        }
        console.assert(value instanceof Date);
        return SuccessfulValidateAndParseResult(value);
    };

    isEqual = (a: Date, b: Date) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        const vr = this.ValidateAndParse({ value: clientModel[this.member], row: clientModel, mode });
        mutationModel[this.member] = vr.parsedValue;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        console.assert(dbModel[this.member] instanceof Date);
        clientModel[this.member] = dbModel[this.member];
    }
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// slug field is calculated from another field.
// it is calculated live during creation, but afterwards it's user-editable.

// https://gist.github.com/codeguy/6684588
export const slugify = (...args: (string | number)[]): string => {
    const value = args.join(' ')

    return value
        .normalize('NFD') // split an accented letter in the base letter and the acent
        .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 ]/g, '') // remove all chars not letters, numbers and spaces (to be replaced)
        .replace(/\s+/g, '-') // separator
}

export interface SlugFieldFieldArgs {
    columnName: string;
    sourceColumnName: string;
};

export class SlugField extends FieldBase<string> {
    sourceColumnName: string;

    constructor(args: SlugFieldFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: "",
            label: args.columnName,
        });
        this.sourceColumnName = args.sourceColumnName;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ValidateAndParse = (val: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null> => {
        let slugValue = val.value; // by default, for editing, allow users to enter a custom value.
        if (val.mode === "new") {
            // calculate the slug value
            const src = val.row[this.sourceColumnName];
            if (src == null) return ErrorValidateAndParseResult("required", "");
            if (typeof src !== 'string') return ErrorValidateAndParseResult("unknown type", "");
            slugValue = slugify(src);
        }

        if (slugValue == null) return ErrorValidateAndParseResult("required", "");
        if (typeof slugValue !== 'string') return ErrorValidateAndParseResult("unknown type", "");
        if (slugValue.length < 1) return ErrorValidateAndParseResult("required", "");
        return SuccessfulValidateAndParseResult(slugValue);
    };

    isEqual = (a: string, b: string) => {
        return a.toLowerCase() === b.toLowerCase();
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }
};





///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// higher-level conveniences
export const MakePlainTextField = (columnName: string) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: false,
        format: "plain",
    }));
export const MakeMarkdownTextField = (columnName: string) => (
    new GenericStringField({
        columnName,
        allowNull: false,
        format: "markdown",
    }));
export const MakeTitleField = (columnName: string) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: false,
        format: "title",
    }));

export const MakeIntegerField = (columnName: string) => (
    new GenericIntegerField({
        columnName,
        allowNull: false,
    }));

export const MakeColorField = (columnName: string) => (
    new ColorField({
        columnName,
        allowNull: true,
        palette: gGeneralPaletteList,
    }));

export const MakeSortOrderField = (columnName: string) => (
    new GenericIntegerField({
        columnName,
        allowNull: false,
    }));

export const MakeSignificanceField = (columnName: string, options: TAnyModel) => (
    new ConstEnumStringField({
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
    }));

export const MakeIconField = (columnName: string, options: TAnyModel) => (
    new ConstEnumStringField({
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
    }));

export const MakeSlugField = (columnName: string, sourceColumnName: string) => (
    new SlugField({
        columnName,
        sourceColumnName,
    })
);

export const MakeCreatedAtField = (columnName: string) => (
    new CreatedAtField({
        columnName
    })
);





