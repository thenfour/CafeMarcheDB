
import { TAnyModel } from "@/shared/rootroot";
import type { z } from "zod";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import type { DB3ServerAuthorization } from "src/core/db3/server/db3ServerAuthorization";
import {
    type DB3AuthSpec, type DB3ReadPresenceForAuthSpec,
    FieldBase,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// field types
export type GhostFieldArgs<
    TReadTransportValue = never,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> = {
    memberName: string;
    specialFunction?: SqlSpecialColumnFunction;
    // optional DTO schema
    readTransportSchema?: z.ZodType<TReadTransportValue>;
} & TAuthSpec;

// sometimes you have a query containing a payload and you don't need to have a full FieldSpec for handling it. you just need to access its raw value as returned by the db.
// often something like a include:{...}
export class GhostField<
    TReadTransportValue = never,
    const TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    number,
    undefined,
    true,
    TReadTransportValue,
    TReadTransportValue,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {

    table: xTable;

    constructor(args: GhostFieldArgs<TReadTransportValue, TAuthSpec>) {
        super({
            member: args.memberName,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            fieldTableAssociation: "tableColumn",
            defaultValue: null,
            readTransportSchema: args.readTransportSchema,
            specialFunction: args.specialFunction,
        });
    }

    connectToTable = (table: xTable) => { this.table = table; };

    ApplyIncludeFiltering = (include: TAnyModel, publicData: DB3ServerAuthorization, includeDeleted: boolean): void | Promise<void> => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    ValidateAndParse = (val: ValidateAndParseArgs<number>): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult({ [this.member]: val.row[this.member] });
    };
    ApplyToNewRow = (args: TAnyModel) => {
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
