
import { TAnyModel } from "@/shared/rootroot";
import { CoerceToBoolean, CoerceToNumberOrNull } from "shared/utils";
import { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3MaybeNull, type DB3ReadPresenceForAuthSpec,
    type DB3RowMode, ErrorValidateAndParseResult, FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult, createAuthContextMap_GrantAll,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type GenericIntegerReadTransportType = "number" | "bigint";

export type GenericIntegerReadTransportValue<T extends GenericIntegerReadTransportType> =
    T extends "bigint" ? bigint : number;

export type GenericIntegerFieldArgs<
    TReadTransportType extends GenericIntegerReadTransportType = "number",
    TAllowNull extends boolean = boolean,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> = {
    columnName: string;
    allowNull: TAllowNull;
    readTransportType?: TReadTransportType;
    allowSearchingThisField?: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & TAuthSpec;

export class GenericIntegerField<
    TReadTransportType extends GenericIntegerReadTransportType = "number",
    TAllowNull extends boolean = boolean,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    number,
    undefined,
    true,
    DB3MaybeNull<GenericIntegerReadTransportValue<TReadTransportType>, TAllowNull>,
    DB3MaybeNull<GenericIntegerReadTransportValue<TReadTransportType>, TAllowNull>,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {

    allowNull: boolean;
    allowSearchingThisField: boolean;

    constructor(args: GenericIntegerFieldArgs<TReadTransportType, TAllowNull, TAuthSpec>) {
        const scalarSchema = (
            args.readTransportType === "bigint" ? z.bigint() : z.number().int()
        ) as unknown as z.ZodType<GenericIntegerReadTransportValue<TReadTransportType>>;
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : 0,
            readTransportSchema: makeNullableReadTransportSchema(scalarSchema, args.allowNull),
            specialFunction: args.specialFunction,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
        this.allowNull = args.allowNull;
        this.allowSearchingThisField = CoerceToBoolean(args.allowSearchingThisField, true);
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | false => {
        if (!this.allowSearchingThisField) return false;
        const queryAsNumber = CoerceToNumberOrNull(query);
        if (queryAsNumber === null) return false;
        const r = this.ValidateAndParse({ row: { [this.member]: queryAsNumber }, mode: "view" }); // passing empty row because it's not used by this class.
        if (r.result !== "success") return false;
        return { [this.member]: { equals: r.values[this.member] } };
    };

    getOverallWhereClause = (): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

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

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        if (clientModel[this.member] === undefined) return;
        const vr = this.ValidateAndParse({ row: clientModel, mode });
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



export const MakeIntegerField = <TAuthSpec extends DB3AuthSpec>(columnName: string, authSpec: TAuthSpec) => (
    new GenericIntegerField({
        ...authSpec,
        columnName,
        allowSearchingThisField: false,
        allowNull: false,
    }));


export const MakeSortOrderField = ({ columnName = "sortOrder", ...authSpec }: { columnName?: string } & DB3AuthSpec) => (
    new GenericIntegerField({
        columnName,
        allowSearchingThisField: false,
        allowNull: false,
        specialFunction: SqlSpecialColumnFunction.sortOrder,
        authMap: createAuthContextMap_GrantAll(), // safe enough to never hide this field.
    }));
