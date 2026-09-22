
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
import { type UserWithRolesPayload } from "../schema/userPayloads";



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// a single select field where
// - the db value is a string (no relationship enforced)
// - the enum value is a const typescript key val object (not an 'enum' type, but rather a const MyEnum { val1: "val1", val2: "val2" })
export type ConstEnumStringFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
> = {
    columnName: string,
    options: TAnyModel,
    defaultValue: DB3MaybeNull<string, TAllowNull>;
    allowNull: TAllowNull,
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & TAuthSpec;

export class ConstEnumStringField<
    TAllowNull extends boolean = boolean,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    string,
    undefined,
    true,
    DB3MaybeNull<string, TAllowNull>,
    DB3MaybeNull<string, TAllowNull>,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {
    options: TAnyModel;
    defaultValue: string | null;
    allowNull: boolean;

    constructor(args: ConstEnumStringFieldArgs<TAllowNull, TAuthSpec>) {
        const enumSchema = z.string().refine(
            value => Object.values(args.options).includes(value),
            value => ({ message: `unrecognized option '${value}'` }),
        );
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            readTransportSchema: makeNullableReadTransportSchema(enumSchema, args.allowNull),
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


export const MakeSignificanceField = <TAuthSpec extends DB3AuthSpec>(columnName: string, options: TAnyModel, authSpec: TAuthSpec) => (
    new ConstEnumStringField({
        ...authSpec,
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
    }));

export const MakeIconField = <TAuthSpec extends DB3AuthSpec>(columnName: string, options: TAnyModel, authSpec: TAuthSpec) => (
    new ConstEnumStringField({
        ...authSpec,
        columnName,
        allowNull: true,
        defaultValue: null,
        options,
        specialFunction: SqlSpecialColumnFunction.iconName,
    }));
