
import { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3MaybeNull, type DB3ReadPresenceForAuthSpec,
    type DB3RowMode, ErrorValidateAndParseResult, FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// a single select field where
// - the db value is a string (no relationship enforced)
// - the enum value is a const typescript key val object (not an 'enum' type, but rather a const MyEnum { val1: "val1", val2: "val2" })
// Keys label the options; values are the strings stored in the database.
export type ConstEnumStringOptions = Readonly<Record<string, string>>;
type ConstEnumStringValue<TOptions extends ConstEnumStringOptions> = TOptions[keyof TOptions];

export type ConstEnumStringFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
    TOptions extends ConstEnumStringOptions = ConstEnumStringOptions,
> = {
    columnName: string,
    options: TOptions,
    // Required fields may start unselected; persisted nulls still obey allowNull.
    defaultValue: NoInfer<ConstEnumStringValue<TOptions>> | null;
    allowNull: TAllowNull,
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & TAuthSpec;

export class ConstEnumStringField<
    const TAllowNull extends boolean = boolean,
    const TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
    const TOptions extends ConstEnumStringOptions = ConstEnumStringOptions,
> extends FieldBase<
    ConstEnumStringValue<TOptions>,
    undefined,
    true,
    DB3MaybeNull<ConstEnumStringValue<TOptions>, TAllowNull>,
    DB3MaybeNull<ConstEnumStringValue<TOptions>, TAllowNull>,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {
    readonly options: TOptions;
    defaultValue: ConstEnumStringValue<TOptions> | null;
    allowNull: TAllowNull;

    constructor(args: ConstEnumStringFieldArgs<TAllowNull, TAuthSpec, TOptions>) {
        const values = new Set<string>(Object.values(args.options));
        const enumSchema = z.custom<ConstEnumStringValue<TOptions>>(
            value => typeof value === "string" && values.has(value),
            value => ({ message: `unrecognized option '${String(value)}'` }),
        );
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            readTransportSchema: makeNullableReadTransportSchema(enumSchema, args.allowNull),
            authMap: "authMap" in args ? args.authMap ?? null : null,
            _customAuth: "_customAuth" in args ? args._customAuth ?? null : null,
            specialFunction: args.specialFunction,
        });
        this.options = args.options;
        this.defaultValue = args.defaultValue;
        this.allowNull = args.allowNull;
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: ConstEnumStringValue<TOptions>, b: ConstEnumStringValue<TOptions>) => {
        return a === b;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return { [this.member]: { contains: query } };
    };

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        if (clientModel[this.member] === undefined) return;
        mutationModel[this.member] = clientModel[this.member];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<ConstEnumStringValue<TOptions>>): ValidateAndParseResult<ConstEnumStringValue<TOptions> | null> => {
        const value = args.row[this.member];
        const candidate = typeof value === "string" ? value.trim() : value;
        const objValue = { [this.member]: candidate };
        if (value === undefined) {
            return UndefinedValidateAndParseResult();
        }

        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult({ [this.member]: null });
            }
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        const parsed = this.getReadTransportSchema().safeParse(candidate);
        if (!parsed.success) {
            return ErrorValidateAndParseResult(`unrecognized option '${String(candidate)}'`, objValue);
        }
        return SuccessfulValidateAndParseResult({ [this.member]: parsed.data });
    };

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetFacetInfoQuery = (): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
};


export const MakeSignificanceField = <const TAuthSpec extends DB3AuthSpec, const TOptions extends ConstEnumStringOptions>(columnName: string, options: TOptions, authSpec: TAuthSpec) => (
    new ConstEnumStringField({
        ...authSpec,
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
    }));

export const MakeIconField = <const TAuthSpec extends DB3AuthSpec, const TOptions extends ConstEnumStringOptions>(columnName: string, options: TOptions, authSpec: TAuthSpec) => (
    new ConstEnumStringField({
        ...authSpec,
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
        specialFunction: SqlSpecialColumnFunction.iconName,
    }));
