// TODO: Assess whether this should be a generic datetime field?
// are there event-specific behaviors at work?

import { TAnyModel } from "@/shared/rootroot";
import { assert } from "blitz";
import { assertIsNumberArray } from "shared/arrayUtils";
import { z } from "zod";
import { gSwatchColors } from "../../../components/color/palette";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion, DiscreteCriterionFilterType,
    EventFutureFilterExpression, EventPast60DaysFilterExpression, EventPastFilterExpression, EventRelevantFilterExpression, type SearchResultsFacetOption,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import {
    type DB3AuthSpec, type DB3MaybeNull, type DB3ReadPresenceForAuthSpec,
    type DB3RowMode, ErrorValidateAndParseResult, FieldBase, makeNullableReadTransportSchema,
    type SqlGetSortableQueryElementsAPI,
    SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type EventStartsAtFieldArgs<
    TAllowNull extends boolean,
    TAuthSpec extends DB3AuthSpec,
> = {
    columnName: string;
    allowNull: TAllowNull;
} & TAuthSpec;

type EventStartsAtFieldDiscreteFilterTRow = {
    id: number, // facet IDs for this custom faceting are not database pks, they are contrived. but required for selecting etc.
    facetType: string,
    year: number | null, // null = TBD
    rowCount: bigint
};

export interface EventStartsAtFieldDiscreteFilterDomain {
    id: number,
    matchesId: (id: number) => boolean;
    transformResult: (row: EventStartsAtFieldDiscreteFilterTRow) => SearchResultsFacetOption,
    SqlMatch: (id: number) => string,
}

const gTbdId = 9999;

export class EventStartsAtField<
    TAllowNull extends boolean = boolean,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    Date,
    undefined,
    true,
    DB3MaybeNull<Date, TAllowNull>,
    DB3MaybeNull<Date, TAllowNull>,
    DB3ReadPresenceForAuthSpec<TAuthSpec>
> {

    allowNull: boolean;
    localTableSpec: xTable;

    yearDomain: EventStartsAtFieldDiscreteFilterDomain;
    pastDomain: EventStartsAtFieldDiscreteFilterDomain;
    futureDomain: EventStartsAtFieldDiscreteFilterDomain;
    relevantDomain: EventStartsAtFieldDiscreteFilterDomain;
    past60DaysDomain: EventStartsAtFieldDiscreteFilterDomain;

    searchDomains: EventStartsAtFieldDiscreteFilterDomain[];

    constructor(args: EventStartsAtFieldArgs<TAllowNull, TAuthSpec>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "tableColumn",
            defaultValue: args.allowNull ? null : new Date(),
            readTransportSchema: makeNullableReadTransportSchema(z.date(), args.allowNull),
            authMap: (args as any).authMap || null,
            specialFunction: undefined,
            _customAuth: (args as any)._customAuth || null,
        });
        this.allowNull = args.allowNull;

        this.yearDomain = {
            id: 0, // for per-year, the year IS the ID.
            matchesId: (id: number) => {
                return id < 10000;
            },
            transformResult: (row) => {
                const id = row.id;//new Number(row.year || gTbdId).valueOf();
                if (id === gTbdId) {
                    return {
                        id,
                        label: "TBD",
                        color: gSwatchColors.light_gray,
                        iconName: null,
                        rowCount: new Number(row.rowCount).valueOf(),
                        tooltip: `Select TBD events (with no date)`,
                        shape: undefined,
                    };
                }
                return {
                    id,
                    label: id.toString(),
                    color: null,
                    iconName: null,
                    rowCount: new Number(row.rowCount).valueOf(),
                    tooltip: `Select year ${row.year}`,
                    shape: undefined,
                };
            },
            SqlMatch: (id: number) => {
                if (id === gTbdId) {
                    return `isnull(${this.member})`;
                }
                return `(year(${this.member}) = ${id})`;
            },
        };

        this.pastDomain = {
            id: 10000,
            matchesId: (id: number) => id === 10000,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Past",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: `Past`,
                shape: undefined,
            }),
            SqlMatch: () => EventPastFilterExpression({ startsAtExpr: this.member }),
        };

        this.futureDomain =
        {
            id: 10001,
            matchesId: (id: number) => id === 10001,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Future",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: `Future`,
                shape: undefined,
            }),
            SqlMatch: () => EventFutureFilterExpression({ startsAtExpr: this.member }),
        };

        this.relevantDomain = {
            id: 10002,
            matchesId: (id: number) => id === 10002,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Relevant",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: "Relevant (6 days ago and later)",
                shape: undefined,
            }),
            SqlMatch: () => EventRelevantFilterExpression({ startsAtExpr: this.member }),
        };

        this.past60DaysDomain = {
            id: 10003,
            matchesId: (id: number) => id === 10003,
            transformResult: (row) => ({
                id: new Number(row.id).valueOf(),
                label: "Past 60 days",
                color: gSwatchColors.light_gray,
                iconName: null,
                rowCount: new Number(row.rowCount).valueOf(),
                tooltip: "60 days ago until now",
                shape: undefined,
            }),
            SqlMatch: () => EventPast60DaysFilterExpression({ startsAtExpr: this.member }),
        };

        this.searchDomains = [
            this.yearDomain,
            this.pastDomain,
            this.futureDomain,
            this.relevantDomain,
            this.past60DaysDomain,
        ];
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

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
        if (value === null) {
            if (this.allowNull) {
                return SuccessfulValidateAndParseResult(objValue);
            }
            return ErrorValidateAndParseResult("field is required", objValue);
        }
        if (typeof (value) === 'string') {
            // string to date conv.
            //const parseResult = Date.parse(val);
            const parsedDate = new Date(value);
            //  If called with an invalid date string, or if the date to be constructed will have a timestamp less than -8,640,000,000,000,000
            // or greater than 8,640,000,000,000,000 milliseconds, it returns an invalid date (a Date object whose toString() method
            // returns "Invalid Date" and valueOf() method returns NaN).
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
            if (isNaN(parsedDate.valueOf())) {
                return ErrorValidateAndParseResult("Not a valid date", objValue);
            }
            value = parsedDate;
            objValue[this.member] = value;
        }
        if (value instanceof Date) {
            if (isNaN(value.valueOf())) {
                return ErrorValidateAndParseResult("Date is invalid", objValue);
            }
        }
        return SuccessfulValidateAndParseResult(objValue);
    };

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    isEqual = (a: Date, b: Date) => {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDay() === b.getDay() &&
            a.getHours() === b.getHours() &&
            a.getMinutes() === b.getMinutes();
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        //console.assert(clientModel[this.member] instanceof Date);
        if (clientModel[this.member] === undefined) return;
        const vr = this.ValidateAndParse({ row: clientModel, mode });
        Object.assign(mutationModel, vr.values);
    };
    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        const v = dbModel[this.member];
        if (v === null) {
            clientModel[this.member] = null;
            return;
        }
        console.assert(dbModel[this.member] instanceof Date);
        clientModel[this.member] = dbModel[this.member];
    }

    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => {
        return {
            join: [],
            select: [
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member} is null`,
                    direction: api.sortModel.direction,
                },
                {
                    alias: api.getColumnAlias(),
                    expression: `${api.primaryTableAlias}.${this.member}`,
                    direction: api.sortModel.direction,
                }
            ],
        };
    };
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => {

        // for ranges, attempting to keep the optional hyphens is just impractical and confusing. so a more strict format is required and clearer.
        // 2023-2024
        // 202311-202312
        // 20231122-20231220
        const rangeRegex = /^(2\d{3})(\d\d)?(\d\d)?-(2\d{3})(\d\d)?(\d\d)?/;
        // groups:
        // 1: start year (required)
        // 2: start month
        // 3: start day
        // 4: end year (required)
        // 5: end month
        // 6: end day
        const rangeMatch = rangeRegex.exec(token);
        if (rangeMatch) {
            const startYear = rangeMatch[1];
            const startMonth = rangeMatch[2] || '01';
            const startDay = rangeMatch[3] || '01';
            const endYear = rangeMatch[4];
            const endMonth = rangeMatch[5] || '12';
            let endDay: string;

            // Calculate the last day of the end month
            if (!rangeMatch[6]) {
                const lastDayOfMonth = new Date(Number(endYear), Number(endMonth), 0).getDate();
                endDay = lastDayOfMonth.toString().padStart(2, '0');
            } else {
                endDay = rangeMatch[6];
            }

            // Note: date() extracts the date portion, which allows us to use 31 December as the end date rather than having to go to 1 Jan of the next year which is more complex.

            const startDate = `${startYear}-${startMonth}-${startDay}`;
            const endDate = `${endYear}-${endMonth}-${endDay}`;

            const expr = `(date(${this.member}) BETWEEN '${startDate}' AND '${endDate}')`;
            return expr;
        }

        // types of date formats:
        // 2023
        // 2023-11
        // 202311
        // 2023-11-22
        // 20231122

        // year part is 2nnn (match[1])
        // optional hyphen
        // optional month part is n or nn (match[2])
        // optional hyphen
        // optional day part is n or nn (match[3])
        const regex = /^(2\d{3})-?(\d{1,2})?-?(\d{1,2})?/;

        // Execute the regex on the input string
        const match = regex.exec(token);

        // Check if the match was successful
        if (match) {
            const parts: string[] = [];
            if (match[1]) {
                parts.push(`(YEAR(${this.member}) = ${match[1]})`);
            }
            if (match[2]) {
                parts.push(`(MONTH(${this.member}) = ${match[2]})`);
            }
            if (match[3]) {
                parts.push(`(dayofmonth(${this.member}) = ${match[3]})`);
            }
            return `(${parts.join(` AND `)})`;
        }

        return null;
    }

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);

        // for the moment only support either having 1 criterion or none.
        const generalMatch = (): CriterionQueryElements => {
            if (crit.options.length !== 1) {
                return {
                    error: "Please select 1 option",
                    whereAnd: `(false)`,
                };
            }
            const id = crit.options[0] as number;
            const d = this.searchDomains.find(x => x.matchesId(id));
            if (!d) throw new Error(`date search facet domain not found: ${id}; should be a year, past, future, ...`);
            return {
                error: undefined,
                whereAnd: d.SqlMatch(id),
            };
        };

        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `(true)`,
                }
            },
            hasAny: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.member} is not null)`, // "has any date" i am not 100% certain makes sense to filter for TBD. but go for it; edge case
                };
            },
            hasNone: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.member} is null)`,
                };
            },
            hasSomeOf: generalMatch,
            hasAllOf: generalMatch,
            doesntHaveAnyOf: () => {
                throw new Error(`query type 'doesntHaveAnyOf' is impossible for date fields.`);
            },
            doesntHaveAllOf: () => {
                throw new Error(`query type 'doesntHaveAllOf' is impossible for date fields.`);
            },
        };
        return map[crit.behavior]();
    };

    // return a SQL query which is executed, then a transformation function that returns the 
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => {
        return {
            sql: `
        with FIQ as (${filteredQuery})

        select
            -- NB: make sure the columns conform to EventStartsAtFieldDiscreteFilterTRow
            coalesce(year(${this.member}), ${gTbdId}) id,
            'year' facetType,
            coalesce(year(${this.member}), ${gTbdId}) year,
            coalesce(year(${this.member}), ${gTbdId}) sortOrder,
            count(FIQ.id) rowCount
        from
            ${this.localTableSpec.tableName} as P
            left join FIQ on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        group by
            coalesce(year(${this.member}), ${gTbdId})
        
        union all
        
        select
            ${this.pastDomain.id} id,
            'past' facetType,
            null year,
            ${this.pastDomain.id} sortOrder,
            count(P.id) rowCount
        from
            FIQ
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        where
            ${EventPastFilterExpression({ startsAtExpr: this.member })}
        
        union all
        
        select
            ${this.futureDomain.id} id,
            'future' facetType,
            null year,
            ${this.futureDomain.id} sortOrder,
            count(P.id) rowCount
        from
            FIQ
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
        where
            ${EventFutureFilterExpression({ startsAtExpr: this.member })}

        union all
        
            select
                ${this.relevantDomain.id} id,
                'relevant' facetType,
                null year,
                ${this.relevantDomain.id} sortOrder,
                count(P.id) rowCount
            from
                FIQ
                inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
            where
                ${EventRelevantFilterExpression({ startsAtExpr: this.member })}

        union all
    
            select
                ${this.past60DaysDomain.id} id,
                'relevant' facetType,
                null year,
                ${this.past60DaysDomain.id} sortOrder,
                count(P.id) rowCount
            from
                FIQ
                inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the startsAt field
            where
                ${EventPast60DaysFilterExpression({ startsAtExpr: this.member })}
    
        order by
            sortOrder
            `,
            transformResult: (row: EventStartsAtFieldDiscreteFilterTRow): SearchResultsFacetOption => {
                //const d = this.domainMap[row.id];
                row.id = new Number(row.id).valueOf();
                const d = this.searchDomains.find(x => x.matchesId(row.id));
                assert(!!d, `incomplete domain map? row doesn't have corresponding startsAt filter domain: ${JSON.stringify(row)}`);
                return d.transformResult(row);
            },
        }
    };


};

