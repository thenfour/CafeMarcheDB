import { ColorPalette, ColorPaletteEntry } from "shared/color";
import { TAnyModel } from "shared/utils";
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

// for validation and client UI behavior.
export type StringFieldFormatOptions = "plain" | "email" | "markdown";

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
            default:
                throw new Error(`unknown string field format; columnname: ${args.columnName}`);
        }
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
        if (this.format === "email") {
            // https://stackoverflow.com/questions/46155/how-can-i-validate-an-email-address-in-javascript
            const validateEmail = (email) => {
                return String(email)
                    .toLowerCase()
                    .match(
                        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                    );
            };
            if (!validateEmail(val)) {
                return ErrorValidateAndParseResult("email not in the correct format", val);
            }
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
            fieldTableAssociation: "tableColumn",
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
            fieldTableAssociation: "tableColumn",
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

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        const dbVal: boolean | null = dbModel[this.member]; // db may have null values so need to coalesce
        clientModel[this.member] = dbVal || this.defaultValue;
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: boolean | null): ValidateAndParseResult<boolean | null> => {
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

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        // the "includes" clause already returns the correct structure for clients.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        // clients work with associations, even mock associations (where id is empty).
        // mutations don't require any of this info; associations are always with existing local & foreign items.
        // so basically we just need to reduce associations down to an update/mutate model.
        mutationModel[this.member] = clientModel[this.member].map(a => a[this.associationForeignIDMember]);
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: TAssociation[] | null): ValidateAndParseResult<TAssociation[] | null> => {
        // there's really nothing else to validate here. in theory you can make sure the IDs are valid but it should never be possible plus enforced by the db relationship.
        // therefore not worth the overhead / roundtrip / complexity.
        return SuccessfulValidateAndParseResult(val);
    };
};

export type DateTimeFieldGranularity = "year" | "day" | "minute";

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
    ValidateAndParse = (val: string | Date | null): ValidateAndParseResult<Date | null> => {
        if (val === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(val);
            }
            return ErrorValidateAndParseResult("field must be non-null", val);
        }
        if (typeof (val) === 'string') {
            // string to date conv.
            //const parseResult = Date.parse(val);
            const parsedDate = new Date(val);
            //  If called with an invalid date string, or if the date to be constructed will have a timestamp less than -8,640,000,000,000,000
            // or greater than 8,640,000,000,000,000 milliseconds, it returns an invalid date (a Date object whose toString() method
            // returns "Invalid Date" and valueOf() method returns NaN).
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
            if (isNaN(parsedDate.valueOf())) {
                return ErrorValidateAndParseResult("Not a valid date", val as unknown as (Date | null));
            }
            val = parsedDate;
        }
        if (val instanceof Date) {
            if (isNaN(val.valueOf())) {
                return ErrorValidateAndParseResult("Date is invalid", val as unknown as (Date | null));
            }
        }
        return SuccessfulValidateAndParseResult(val);
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
                // ymdhm[sm]
                return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDay() === b.getDay() && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
            default:
                throw new Error(`unknown granularity specified for column '${this.member}': ${this.granularity}`);
        }
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        console.assert(clientModel[this.member] instanceof Date);
        const vr = this.ValidateAndParse(clientModel[this.member]);
        mutationModel[this.member] = vr.parsedValue;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        console.assert(dbModel[this.member] instanceof Date);
        clientModel[this.member] = dbModel[this.member];
    }
};


