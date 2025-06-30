
import { MysqlEscape } from "shared/mysqlUtils";
import { CoalesceBool, CoerceToBoolean, isValidURL } from "shared/utils";
import { CMDBTableFilterModel, CriterionQueryElements, DiscreteCriterion, SearchResultsFacetQuery, SortQueryElements, TAnyModel } from "./apiTypes";
import { DB3AuthSpec, ErrorValidateAndParseResult, FieldBase, SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult, UserWithRolesPayload, ValidateAndParseArgs, ValidateAndParseResult, xTable, xTableClientUsageContext } from "./db3core";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for validation and client UI behavior.
export type StringFieldFormatOptions = "plain" | "email" | "markdown" | "title" | "raw" | "uri" | "customLinkSlug";

export type GenericStringFieldArgs = {
    columnName: string;
    format: StringFieldFormatOptions;
    allowNull: boolean;
    caseSensitive?: boolean;
    allowQuickFilter?: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

export class GenericStringField extends FieldBase<string> {
    caseSensitive: boolean;
    allowNull: boolean;
    minLength: number;
    doTrim: boolean;
    format: StringFieldFormatOptions;
    allowQuickFilter: boolean;

    constructor(args: GenericStringFieldArgs) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : "",
            specialFunction: args.specialFunction,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });

        this.format = args.format;
        this.allowNull = args.allowNull;
        this.allowQuickFilter = CoerceToBoolean(args.allowQuickFilter, args.format !== "markdown");

        switch (args.format) {
            case "customLinkSlug":
                this.minLength = 1;
                this.doTrim = true;
                this.caseSensitive = CoerceToBoolean(args.caseSensitive, true);
                break;
            case "uri":
                this.minLength = 5;
                this.doTrim = true;
                this.caseSensitive = CoerceToBoolean(args.caseSensitive, true);
                break;
            case "email":
                this.minLength = 1;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            case "markdown":
                this.minLength = 0;
                this.doTrim = false; // trailing whitespace is normal on long text entries.
                this.caseSensitive = CoerceToBoolean(args.caseSensitive, true);
                break;
            case "plain":
                this.minLength = 0;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            case "raw":
                this.minLength = 0;
                this.doTrim = false;
                this.caseSensitive = true;
                break;
            case "title":
                this.minLength = 1;
                this.doTrim = true;
                this.caseSensitive = args.caseSensitive || false;
                break;
            default:
                throw new Error(`unknown string field format; columnname: ${args.columnName}`);
        }
    }

    connectToTable = (table: xTable) => { };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        if (!this.allowQuickFilter) return false;
        return { [this.member]: { contains: query } };
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (clientIntention: xTableClientUsageContext): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel, clientIntention: xTableClientUsageContext) => { };

    ValidateAndParse = (args: ValidateAndParseArgs<string>): ValidateAndParseResult<string | null | undefined> => {
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        if (value === null) {
            if (this.allowNull) return SuccessfulValidateAndParseResult(objValue);
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        if (typeof value !== 'string') {
            return ErrorValidateAndParseResult("field is of unknown type", objValue);
        }
        if (this.doTrim) {
            value = value.trim();
            objValue[this.member] = value;
        }
        if (value.length < this.minLength) {
            return ErrorValidateAndParseResult("minimum length not satisfied", objValue);
        }
        if (this.format === "email") {
            // https://stackoverflow.com/questions/46155/how-can-i-validate-an-email-address-in-javascript
            const validateEmail = (email) => {
                return String(email)
                    .toLowerCase()
                    .match(
                        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                    );
            };
            if (!validateEmail(value)) {
                return ErrorValidateAndParseResult("email not in the correct format", objValue);
            }
        } else if (this.format === "uri") {
            if (!isValidURL(value)) {
                return ErrorValidateAndParseResult("URI not in the correct format", objValue);
            }
        } else if (this.format === "customLinkSlug") {
            // custom URL slugs can be any URL segment, and can include slashes.
            const pattern = /^[a-zA-Z0-9\-_\/]+$/;
            if (!pattern.test(value)) {
                return ErrorValidateAndParseResult("Custom slug not in the correct format", objValue);
            }
        }
        return SuccessfulValidateAndParseResult(objValue);
    };

    ApplyToNewRow = (args: TAnyModel, clientIntention: xTableClientUsageContext) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: string, b: string) => {
        if (this.doTrim) {
            a = a.trim();
            b = b.trim();
        }
        if (!this.caseSensitive) {
            a = a.toLowerCase();
            b = b.toLowerCase();
        }
        return a === b;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel) => {
        mutationModel[this.member] = clientModel[this.member];
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel) => {
        if (dbModel[this.member] === undefined) return;
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => null;
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [{
                alias: api.getColumnAlias(),
                expression: `${api.primaryTableAlias}.${this.member}`,
                direction: api.sortModel.direction,
            }],
        };
    };
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => {
        return `(${this.member} like '%${MysqlEscape(token)}%')`;
    }
};



export const MakePlainTextField = (columnName: string, authSpec: DB3AuthSpec) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: false,
        format: "plain",
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));
export const MakeNullableRawTextField = (columnName: string, authSpec: DB3AuthSpec) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: true,
        format: "raw",
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));
export const MakeRawTextField = (columnName: string, authSpec: DB3AuthSpec, allowNull?: boolean) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: CoalesceBool(allowNull, false),
        format: "raw",
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));
export const MakeMarkdownTextField = (columnName: string, authSpec: DB3AuthSpec, allowNull?: boolean) => (
    new GenericStringField({
        columnName,
        allowNull: CoalesceBool(allowNull, false),
        allowQuickFilter: false,
        format: "markdown",
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));
export const MakeTitleField = (columnName: string, authSpec: DB3AuthSpec) => (
    new GenericStringField({
        columnName: columnName,
        allowNull: false,
        format: "title",
        specialFunction: SqlSpecialColumnFunction.name,
        allowQuickFilter: true,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));

export const MakeDescriptionField = ({ columnName = "description", ...authSpec }: { columnName?: string } & DB3AuthSpec) => (
    new GenericStringField({
        columnName,
        allowNull: false,
        format: "markdown",
        specialFunction: SqlSpecialColumnFunction.description,
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    })
);

// this does not convert to colorpaletteentry
export const MakeColorAsStringField = ({ columnName = "color", allowNull = true, ...authSpec }: { columnName?: string, allowNull?: boolean } & DB3AuthSpec) => (
    new GenericStringField({
        columnName,
        allowNull,
        format: "raw",
        authMap: (authSpec as any).authMap || null,
        _customAuth: (authSpec as any)._customAuth || null,
    }));
