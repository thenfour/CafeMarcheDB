
import { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3ReadPresenceForAuthSpec, type DB3RowMode,
    FieldBase,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type CreatedAtFieldArgs<TAuthSpec extends Partial<DB3AuthSpec> = {}> = {
    columnName: string;
    specialFunction?: SqlSpecialColumnFunction;
} & TAuthSpec;

export class CreatedAtField<
    const TAuthSpec extends Partial<DB3AuthSpec> = {},
> extends FieldBase<
    Date,
    undefined,
    true,
    Date,
    Date,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {
    constructor(args: CreatedAtFieldArgs<Partial<DB3AuthSpec>>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: new Date(),
            readTransportSchema: z.date(),
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

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };


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

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = new Date();
    };

    isEqual = (a: Date, b: Date) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        if (clientModel[this.member] === undefined) return;
        if (mode !== "new") return; // exclude this field from updates
        const vr = this.ValidateAndParse({ row: clientModel, mode });
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

// higher-level conveniences

export const MakeCreatedAtField = <
    const TAuthSpec extends Partial<DB3AuthSpec> = {},
>(args?: { columnName?: string } & TAuthSpec) => (
    new CreatedAtField<TAuthSpec>({
        ...args,
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

