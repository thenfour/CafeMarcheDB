//
// field types:
//
// - PKField
// - GenericStringField
// - GenericIntegerField
// - ColorField
// - BoolField
// - ConstEnumStringField
// - ForeignSingleField
// - TagsField
// - DateTimeField
// - CreatedAtField
// - SlugField

// other places in code may also define more...
// - CalculatedEventDateRangeField


import { ColorPaletteEntry, ColorPaletteList, gGeneralPaletteList } from "shared/color";
import { TAnyModel } from "shared/utils";
import { ApplyIncludeFilteringToRelation, CMDBTableFilterModel, DB3RowMode, ErrorValidateAndParseResult, FieldBase, GetTableById, SuccessfulValidateAndParseResult, ValidateAndParseArgs, ValidateAndParseResult, xTable, xTableClientUsageContext } from "./db3core";
import { DateTimeRange, DateTimeRangeSpec } from "shared/time";

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

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;// don't filter on pk id. { [this.member]: { contains: query } };
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    // for pk id fields, there should never be any changes. but it is required to pass into update/delete/whatever so just pass it always.
    ValidateAndParse = (val: ValidateAndParseArgs<number>): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult(val.value);
    };
    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        // new rows don't have primary keys assigned yet; NOP
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
export type StringFieldFormatOptions = "plain" | "email" | "markdown" | "title" | "raw";

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
            case "raw":
                this.minLength = 0;
                this.doTrim = false;
                this.caseSensitive = true;
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

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

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

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
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

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

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

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
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

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const dbVal: string | null = dbModel[this.member];
        clientModel[this.member] = this.palette.findEntry(dbVal);
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        const val: ColorPaletteEntry | null = clientModel[this.member];
        mutationModel[this.member] = (val?.id) || null;
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
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

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
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

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

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
    foreignTableID: string; // for circular referencing don't force caller to use the xTable.
    allowNull: boolean;
    defaultValue?: TForeign | null;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    doesItemExactlyMatchText?: (item: TForeign, filterText: string) => boolean,
};

export class ForeignSingleField<TForeign> extends FieldBase<TForeign> {
    fkMember: string;
    foreignTableID: string;
    localTableSpec: xTable;
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    doesItemExactlyMatchText: (item: TForeign, filterText: string) => boolean;

    getForeignTableSchema = () => {
        return GetTableById(this.foreignTableID);
    };

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
            const rowInfo = this.getForeignTableSchema().getRowInfo(value as TAnyModel);
            return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        }

        this.fkMember = args.fkMember;
        this.allowNull = args.allowNull;
        this.defaultValue = args.defaultValue || null;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        //this.getForeignQuickFilterWhereClause = args.getForeignQuickFilterWhereClause;
        this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
    }

    get allowInsertFromString() {
        return !!this.getForeignTableSchema().createInsertModelFromString;
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

    isEqual = (a: TForeign, b: TForeign) => {
        return a[this.getForeignTableSchema().pkMember] === b[this.getForeignTableSchema().pkMember];
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => {
        // actually what is the play here? for a many-to-one relationship like this, when the foreign item is not accessibly by the current user
        // then we are forced to return null?
        // hm, well actually it's not possible to do this; there is no "where" clause on these types of relations.
        // which makes sense.
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // leaves behind the fk id.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // mutations want ONLY the id, not the object.
        const foreign = clientModel[this.member];
        if (foreign === undefined) return;
        if (foreign === null) {
            mutationModel[this.fkMember] = null;
            return;
        }
        mutationModel[this.fkMember] = foreign[this.getForeignTableSchema().pkMember];
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
    associationTableID: string;
    foreignTableID: string;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getCustomFilterWhereClause: (query: CMDBTableFilterModel) => TAnyModel | boolean;
    doesItemExactlyMatchText?: (item: TAssociation, filterText: string) => boolean;

    // when we get a list of tag options, they're foreign models (tags).
    // but we need our list to be association objects (itemTagAssocitaion)
    createMockAssociation?: (row: TAnyModel, item: TAnyModel) => TAssociation;

    // mutations needs to where:{} to find associations for local rows. so "getForeignID()" is not going to work.
    // better to 
    associationLocalIDMember: string;
    associationForeignIDMember: string;
    associationLocalObjectMember: string;
    associationForeignObjectMember: string;
};

export class TagsField<TAssociation> extends FieldBase<TAssociation[]> {
    localTableSpec: xTable;
    associationTableID: string;
    foreignTableID: string;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getCustomFilterWhereClause__: (query: CMDBTableFilterModel) => TAnyModel | boolean;

    createMockAssociation: (row: TAnyModel, foreignObject: TAnyModel) => TAssociation;
    doesItemExactlyMatchText: (item: TAssociation, filterText: string) => boolean;
    // getChipCaption?: (value: TAssociation) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipColor?: (value: TAssociation) => ColorPaletteEntry;
    // getChipDescription?: (value: TAssociation) => string;

    associationLocalIDMember: string;
    associationForeignIDMember: string;
    associationLocalObjectMember: string;
    associationForeignObjectMember: string;

    getAssociationTableShema = () => {
        return GetTableById(this.associationTableID);
    };
    getForeignTableShema = () => {
        return GetTableById(this.foreignTableID);
    };

    get allowInsertFromString() {
        return !!this.getForeignTableShema().createInsertModelFromString;
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
            const rowInfo = this.getAssociationTableShema().getRowInfo(value as TAnyModel);
            return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        }

        this.associationTableID = args.associationTableID;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        this.getCustomFilterWhereClause__ = args.getCustomFilterWhereClause;
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
        const ret = {
            [this.getAssociationTableShema().pkMember]: -1, // an ID that we can assume is never valid or going to match an existing. we could also put null which may be more accurate but less safe in terms of query compatibiliy.
            [this.associationLocalObjectMember]: row, // local object
            [this.associationLocalIDMember]: row[this.localTableSpec.pkMember], // local ID
            [this.associationForeignObjectMember]: foreignObject, // local object
            [this.associationForeignIDMember]: foreignObject[this.getForeignTableShema().pkMember], // foreign ID
        } as TAssociation /* trust me */;
        return ret;
    };

    isEqual = (a: TAssociation[], b: TAssociation[]) => {
        console.assert(Array.isArray(a));
        console.assert(Array.isArray(b));
        if (a.length != b.length) {
            return false; // shortcut
        }
        // ok they are equal length arrays; check all items
        const asst = this.getAssociationTableShema();
        const avalues = a.map(x => x[asst.pkMember]);
        const bvalues = b.map(x => x[asst.pkMember]);
        avalues.sort();
        bvalues.sort();
        for (let i = 0; i < avalues.length; ++i) {
            if (avalues[i] !== bvalues[i]) return false;
        }
        return true;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);
    getCustomFilterWhereClause = (query: CMDBTableFilterModel) => this.getCustomFilterWhereClause__(query);
    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    ApplyIncludeFiltering = async (include: TAnyModel, clientIntention: xTableClientUsageContext) => {
        await ApplyIncludeFilteringToRelation(include, this.member, this.localTableSpec.tableName, this.associationForeignObjectMember, this.foreignTableID, clientIntention);
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // the "includes" clause already returns the correct structure for clients.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // clients work with associations, even mock associations (where id is empty).
        // mutations don't require any of this info; associations are always with existing local & foreign items.
        // so basically we just need to reduce associations down to an update/mutate model.
        if (clientModel[this.member]) {
            mutationModel[this.member] = clientModel[this.member].map(a => a[this.associationForeignIDMember]);
        }
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (val: ValidateAndParseArgs<TAssociation[]>): ValidateAndParseResult<TAssociation[] | null> => {
        // there's really nothing else to validate here. in theory you can make sure the IDs are valid but it should never be possible plus enforced by the db relationship.
        // therefore not worth the overhead / roundtrip / complexity.
        return SuccessfulValidateAndParseResult(val.value);
    };
};


export interface EventStartsAtFieldArgs {
    columnName: string;

    allowNull: boolean;
};

export class EventStartsAtField extends FieldBase<Date> {

    allowNull: boolean;

    constructor(args: EventStartsAtFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : new Date(),
            label: "date/time",
        });
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    // don't support quick filter on date fields
    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;
    };
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;
    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

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

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: Date, b: Date) => {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDay() === b.getDay() &&
            a.getHours() === b.getHours() &&
            a.getMinutes() === b.getMinutes();
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
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };


    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = ({ value, ...args }: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        // we don't care about the input; for creations just generate a new date always.
        if (args.mode === "new") {
            return SuccessfulValidateAndParseResult(new Date());
        }
        console.assert(value instanceof Date);
        // if (!(value instanceof Date)) {
        //     debugger;
        // }
        return SuccessfulValidateAndParseResult(value);
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = new Date();
    };

    isEqual = (a: Date, b: Date) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        const vr = this.ValidateAndParse({ value: clientModel[this.member], row: clientModel, mode });
        mutationModel[this.member] = vr.parsedValue;
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
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
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

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

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
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
export const MakeNullableRawTextField = (columnName: string) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: true,
        format: "raw",
    }));
export const MakeRawTextField = (columnName: string) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: false,
        format: "raw",
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








export interface separateMutationValuesArgs {
    table: xTable;
    fields: TAnyModel;
};
export interface separateMutationValuesResult {
    associationFields: TAnyModel;
    localFields: TAnyModel;
};
export const separateMutationValues = ({ table, fields }: separateMutationValuesArgs) => {
    const ret: separateMutationValuesResult = {
        associationFields: {},
        localFields: {},
    };

    table.columns.forEach(column => {
        switch (column.fieldTableAssociation) {
            case "tableColumn":
                if (fields[column.member] !== undefined) {
                    ret.localFields[column.member] = fields[column.member];
                }
                break;
            case "foreignObject":
                // foreign objects come in with a different member than column.member (FK member, not object member)
                const typedColumn = column as ForeignSingleField<TAnyModel>;
                if (fields[typedColumn.fkMember] !== undefined) {
                    ret.localFields[typedColumn.fkMember] = fields[typedColumn.fkMember];
                }
                break;
            case "associationRecord":
                if (fields[column.member] !== undefined) {
                    ret.associationFields[column.member] = fields[column.member];
                }
                break;
            case "calculated":
                // strip calculated values from any mutation
                break;
            default:
                throw new Error(`unknown field table association; field:${column.member}`);
                break;
        }
    });


    // fields which are not known to the schema will be ignored / discarded by the result

    return ret;
};
