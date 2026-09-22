
import { TAnyModel } from "@/shared/rootroot";
import { CoerceToNullableBoolean } from "shared/utils";
import { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3FieldCodec, type DB3MaybeNull,
    type DB3ReadPresenceForAuthSpec, type DB3RowMode, ErrorValidateAndParseResult,
    FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// booleans are simple checkboxes; therefore null is not supported.
// for null support use a radio / multi select style field.
export type BoolFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
> = {
    columnName: string;
    defaultValue: DB3MaybeNull<boolean, TAllowNull>;
    allowNull: TAllowNull;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & TAuthSpec;

export class BoolField<
    const TAllowNull extends boolean = boolean,
    const TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    boolean,
    DB3FieldCodec<
        DB3MaybeNull<boolean, TAllowNull>,
        DB3MaybeNull<boolean, TAllowNull>
    >,
    true,
    DB3MaybeNull<boolean, TAllowNull>,
    DB3MaybeNull<boolean, TAllowNull>,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {
    allowNull: boolean;
    readonly codec: DB3FieldCodec<
        DB3MaybeNull<boolean, TAllowNull>,
        DB3MaybeNull<boolean, TAllowNull>
    >;

    constructor(args: BoolFieldArgs<TAllowNull, TAuthSpec>) {
        const transportSchema = makeNullableReadTransportSchema(z.boolean(), args.allowNull);
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.defaultValue,
            readTransportSchema: transportSchema,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
        });
        this.allowNull = args.allowNull;
        this.codec = {
            decode: value => CoerceToNullableBoolean(
                value,
                args.defaultValue,
            ) as DB3MaybeNull<boolean, TAllowNull>,
            encode: value => value,
            writeSchema: transportSchema,
        };
    }

    connectToTable = (table: xTable) => { };

    isEqual = (a: boolean, b: boolean) => {
        return a === b;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const dbVal: boolean | null = dbModel[this.member]; // db may have null values so need to coalesce
        clientModel[this.member] = this.codec.decode(
            dbVal as DB3MaybeNull<boolean, TAllowNull>,
        );
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



export const MakeIsDeletedField = <const TAuthSpec extends DB3AuthSpec>(args: { columnName?: string } & TAuthSpec) => (
    new BoolField<false, TAuthSpec>({
        ...args,
        columnName: args.columnName ?? "isDeleted",
        allowNull: false,
        defaultValue: false,
        specialFunction: SqlSpecialColumnFunction.isDeleted,
    })
);


