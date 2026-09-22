
import { TAnyModel } from "@/shared/rootroot";
import { isPublicId } from "shared/publicId";
import { z } from "zod";
import {
    type CriterionQueryElements,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    ErrorValidateAndParseResult,
    FieldBase,
    SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    createAuthContextMap_PK,
    xTable
} from "../db3core";

////////////////////////////////////////////////////////////////
// Stable, opaque identity used whenever a converted row crosses the client
// boundary. Generation remains server-owned.
export class PublicIdField extends FieldBase<string, undefined, false, string, string, "required"> {
    constructor(columnName = "publicId") {
        super({
            member: columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: null,
            readTransportSchema: z.string().refine(isPublicId, "invalid public ID"),
            authMap: createAuthContextMap_PK(),
            specialFunction: SqlSpecialColumnFunction.publicId,
            _customAuth: null,
        });
    }

    connectToTable = (table: xTable) => {
        if (table.publicIdMember) {
            throw new Error(`Table ${table.tableID} declares more than one public-ID field.`);
        }
        table.publicIdMember = this.member;
    };

    ApplyIncludeFiltering = () => { };
    getQuickFilterWhereClause = (): TAnyModel | boolean => false;
    getCustomFilterWhereClause = (): TAnyModel | boolean => false;
    getOverallWhereClause = (): TAnyModel | boolean => false;

    ValidateAndParse = (args: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null> => {
        const value = args.row[this.member];
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (!isPublicId(value)) return ErrorValidateAndParseResult("invalid public ID", { [this.member]: value });
        return SuccessfulValidateAndParseResult({ [this.member]: value });
    };

    ApplyToNewRow = () => { };
    isEqual = (a: string, b: string) => a === b;
    ApplyClientToDb = () => { };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        if (dbModel[this.member] !== undefined) clientModel[this.member] = dbModel[this.member];
    };

    SqlGetSortableQueryElements = (): SortQueryElements | null => null;
    SqlGetDiscreteCriterionElements = (): CriterionQueryElements | null => null;
    SqlGetFacetInfoQuery = (): SearchResultsFacetQuery | null => null;
    SqlGetQuickFilterElementsForToken = (): string | null => null;
}


export const MakePublicIdField = () => new PublicIdField("publicId");
