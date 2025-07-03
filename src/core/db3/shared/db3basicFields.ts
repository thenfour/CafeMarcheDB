
import { assert } from "blitz";
import { assertIsNumberArray } from "shared/arrayUtils";
import { ColorPaletteEntry, ColorPaletteList, gGeneralPaletteList, gSwatchColors } from "shared/color";
import { CoerceToBoolean, CoerceToNullableBoolean, CoerceToNumberOrNull } from "shared/utils";
import { CMDBTableFilterModel, CriterionQueryElements, DiscreteCriterion, DiscreteCriterionFilterType, EventFutureFilterExpression, EventPast60DaysFilterExpression, EventPastFilterExpression, EventRelevantFilterExpression, SearchResultsFacetOption, SearchResultsFacetQuery, SortQueryElements, TAnyModel } from "./apiTypes";
import { ApplyIncludeFilteringToRelation, DB3AuthSpec, DB3RowMode, ErrorValidateAndParseResult, FieldBase, GetTableById, SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult, UserWithRolesPayload, ValidateAndParseArgs, ValidateAndParseResult, createAuthContextMap_GrantAll, createAuthContextMap_PK, xTable, xTableClientUsageContext } from "./db3core";

// export type DB3AuthSpec = {
//     authMap: DB3AuthContextPermissionMap;
// } | {
//     _customAuth: (args: DB3AuthorizeAndSanitizeInput<TAnyModel>) => boolean;
// };


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// field types
export type GhostFieldArgs = {
    memberName: string;
} & DB3AuthSpec;

// sometimes you have a query containing a payload and you don't need to have a full FieldSpec for handling it. you just need to access its raw value as returned by the db.
// often something like a include:{...}
export class GhostField extends FieldBase<number> {

    table: xTable;

    constructor(args: GhostFieldArgs) {
        super({
            member: args.memberName,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            fieldTableAssociation: "tableColumn",
            defaultValue: null,
            specialFunction: undefined,
        });
    }

    connectToTable = (table: xTable) => { this.table = table; };

    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    ValidateAndParse = (val: ValidateAndParseArgs<number>): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult({ [this.member]: val.row[this.member] });
    };
    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
    };
    isEqual = (a: any, b: any) => {
        //assert(false, "ghost fields should not be doing validation.");
        return true;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        //assert(false, "ghost fields should not be applying to db model.");
        // let's allow it; case in point: song pinned file is ghost field and should be able to participate in typical updates.
        if (clientModel[this.member] === undefined) return;
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type PKFieldArgs = {
    columnName: string;
};// & DB3AuthSpec;

export class PKField extends FieldBase<number> {
    constructor(args: PKFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: null,
            authMap: createAuthContextMap_PK(),
            specialFunction: SqlSpecialColumnFunction.pk,
            _customAuth: null,
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
        return SuccessfulValidateAndParseResult({ [this.member]: val.row[this.member] });
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

    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => {
        // the only time we support searching by pk is when it's the only token in the qf, and then search for an exact match.
        if (quickFilterTokens.length !== 1) return null;
        if (!/^\d+$/.test(token)) return null; // must be a pure integer.
        return `(${this.member} = ${token})`;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type GenericIntegerFieldArgs = {
    columnName: string;
    allowNull: boolean;
    allowSearchingThisField?: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

export class GenericIntegerField extends FieldBase<number> {

    allowNull: boolean;
    allowSearchingThisField: boolean;

    constructor(args: GenericIntegerFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : 0,
            specialFunction: args.specialFunction,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
        this.allowNull = args.allowNull;
        this.allowSearchingThisField = CoerceToBoolean(args.allowSearchingThisField, true);
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string, clientIntention: xTableClientUsageContext): TAnyModel | false => {
        if (!this.allowSearchingThisField) return false;
        const queryAsNumber = CoerceToNumberOrNull(query);
        if (queryAsNumber === null) return false;
        const r = this.ValidateAndParse({ row: { [this.member]: queryAsNumber }, mode: "view", clientIntention }); // passing empty row because it's not used by this class.
        if (r.result !== "success") return false;
        return { [this.member]: { equals: r.values[this.member] } };
    };

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<string | number>): ValidateAndParseResult<number | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(objValue);
            }
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        // val should be coerced into number, convert to integer.
        if (typeof value === 'string') {
            const s = (value as string).trim();
            if (this.allowNull && s === '') {
                return SuccessfulValidateAndParseResult(objValue);
            }
            const i = parseInt(s, 10);
            if (isNaN(i)) {
                return ErrorValidateAndParseResult("Input string was not convertible to integer", objValue);
            }
            value = i;
        }
        // todo here check other constraints like min/max whatever
        return SuccessfulValidateAndParseResult(objValue);
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        if (clientModel[this.member] === undefined) return;
        const vr = this.ValidateAndParse({ row: clientModel, mode, clientIntention });
        mutationModel[this.member] = vr.values[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type DateTimeFieldArgs = {
    columnName: string;
    allowNull: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;

} & DB3AuthSpec;

export class DateTimeField extends FieldBase<Date> {

    allowNull: boolean;

    constructor(args: DateTimeFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : new Date(),
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
        });
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string, clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        let value = args.row[this.member];
        if (value === undefined) return UndefinedValidateAndParseResult();
        let objValue = { [this.member]: value };
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(objValue);
            }
            return ErrorValidateAndParseResult("field is required", objValue);
        }

        if (typeof value === 'object') // assume date
        {
            const vad = (value as Date);
            if (!vad.valueOf) {
                return ErrorValidateAndParseResult("Input is of unknown type; expected date", objValue);
            }
            if (isNaN((value as Date).valueOf())) {
                return ErrorValidateAndParseResult("Input is an invalid date", objValue);
            }
        }
        else if (typeof value === 'string') {
            const s = (value as string).trim();
            if (this.allowNull && s === '') {
                return SuccessfulValidateAndParseResult(objValue);
            }

            // more info on string -> date conv:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
            value = new Date(s);
            if (isNaN(value.valueOf())) {
                return ErrorValidateAndParseResult("Input string was not convertible to date", objValue);
            }
        }
        // todo here check other constraints like min/max whatever
        return SuccessfulValidateAndParseResult(objValue);
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: Date, b: Date) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        if (clientModel[this.member] === undefined) return;
        const vr = this.ValidateAndParse({ row: clientModel, mode, clientIntention });
        mutationModel[this.member] = vr.values[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// this field demonstrates the ability to expose raw db values as structures.
// here the db value is a string, but the exposed value is a ColorPaletteEntry.
// 
// this means the datagrid row model has a ColorPaletteEntry, NOT a string. not both.
// this is the gateway to doing foreign key items.
export type ColorFieldArgs = {
    columnName: string;
    allowNull: boolean;
    palette: ColorPaletteList;
} & DB3AuthSpec;

export class ColorField extends FieldBase<ColorPaletteEntry> {
    allowNull: boolean;
    palette: ColorPaletteList;

    constructor(args: ColorFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : args.palette.defaultEntry,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: SqlSpecialColumnFunction.color,
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
        if (clientModel[this.member] === undefined) return;
        const val: ColorPaletteEntry | null = clientModel[this.member];
        mutationModel[this.member] = (val?.id) || null;
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<ColorPaletteEntry>): ValidateAndParseResult<ColorPaletteEntry | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null) {//&& !this.allowNull) {
            if (this.allowNull)
                return SuccessfulValidateAndParseResult(objValue);
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        if (this.palette.findEntry(value?.id || null) == null) {
            return ErrorValidateAndParseResult("Not found in palette.", objValue);
        }
        return SuccessfulValidateAndParseResult(objValue);
    };


    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// booleans are simple checkboxes; therefore null is not supported.
// for null support use a radio / multi select style field.
export type BoolFieldArgs = {
    columnName: string;
    defaultValue: boolean | null;
    allowNull: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

export class BoolField extends FieldBase<boolean> {
    allowNull: boolean;

    constructor(args: BoolFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
        });
        this.allowNull = args.allowNull;
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
        clientModel[this.member] = CoerceToNullableBoolean(dbVal, this.defaultValue);
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        if (clientModel[this.member] === undefined) return;
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<boolean>): ValidateAndParseResult<boolean | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null && !this.allowNull) {
            return ErrorValidateAndParseResult("must not be null", objValue);
        }
        return SuccessfulValidateAndParseResult(objValue);
    };


    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// a single select field where
// - the db value is a string (no relationship enforced)
// - the enum value is a const typescript key val object (not an 'enum' type, but rather a const MyEnum { val1: "val1", val2: "val2" })
export type ConstEnumStringFieldArgs = {
    columnName: string,
    options: TAnyModel,
    defaultValue: string | null;
    allowNull: boolean,
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

export class ConstEnumStringField extends FieldBase<string> {
    options: TAnyModel;
    defaultValue: string | null;
    allowNull: boolean;

    constructor(args: ConstEnumStringFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
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
        if (clientModel[this.member] === undefined) return;
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();

        if (value === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(objValue);
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        // make sure val is actually a member of the enum.
        value = value!.trim();
        objValue[this.member] = value;
        if (!Object.values(this.options).some(op => op === value)) {
            return ErrorValidateAndParseResult(`unrecognized option '${value}'`, objValue);
        }
        return SuccessfulValidateAndParseResult(objValue);
    };

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
};

////////////////////////////////////////////////////////////////
// a single select field where the items are a db table with relation
// on client side, there is NO foreign key field (like instrumentId). Only the foreign object ('instrument').
export type ForeignSingleFieldArgs<TForeign> = {
    columnName: string; // "instrumentType"
    fkidMember: string; // "instrumentTypeId"
    foreignTableID: string; // for circular referencing don't force caller to use the xTable.
    allowNull: boolean;
    defaultValue?: TForeign | null;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

export class ForeignSingleField<TForeign> extends FieldBase<TForeign> {
    foreignTableID: string;
    localTableSpec: xTable;
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.

    getForeignTableSchema = () => {
        return GetTableById(this.foreignTableID);
    };

    constructor(args: ForeignSingleFieldArgs<TForeign>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "foreignObject",
            defaultValue: args.defaultValue || null,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
            fkidMember: args.fkidMember,
            _matchesMemberForAuthorization: (memberName: string) => {
                const mnl = memberName.toLowerCase();
                return mnl === this.member.toLowerCase() || mnl === this.fkidMember!.toLowerCase();
            },
        });

        // // does default behavior of case-insensitive, trimmed compare.
        // const itemExactlyMatches_defaultImpl = (value: TForeign, filterText: string): boolean => {
        //     //console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
        //     // if (!this.getChipCaption) {
        //     //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On ForeignSingleField ${args.columnName}`);
        //     // }
        //     //return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
        //     const rowInfo = this.getForeignTableSchema().getRowInfo(value as TAnyModel);
        //     return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        // }

        //this.fkMember = args.fkMember;
        this.allowNull = args.allowNull;
        this.defaultValue = args.defaultValue || null;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        //this.getForeignQuickFilterWhereClause = args.getForeignQuickFilterWhereClause;
        //this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
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

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        //ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // leaves behind the fk id.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // mutations want ONLY the id, not the object. but in the case both exist, use the object not the fk.
        const foreignPk = this.getForeignTableSchema().pkMember;
        if (clientModel[this.member] !== undefined) {
            if (clientModel[this.member] === null) {
                mutationModel[this.fkidMember!] = null; // assumes foreign pk is 'id'
            } else {
                mutationModel[this.fkidMember!] = clientModel[this.member][foreignPk]; // assumes foreign pk is 'id'
            }
            return;
        }

        if (clientModel[this.fkidMember!] !== undefined) {
            if (clientModel[this.fkidMember!] === null) {
                mutationModel[this.fkidMember!] = null; // assumes foreign pk is 'id'
            } else {
                mutationModel[this.fkidMember!] = clientModel[this.fkidMember!]; // assumes foreign pk is 'id'
            }
            return;
        }



        // if (clientModel[this.fkMember]) {
        //     mutationModel[this.fkMember] = clientModel[this.fkMember];
        //     return;
        // }
        // const foreign = clientModel[this.member];
        // if (foreign === undefined) return;
        // if (foreign === null) {
        //     mutationModel[this.fkMember] = null;
        //     return;
        // }
        // mutationModel[this.fkMember] = foreign[this.getForeignTableSchema().pkMember];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<TForeign>): ValidateAndParseResult<TForeign | null> => {
        let value = args.row[this.member];
        if (value === undefined) {
            let fkvalue = args.row[this.fkidMember!];
            if (fkvalue === undefined) return UndefinedValidateAndParseResult(); // both are undefined.

            // operate on fk instead of object.
            if (fkvalue === null && !this.allowNull) return ErrorValidateAndParseResult("field is required", { [this.fkidMember!]: fkvalue });
            return SuccessfulValidateAndParseResult({ [this.fkidMember!]: fkvalue });
        }

        if (value === null) {
            if (!this.allowNull) return ErrorValidateAndParseResult("field is required", {
                [this.member]: null,
                [this.fkidMember!]: null,
            });
            return SuccessfulValidateAndParseResult({
                [this.member]: null,
                [this.fkidMember!]: null,
            });
        }
        return SuccessfulValidateAndParseResult({
            [this.member]: value,
            [this.fkidMember!]: value.id,
        });
    };

    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);
        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `(true)`,
                }
            },
            hasAny: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} is not null)`,
                };
            },
            hasNone: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} is null)`,
                };
            },
            hasSomeOf: () => {
                // this is a bit meaningless but let's allow it. if you are demanding "some of" but don't specify anything, you necessarily get no results.
                // it gives continuity when selecting/deselecting items in the gui or switching back and forth between "include" vs. "exclude"
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `(false)`,//whereAnd: `(${this.fkMember} is null)`,
                };
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} = ${crit.options[0]})`,
                };
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} in (${crit.options.join(",")}))`,
                };
            },
            hasAllOf: () => {
                // you can't have multiple of this type of member; it would be impossible 
                throw new Error(`query type 'hasAllOf' is impossible for foreign single fields. make sure your filter spec doesn't invoke it. field:${crit.db3Column}`);
            },
            doesntHaveAnyOf: () => {
                // similar to hasSomeOf with 0 items, treat 0 items as a synonym for null.
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `(${this.fkidMember} is not null)`,
                };
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} != ${crit.options[0]})`,
                };
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} not in (${crit.options.join(",")}))`,
                };
            },
            doesntHaveAllOf: () => {
                // this also doesn't make sense for fk fields. exclude it if it has all of (x,y,z) is meaningless.
                // yes, if there is 1 option here then it can mean something but then use doesntHaveAnyOf.
                throw new Error(`query type 'doesntHaveAllOf' is impossible for foreign single fields. make sure your filter spec doesn't invoke it; maybe you mean to use 'doesntHaveAnyOf'.`);
            },
        };
        return map[crit.behavior]();
    };
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => {

        const filteredQuery = filteredItemsQueryExcludingThisCriterion;

        // a query that returns 1 row per option
        const foreignSchema = this.getForeignTableSchema();
        const foreignTable = foreignSchema.tableName;
        const foreignMembers = foreignSchema.SqlSpecialColumns;

        // we actually need to exclude this field from search
        return {
            sql: `with FIQ as (
                ${filteredQuery}
        )
        -- null option
        SELECT
            null id,
            null label,
            null color,
            null iconName,
            null tooltip,
            count(distinct(FIQ.id)) AS rowCount,
            -1 sortOrder
        FROM
            FIQ -- filtered events
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the statusId field
        where
            P.${this.fkidMember} is null

        union all

        SELECT
            FT.${foreignSchema.pkMember} id,
            ${foreignMembers.name ? `FT.${foreignMembers.name.member}` : "null"} label,
            ${foreignMembers.color ? `FT.${foreignMembers.color.member}` : "null"} color,
            ${foreignMembers.iconName ? `FT.${foreignMembers.iconName.member}` : "null"} iconName,
            ${foreignMembers.tooltip ? `FT.${foreignMembers.tooltip.member}` : "null"} tooltip,
            count(distinct(FIQ.id)) AS rowCount,
            FT.${foreignMembers.sortOrder?.member || foreignSchema.pkMember} sortOrder
        FROM
            FIQ -- filtered events
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the statusId field
            right join ${foreignTable} as FT on FT.${foreignSchema.pkMember} = P.${this.fkidMember}            -- like eventStatus
        where
            ${foreignSchema.SqlGetVisFilterExpression(currentUser, "FT")} -- account for delete, visibility
        GROUP BY 
            FT.${foreignSchema.pkMember}
        order by
            sortOrder asc
            `,
            transformResult: (row: { id: number, label: string | null, color: string | null, iconName: string | null, tooltip: string | null, rowCount: bigint }) => {
                const rowCount = new Number(row.rowCount).valueOf();
                return {
                    id: row.id,
                    rowCount,
                    label: row.label || row.id?.toString() || null,
                    color: row.color,
                    iconName: row.iconName,
                    tooltip: row.tooltip,
                    shape: undefined,
                };
            },
        };
    };
};



////////////////////////////////////////////////////////////////
// tags fields are arrays of associations
// on client side, there is NO foreign key field (like instrumentId). Only the foreign object ('instrument').
export type TagsFieldArgs<TAssociation> = {
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
} & DB3AuthSpec;

export class TagsField<TAssociation> extends FieldBase<TAssociation[]> {
    localTableSpec: xTable;
    associationTableID: string;
    foreignTableID: string;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getCustomFilterWhereClause__: (query: CMDBTableFilterModel) => TAnyModel | boolean;

    createMockAssociation: (row: TAnyModel, foreignObject: TAnyModel) => TAssociation;
    //doesItemExactlyMatchText: (item: TAssociation, filterText: string) => boolean;
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
            specialFunction: undefined,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });

        // // does default behavior of case-insensitive, trimmed compare.
        // const itemExactlyMatches_defaultImpl = (value: TAssociation, filterText: string): boolean => {
        //     // console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
        //     // if (!this.getChipCaption) {
        //     //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On TagsField ${args.columnName}`);
        //     // }
        //     // return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
        //     const rowInfo = this.getAssociationTableShema().getRowInfo(value as TAnyModel);
        //     return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        // }

        this.associationTableID = args.associationTableID;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        this.getCustomFilterWhereClause__ = args.getCustomFilterWhereClause;
        this.createMockAssociation = args.createMockAssociation || this.createMockAssociation_DefaultImpl;
        this.associationForeignIDMember = args.associationForeignIDMember;
        this.associationLocalIDMember = args.associationLocalIDMember;
        this.associationLocalObjectMember = args.associationLocalObjectMember;
        this.associationForeignObjectMember = args.associationForeignObjectMember;
        //this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
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
        if (clientModel[this.member] === undefined) return;

        // there's a possibility the client model is the one coming from the serialized format. yea terrible. but support this case
        // until we have proper clean serialized formats.
        mutationModel[this.member] = clientModel[this.member].map(a => {
            if (typeof a === 'number') return a;
            return a[this.associationForeignIDMember];
        });
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<TAssociation[]>): ValidateAndParseResult<TAssociation[] | null> => {
        // there's really nothing else to validate here. in theory you can make sure the IDs are valid but it should never be possible plus enforced by the db relationship.
        // therefore not worth the overhead / roundtrip / complexity.
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        return SuccessfulValidateAndParseResult(objValue);
    };


    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion, tableAlias: string): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);
        // select 1 from eventTagAssociations mt where mt.eventId = 
        const associationSchema = this.getAssociationTableShema();
        const associationTable = associationSchema.tableName;
        const assLocalId = this.associationLocalIDMember;
        const assTagId = this.associationForeignIDMember;
        const errorResult: CriterionQueryElements = {
            whereAnd: `(true)`,
            error: "Select options to filter on",
        };
        const hasAny: CriterionQueryElements = {
            error: undefined,
            whereAnd: `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id)`,
        };
        const hasNone: CriterionQueryElements = {
            error: undefined,
            whereAnd: `NOT EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id)`,
        };
        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `(true)`,
                }
            },
            hasAny: () => {
                return hasAny;
            },
            hasNone: () => {
                return hasNone;
            },
            hasSomeOf: () => {
                // this is a bit meaningless but let's allow it. if you are demanding "some of" but don't specify anything,
                // treat as if "is null". this has simple continuity for gui.
                if (crit.options.length === 0) return errorResult;
                return {
                    error: undefined,
                    whereAnd: `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} IN (${crit.options.join(",")}))`,
                };
            },
            hasAllOf: () => {
                if (crit.options.length === 0) return errorResult;
                const subQueries = crit.options.map(option =>
                    `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} = ${option})`
                );
                return {
                    error: undefined,
                    whereAnd: `(${subQueries.join(" AND ")})`,
                };
            },
            doesntHaveAnyOf: () => {
                if (crit.options.length === 0) return errorResult;
                return {
                    error: undefined,
                    whereAnd: `NOT EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} IN (${crit.options.join(",")}))`,
                };
            },
            doesntHaveAllOf: () => {
                if (crit.options.length === 0) return errorResult;
                const subQueries = crit.options.map(option =>
                    `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} = ${option})`
                );
                return {
                    error: undefined,
                    whereAnd: `NOT (${subQueries.join(" AND ")})`,
                };
            },
        };
        return map[crit.behavior]();
    }

    SqlGetFacetInfoQuery = (
        currentUser: UserWithRolesPayload,
        filteredItemsQuery: string,
        filteredItemsQueryExcludingThisCriterion: string,
        crit: DiscreteCriterion
    ): SearchResultsFacetQuery | null => {
        //return null;
        const foreignSchema = this.getForeignTableShema();
        const foreignTable = foreignSchema.tableName;
        const foreignMembers = foreignSchema.SqlSpecialColumns;
        const filteredQuery = filteredItemsQueryExcludingThisCriterion;
        return {
            sql: `
            with FIQ as (${filteredQuery})

            -- null option
            SELECT
                null id,
                null label,
                null color,
                null iconName,
                null tooltip,
                count(distinct(FIQ.id)) AS rowCount,
                -1 sortOrder
            FROM
                FIQ -- filtered events
                left join ${this.getAssociationTableShema().tableName} ASS on ASS.${this.associationLocalIDMember} = FIQ.id
            where
                ASS.${this.associationForeignIDMember} is null
    
            union all
    
            select
                FT.${foreignSchema.pkMember} AS id,
                ${foreignMembers.name ? `FT.${foreignMembers.name.member}` : "null"} AS label,
                ${foreignMembers.color ? `FT.${foreignMembers.color.member}` : "null"} AS color,
                ${foreignMembers.iconName ? `FT.${foreignMembers.iconName.member}` : "null"} AS iconName,
                ${foreignMembers.tooltip ? `FT.${foreignMembers.tooltip.member}` : "null"} AS tooltip,
                count(distinct(FIQ.id)) AS rowCount,
                FT.${foreignMembers.sortOrder?.member || foreignSchema.pkMember} AS sortOrder
            from
                FIQ
                inner join ${this.getAssociationTableShema().tableName} ASS on ASS.${this.associationLocalIDMember} = FIQ.id
                right join ${foreignTable} FT on FT.${foreignSchema.pkMember} = ASS.${this.associationForeignIDMember}
            group by
                FT.${foreignSchema.pkMember}

            order by
                sortOrder asc
                `,

            // converts the query result to a styled chip
            transformResult: (row: { id: number, label: string | null, color: string | null, iconName: string | null, tooltip: string | null, rowCount: bigint }) => {
                const rowCount = new Number(row.rowCount).valueOf();
                return {
                    id: row.id,
                    rowCount,
                    label: row.label || row.id?.toString() || null,
                    color: row.color,
                    iconName: row.iconName,
                    tooltip: row.tooltip,
                    shape: undefined,
                };
            },
        }
    } // SqlGetFacetInfoQuery

}; // TagsField

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type EventStartsAtFieldArgs = {
    columnName: string;
    allowNull: boolean;
} & DB3AuthSpec;

type EventStartsAtFieldDiscreteFilterTRow = {
    id: number, // facet IDs for this custom faceting are not database pks, they are contrived. but required for selecting etc.
    facetType: string,
    year: number | null, // null = TBD
    rowCount: bigint
};

export interface EventStartsAtFieldDiscreteFilterDomain {
    id: number,
    matchesId: (id: number) => boolean;
    transformResult: (row: EventStartsAtFieldDiscreteFilterTRow) => SearchResultsFacetOption,
    SqlMatch: (id: number) => string,
}

const gTbdId = 9999;

export class EventStartsAtField extends FieldBase<Date> {

    allowNull: boolean;
    localTableSpec: xTable;

    yearDomain: EventStartsAtFieldDiscreteFilterDomain;
    pastDomain: EventStartsAtFieldDiscreteFilterDomain;
    futureDomain: EventStartsAtFieldDiscreteFilterDomain;
    relevantDomain: EventStartsAtFieldDiscreteFilterDomain;
    past60DaysDomain: EventStartsAtFieldDiscreteFilterDomain;

    searchDomains: EventStartsAtFieldDiscreteFilterDomain[];

    constructor(args: EventStartsAtFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : new Date(),
            authMap: (args as any).authMap || null,
            specialFunction: undefined,
            _customAuth: (args as any)._customAuth || null,
        });
        this.allowNull = args.allowNull;

        this.yearDomain = {
            id: 0, // for per-year, the year IS the ID.
            matchesId: (id: number) => {
                return id < 10000;
            },
            transformResult: (row) => {
                const id = row.id;//new Number(row.year || gTbdId).valueOf();
                if (id === gTbdId) {
                    return {
                        id,
                        label: "TBD",
                        color: gSwatchColors.light_gray,
                        iconName: null,
                        rowCount: new Number(row.rowCount).valueOf(),
                        tooltip: `Select TBD events (with no date)`,
                        shape: undefined,
                    };
                }
                return {
                    id,
                    label: id.toString(),
                    color: null,
                    iconName: null,
                    rowCount: new Number(row.rowCount).valueOf(),
                    tooltip: `Select year ${row.year}`,
                    shape: undefined,
                };
            },
            SqlMatch: (id: number) => {
                if (id === gTbdId) {
                    return `isnull(${this.member})`;
                }
                return `(year(${this.member}) = ${id})`;
            },
        };

        this.pastDomain = {
            id: 10000,
            matchesId: (id: number) => id === 10000,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Past",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: `Past`,
                shape: undefined,
            }),
            SqlMatch: () => EventPastFilterExpression({ startsAtExpr: this.member }),
        };

        this.futureDomain =
        {
            id: 10001,
            matchesId: (id: number) => id === 10001,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Future",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: `Future`,
                shape: undefined,
            }),
            SqlMatch: () => EventFutureFilterExpression({ startsAtExpr: this.member }),
        };

        this.relevantDomain = {
            id: 10002,
            matchesId: (id: number) => id === 10002,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Relevant",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: "Relevant (6 days ago and later)",
                shape: undefined,
            }),
            SqlMatch: () => EventRelevantFilterExpression({ startsAtExpr: this.member }),
        };

        this.past60DaysDomain = {
            id: 10003,
            matchesId: (id: number) => id === 10003,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Past 60 days",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: "60 days ago until now",
                shape: undefined,
            }),
            SqlMatch: () => EventPast60DaysFilterExpression({ startsAtExpr: this.member }),
        };

        this.searchDomains = [
            this.yearDomain,
            this.pastDomain,
            this.futureDomain,
            this.relevantDomain,
            this.past60DaysDomain,
        ];
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

    // don't support quick filter on date fields
    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;
    };
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;
    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(objValue);
            }
            return ErrorValidateAndParseResult("field is required", objValue);
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
                return ErrorValidateAndParseResult("Not a valid date", objValue);
            }
            value = parsedDate;
            objValue[this.member] = value;
        }
        if (value instanceof Date) {
            if (isNaN(value.valueOf())) {
                return ErrorValidateAndParseResult("Date is invalid", objValue);
            }
        }
        return SuccessfulValidateAndParseResult(objValue);
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

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        //console.assert(clientModel[this.member] instanceof Date);
        if (clientModel[this.member] === undefined) return;
        const vr = this.ValidateAndParse({ row: clientModel, mode, clientIntention });
        Object.assign(mutationModel, vr.values);
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

    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member} is null`,
                    direction: api.sortModel.direction,
                },
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => {

        // for ranges, attempting to keep the optional hyphens is just impractical and confusing. so a more strict format is required and clearer.
        // 2023-2024
        // 202311-202312
        // 20231122-20231220
        const rangeRegex = /^(2\d{3})(\d\d)?(\d\d)?-(2\d{3})(\d\d)?(\d\d)?/;
        // groups:
        // 1: start year (required)
        // 2: start month
        // 3: start day
        // 4: end year (required)
        // 5: end month
        // 6: end day
        const rangeMatch = rangeRegex.exec(token);
        if (rangeMatch) {
            const startYear = rangeMatch[1];
            const startMonth = rangeMatch[2] || '01';
            const startDay = rangeMatch[3] || '01';
            const endYear = rangeMatch[4];
            const endMonth = rangeMatch[5] || '12';
            let endDay: string;

            // Calculate the last day of the end month
            if (!rangeMatch[6]) {
                const lastDayOfMonth = new Date(Number(endYear), Number(endMonth), 0).getDate();
                endDay = lastDayOfMonth.toString().padStart(2, '0');
            } else {
                endDay = rangeMatch[6];
            }

            // Note: date() extracts the date portion, which allows us to use 31 December as the end date rather than having to go to 1 Jan of the next year which is more complex.

            const startDate = `${startYear}-${startMonth}-${startDay}`;
            const endDate = `${endYear}-${endMonth}-${endDay}`;

            const expr = `(date(${this.member}) BETWEEN '${startDate}' AND '${endDate}')`;
            return expr;
        }

        // types of date formats:
        // 2023
        // 2023-11
        // 202311
        // 2023-11-22
        // 20231122

        // year part is 2nnn (match[1])
        // optional hyphen
        // optional month part is n or nn (match[2])
        // optional hyphen
        // optional day part is n or nn (match[3])
        const regex = /^(2\d{3})-?(\d{1,2})?-?(\d{1,2})?/;

        // Execute the regex on the input string
        const match = regex.exec(token);

        // Check if the match was successful
        if (match) {
            const parts: string[] = [];
            if (match[1]) {
                parts.push(`(YEAR(${this.member}) = ${match[1]})`);
            }
            if (match[2]) {
                parts.push(`(MONTH(${this.member}) = ${match[2]})`);
            }
            if (match[3]) {
                parts.push(`(dayofmonth(${this.member}) = ${match[3]})`);
            }
            return `(${parts.join(` AND `)})`;
        }

        return null;
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);

        // for the moment only support either having 1 criterion or none.
        const generalMatch = (): CriterionQueryElements => {
            if (crit.options.length !== 1) {
                return {
                    error: "Please select 1 option",
                    whereAnd: `(false)`,
                };
            }
            const id = crit.options[0] as number;
            const d = this.searchDomains.find(x => x.matchesId(id));
            if (!d) throw new Error(`date search facet domain not found: ${id}; should be a year, past, future, ...`);
            return {
                error: undefined,
                whereAnd: d.SqlMatch(id),
            };
        };

        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `(true)`,
                }
            },
            hasAny: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.member} is not null)`, // "has any date" i am not 100% certain makes sense to filter for TBD. but go for it; edge case
                };
            },
            hasNone: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.member} is null)`,
                };
            },
            hasSomeOf: generalMatch,
            hasAllOf: generalMatch,
            doesntHaveAnyOf: () => {
                throw new Error(`query type 'doesntHaveAnyOf' is impossible for date fields.`);
            },
            doesntHaveAllOf: () => {
                throw new Error(`query type 'doesntHaveAllOf' is impossible for date fields.`);
            },
        };
        return map[crit.behavior]();
    };

    // return a SQL query which is executed, then a transformation function that returns the 
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => {
        return {
            sql: `
        with FIQ as (${filteredQuery})

        select
            -- NB: make sure the columns conform to EventStartsAtFieldDiscreteFilterTRow
            coalesce(year(${this.member}), ${gTbdId}) id,
            'year' facetType,
            coalesce(year(${this.member}), ${gTbdId}) year,
            coalesce(year(${this.member}), ${gTbdId}) sortOrder,
            count(FIQ.id) rowCount
        from
            ${this.localTableSpec.tableName} as P
            left join FIQ on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        group by
            coalesce(year(${this.member}), ${gTbdId})
        
        union all
        
        select
            ${this.pastDomain.id} id,
            'past' facetType,
            null year,
            ${this.pastDomain.id} sortOrder,
            count(P.id) rowCount
        from
            FIQ
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        where
            ${EventPastFilterExpression({ startsAtExpr: this.member })}
        
        union all
        
        select
            ${this.futureDomain.id} id,
            'future' facetType,
            null year,
            ${this.futureDomain.id} sortOrder,
            count(P.id) rowCount
        from
            FIQ
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        where
            ${EventFutureFilterExpression({ startsAtExpr: this.member })}

        union all
        
            select
                ${this.relevantDomain.id} id,
                'relevant' facetType,
                null year,
                ${this.relevantDomain.id} sortOrder,
                count(P.id) rowCount
            from
                FIQ
                inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
            where
                ${EventRelevantFilterExpression({ startsAtExpr: this.member })}

        union all
    
            select
                ${this.past60DaysDomain.id} id,
                'relevant' facetType,
                null year,
                ${this.past60DaysDomain.id} sortOrder,
                count(P.id) rowCount
            from
                FIQ
                inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
            where
                ${EventPast60DaysFilterExpression({ startsAtExpr: this.member })}
    
        order by
            sortOrder
            `,
            transformResult: (row: EventStartsAtFieldDiscreteFilterTRow): SearchResultsFacetOption => {
                //const d = this.domainMap[row.id];
                row.id = new Number(row.id).valueOf();
                const d = this.searchDomains.find(x => x.matchesId(row.id));
                assert(!!d, `incomplete domain map? row doesn't have corresponding startsAt filter domain: ${JSON.stringify(row)}`);
                return d.transformResult(row);
            },
        }
    };


};



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type CreatedAtFieldArgs = {
    columnName: string;
    specialFunction?: SqlSpecialColumnFunction;
};

export class CreatedAtField extends FieldBase<Date> {
    constructor(args: CreatedAtFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: new Date(),
            specialFunction: args.specialFunction || SqlSpecialColumnFunction.createdAt,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
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
    ValidateAndParse = (args: ValidateAndParseArgs<string | Date>): ValidateAndParseResult<Date | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();

        // we don't care about the input; for creations just generate a new date always.
        if (args.mode === "new") {
            return SuccessfulValidateAndParseResult({ [this.member]: new Date() });
        }

        // for updates, exclude the field.
        return {
            result: "success",
            values: {},
        };
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = new Date();
    };

    isEqual = (a: Date, b: Date) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        if (clientModel[this.member] === undefined) return;
        if (mode !== "new") return; // exclude this field from updates
        const vr = this.ValidateAndParse({ row: clientModel, mode, clientIntention });
        Object.assign(mutationModel, vr.values);
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        console.assert(dbModel[this.member] instanceof Date);
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
};




///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type RevisionFieldArgs = {
    columnName: string;
    applyToUpdates: boolean;
} & DB3AuthSpec;

export class RevisionField extends FieldBase<number> {
    applyToUpdates: boolean;

    constructor(args: RevisionFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: 0,
            specialFunction: undefined,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
        this.applyToUpdates = args.applyToUpdates;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;
    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<string | number>): ValidateAndParseResult<number | null> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();

        // we don't care about the input; for creations just start with sequence 0.
        if (args.mode === "new") {
            return SuccessfulValidateAndParseResult({ [this.member]: this.defaultValue });
        }
        return SuccessfulValidateAndParseResult(objValue);
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode, clientIntention: xTableClientUsageContext) => {
        if (mode === "new") {
            mutationModel[this.member] = this.defaultValue;
            return;
        }
        // for update etc it gets handled in the mutation itself via an ad-hoc hook. the idea is to avoid clients from setting this field.
        // however sometimes like with EventUserResponse, it SHOULD be done here because the hook is not so sophisticated.
        if (this.applyToUpdates) {
            mutationModel[this.member] = clientModel[this.member];
            return;
        }
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return; // don't clobber
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
};



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// higher-level conveniences

export const MakePKfield = () => new PKField({
    columnName: "id",
});

export const MakeIntegerField = (columnName: string, authSpec: DB3AuthSpec) => (
    new GenericIntegerField({
        columnName,
        allowSearchingThisField: false,
        allowNull: false,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));

// color fields convert to colorpaletteentry on query
export const MakeColorField = ({ columnName = "color", ...authSpec }: { columnName?: string } & DB3AuthSpec) => (
    new ColorField({
        columnName,
        allowNull: true,
        palette: gGeneralPaletteList,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));

export const MakeSortOrderField = ({ columnName = "sortOrder", ...authSpec }: { columnName?: string } & DB3AuthSpec) => (
    new GenericIntegerField({
        columnName,
        allowSearchingThisField: false,
        allowNull: false,
        specialFunction: SqlSpecialColumnFunction.sortOrder,
        authMap: createAuthContextMap_GrantAll(), // safe enough to never hide this field.
    }));

export const MakeSignificanceField = (columnName: string, options: TAnyModel, authSpec: DB3AuthSpec) => (
    new ConstEnumStringField({
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));

export const MakeIconField = (columnName: string, options: TAnyModel, authSpec: DB3AuthSpec) => (
    new ConstEnumStringField({
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
        specialFunction: SqlSpecialColumnFunction.iconName,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));

export const MakeCreatedAtField = (args?: { columnName?: string }) => (
    new CreatedAtField({
        columnName: args?.columnName || "createdAt",
        specialFunction: SqlSpecialColumnFunction.createdAt,
    })
);

export const MakeUpdatedAtField = (args?: { columnName?: string }) => (
    new CreatedAtField({
        columnName: args?.columnName || "updatedAt",
        specialFunction: SqlSpecialColumnFunction.updatedAt,
    })
);

export const MakeIsDeletedField = ({ columnName = "isDeleted", ...authSpec }: { columnName?: string } & DB3AuthSpec) => (
    new BoolField({
        columnName,
        allowNull: false,
        defaultValue: false,
        specialFunction: SqlSpecialColumnFunction.isDeleted,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
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
                if (fields[typedColumn.member] !== undefined) {
                    ret.localFields[typedColumn.member] = fields[typedColumn.member];
                }
                if (fields[typedColumn.fkidMember!] !== undefined) {
                    ret.localFields[typedColumn.fkidMember!] = fields[typedColumn.fkidMember!];
                }
                if (!fields[typedColumn.fkidMember!] && !!fields[typedColumn.member]) {
                    // if we're able to populate the fk member go ahead. assumes the foreign model's pk is 'id'
                    ret.localFields[typedColumn.fkidMember!] = fields[typedColumn.member].id;
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
