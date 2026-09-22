
import { TAnyModel } from "@/shared/rootroot";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    FieldBase,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    createAuthContextMap_PK, createAuthContextMap_SysadminNaturalPK, xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";

// export type DB3AuthSpec = {
//     authMap: DB3AuthContextPermissionMap;
// } | {
//     _customAuth: (args: DB3AuthorizeAndSanitizeInput<TAnyModel>) => boolean;
// };


export type PKFieldArgs = {
    columnName: string;
    isRowOwner?: boolean;

    // "all" = visible to all users; the default for tables without publicId (only natural monotonic id)
    // "sysadmin" = show natural id only to system administrators; this is useful on tables with publicId where we don't normally show the id; this grants an exception to sysadmins only.
    naturalIdVisibility?: "all" | "sysadmin";
};// & DB3AuthSpec;

export class PKField extends FieldBase<number, undefined, false> {
    constructor(args: PKFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: null,
            authMap: args.naturalIdVisibility === "sysadmin"
                ? createAuthContextMap_SysadminNaturalPK()
                : createAuthContextMap_PK(),
            specialFunction: args.isRowOwner
                ? SqlSpecialColumnFunction.ownerUser
                : SqlSpecialColumnFunction.pk,
            _customAuth: null,
        });
    }

    // field child classes impl this to get established. for example pk fields will set the table's pk here.
    connectToTable = (table: xTable) => {
        table.pkMember = this.member;
        // A self-owned table can use its primary key as the ownership column.
        // Preserve the primary-key lookup as well as the owner marker.
        table.SqlSpecialColumns.pk = this;
    };

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        return false;// don't filter on pk id. { [this.member]: { contains: query } };
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    // for pk id fields, there should never be any changes. but it is required to pass into update/delete/whatever so just pass it always.
    ValidateAndParse = (val: ValidateAndParseArgs<number>): ValidateAndParseResult<number | null> => {
        return SuccessfulValidateAndParseResult({ [this.member]: val.row[this.member] });
    };
    ApplyToNewRow = (args: TAnyModel) => {
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


export const MakePKfield = (args: { isRowOwner?: boolean, naturalIdVisibility?: "all" | "sysadmin" } = {}) => new PKField({
    columnName: "id",
    isRowOwner: args.isRowOwner,
    naturalIdVisibility: args.naturalIdVisibility,
});
