
import { TAnyModel } from "@/shared/rootroot";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3RowMode, ErrorValidateAndParseResult,
    FieldBase,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";



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

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

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

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: Date, b: Date) => {
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



