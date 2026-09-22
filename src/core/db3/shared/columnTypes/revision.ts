// TODO: assess whether this is necessary.


import { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3ReadPresenceForAuthSpec, type DB3RowMode,
    FieldBase,
    type SqlGetSortableQueryElementsAPI,
    SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export type RevisionFieldArgs<TAuthSpec extends DB3AuthSpec> = {
    columnName: string;
    applyToUpdates: boolean;
} & TAuthSpec;

export class RevisionField<
    const TAuthSpec extends DB3AuthSpec,
> extends FieldBase<
    number,
    undefined,
    true,
    number,
    number,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {
    applyToUpdates: boolean;

    constructor(args: RevisionFieldArgs<TAuthSpec>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: 0,
            readTransportSchema: z.number().int(),
            specialFunction: undefined,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });
        this.applyToUpdates = args.applyToUpdates;
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;
    getOverallWhereClause = (): TAnyModel | boolean => false;
    ApplyIncludeFiltering = (include: TAnyModel) => { };

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

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: number, b: number) => {
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
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

