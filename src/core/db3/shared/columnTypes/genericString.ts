
import { TAnyModel } from "@/shared/rootroot";
import { MysqlEscape } from "shared/mysqlUtils";
import { CoerceToBoolean, isValidURL } from "shared/utils";
import { z } from "zod";
import { type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion, DiscreteCriterionFilterType, type SearchResultsFacetQuery, type SortQueryElements } from "../apiTypes";
import {
    type DB3AuthSpec, type DB3MaybeNull, type DB3ReadPresenceForAuthSpec,
    ErrorValidateAndParseResult, FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult,
    UndefinedValidateAndParseResult, type ValidateAndParseArgs, type ValidateAndParseResult, xTable
} from "../db3core";
import type { UserWithRolesPayload } from "../schema/userPayloads";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for validation and client UI behavior.
export type StringFieldFormatOptions = "plain" | "email" | "markdown" | "title" | "raw" | "uri" | "customLinkSlug";

export type GenericStringFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
> = {
    columnName: string;
    format: StringFieldFormatOptions;
    allowNull: TAllowNull;
    caseSensitive?: boolean;
    allowQuickFilter?: boolean;
    allowDiscreteCriteria?: boolean;
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & TAuthSpec;

export class GenericStringField<
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
    caseSensitive: boolean;
    allowNull: boolean;
    minLength: number;
    doTrim: boolean;
    format: StringFieldFormatOptions;
    allowQuickFilter: boolean;
    allowDiscreteCriteria: boolean;
    table?: xTable;

    constructor(args: GenericStringFieldArgs<TAllowNull, TAuthSpec>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : "",
            readTransportSchema: makeNullableReadTransportSchema(z.string(), args.allowNull),
            specialFunction: args.specialFunction,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });

        this.format = args.format;
        this.allowNull = args.allowNull;
        this.allowQuickFilter = CoerceToBoolean(args.allowQuickFilter, args.format !== "markdown");
        this.allowDiscreteCriteria = CoerceToBoolean(args.allowDiscreteCriteria, false);

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

    connectToTable = (table: xTable) => {
        this.table = table;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => {
        if (!this.allowQuickFilter) return false;
        return { [this.member]: { contains: query } };
    };

    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    // this column type has no sub-items; no filtering to do.
    ApplyIncludeFiltering = (include: TAnyModel) => { };

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

    ApplyToNewRow = (args: TAnyModel) => {
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
    };

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion, tableAlias: string): CriterionQueryElements | null => {
        // Only support discrete criteria if explicitly enabled for this field
        if (!this.allowDiscreteCriteria) return null;

        const assertIsStringArray = (options: any[]): options is string[] => {
            return options.every(opt => typeof opt === 'string');
        };

        assertIsStringArray(crit.options);
        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ true)`,
                }
            },
            hasAny: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} is not null and ${tableAlias}.${this.member} != '')`,
                };
            },
            hasNone: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} is null or ${tableAlias}.${this.member} = '')`,
                };
            },
            hasSomeOf: () => {
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `( /* ${this.member} */ false)`,
                };
                const escapedOptions = crit.options.map(opt => `'${MysqlEscape(opt)}'`);
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} = ${escapedOptions[0]})`,
                };
                return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} in (${escapedOptions.join(",")}))`,
                };
            },
            hasAllOf: () => {
                // For string fields, "hasAllOf" doesn't make sense since a field can only have one value
                throw new Error(`query type 'hasAllOf' is impossible for string fields. make sure your filter spec doesn't invoke it. field:${crit.db3Column}`);
            },
            doesntHaveAnyOf: () => {
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} is not null and ${tableAlias}.${this.member} != '')`,
                };
                const escapedOptions = crit.options.map(opt => `'${MysqlEscape(opt)}'`);
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} != ${escapedOptions[0]} or ${tableAlias}.${this.member} is null)`,
                };
                return {
                    error: undefined,
                    whereAnd: `( /* ${this.member} */ ${tableAlias}.${this.member} not in (${escapedOptions.join(",")}) or ${tableAlias}.${this.member} is null)`,
                };
            },
            doesntHaveAllOf: () => {
                // This also doesn't make sense for string fields
                throw new Error(`query type 'doesntHaveAllOf' is impossible for string fields. make sure your filter spec doesn't invoke it; maybe you mean to use 'doesntHaveAnyOf'.`);
            },
        };
        return map[crit.behavior]();
    };

    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => {
        // Only support facet queries if explicitly enabled for this field
        if (!this.allowDiscreteCriteria) return null;

        const filteredQuery = filteredItemsQueryExcludingThisCriterion;

        // Return a query that gets distinct values for this string field along with their counts
        return {
            sql: `with FIQ as (
                ${filteredQuery}
            )
            -- null/empty option
            SELECT
                '(empty)' as id,
                '(empty)' as label,
                null as color,
                null as iconName,
                null as tooltip,
                count(distinct(FIQ.id)) AS rowCount,
                0 as sortOrder
            FROM
                FIQ
                inner join ${this.table!.tableName} as P on P.${this.table!.pkMember} = FIQ.id
            where
                (P.${this.member} is null or P.${this.member} = '')

            union all

            SELECT
                P.${this.member} as id,
                P.${this.member} as label,
                null as color,
                null as iconName,
                null as tooltip,
                count(distinct(FIQ.id)) AS rowCount,
                1 as sortOrder
            FROM
                FIQ
                inner join ${this.table!.tableName} as P on P.${this.table!.pkMember} = FIQ.id
            where
                P.${this.member} is not null and P.${this.member} != ''
            GROUP BY 
                P.${this.member}
            order by
                sortOrder asc, label asc
                `,
            transformResult: (row: { id: string, label: string | null, color: string | null, iconName: string | null, tooltip: string | null, rowCount: bigint }) => {
                const rowCount = new Number(row.rowCount).valueOf();
                return {
                    id: row.id,
                    rowCount,
                    label: row.label || '(empty)',
                    color: row.color,
                    iconName: row.iconName,
                    tooltip: row.tooltip,
                    shape: undefined,
                };
            },
        };
    };
};



export const MakePlainTextField = <TAuthSpec extends DB3AuthSpec>(columnName: string, authSpec: TAuthSpec) => (
    new GenericStringField({
        ...authSpec,
        columnName,
        allowNull: false,
        format: "plain",
    }));
export const MakeNullableRawTextField = <TAuthSpec extends DB3AuthSpec>(columnName: string, authSpec: TAuthSpec) => (
    new GenericStringField({
        ...authSpec,
        columnName,
        allowNull: true,
        format: "raw",
    }));
export const MakeRawTextField = <
    TAuthSpec extends DB3AuthSpec,
    TAllowNull extends boolean = false,
>(columnName: string, authSpec: TAuthSpec, allowNull?: TAllowNull) => (
    new GenericStringField<TAllowNull, TAuthSpec>({
        ...authSpec,
        columnName,
        allowNull: (allowNull ?? false) as TAllowNull,
        format: "raw",
    }));
export const MakeMarkdownTextField = <
    TAuthSpec extends DB3AuthSpec,
    TAllowNull extends boolean = false,
>(columnName: string, authSpec: TAuthSpec, allowNull?: TAllowNull) => (
    new GenericStringField<TAllowNull, TAuthSpec>({
        ...authSpec,
        columnName,
        allowNull: (allowNull ?? false) as TAllowNull,
        allowQuickFilter: false,
        format: "markdown",
    }));
export const MakeTitleField = <TAuthSpec extends DB3AuthSpec>(columnName: string, authSpec: TAuthSpec) => (
    new GenericStringField({
        ...authSpec,
        columnName,
        allowNull: false,
        format: "title",
        specialFunction: SqlSpecialColumnFunction.name,
        allowQuickFilter: true,
    }));

export const MakeDescriptionField = <TAuthSpec extends DB3AuthSpec>(args: { columnName?: string } & TAuthSpec) => (
    new GenericStringField<false, TAuthSpec>({
        ...args,
        columnName: args.columnName ?? "description",
        allowNull: false,
        format: "markdown",
        specialFunction: SqlSpecialColumnFunction.description,
    })
);

// this does not convert to colorpaletteentry
export const MakeColorAsStringField = <
    TAuthSpec extends DB3AuthSpec,
    TAllowNull extends boolean = true,
>(args: { columnName?: string, allowNull?: TAllowNull } & TAuthSpec) => (
    new GenericStringField<TAllowNull, TAuthSpec>({
        ...args,
        columnName: args.columnName ?? "color",
        allowNull: (args.allowNull ?? true) as TAllowNull,
        format: "raw",
    }));
