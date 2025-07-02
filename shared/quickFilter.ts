import { z } from "zod";
import { calculateMatchStrengthAllKeywordsRequired, calculateMatchStrengthAnyKeyword } from "./rootroot";
import { IsEntirelyIntegral, IsNullOrWhitespace } from "./utils";
import { partition } from "./arrayUtils";

// TODO: remove this in favor of better quick search stuff below.
export function SplitQuickFilter(quickFilter: string): string[] {
    return quickFilter.toLowerCase().split(/\s+/).filter(token => !IsNullOrWhitespace(token));
}


// 2025
// 2025-01
// 2025-01-31
// hyphens optional; returns start & end dates of the parse range, or null.
function parseDateRange(input) {
    const regex = /^(\d{2,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;
    const match = input.match(regex);
    if (!match) return null; // not a date-like input

    let year = parseInt(match[1], 10);
    if (year < 2000) year += 2000;

    const month = match[2] ? parseInt(match[2], 10) : null;
    const day = match[3] ? parseInt(match[3], 10) : null;

    if (year && !month && !day) {
        // year only
        return {
            start: new Date(year, 0, 1),
            end: new Date(year + 1, 0, 1)
        };
    } else if (year && month && !day) {
        // year-month
        return {
            start: new Date(year, month - 1, 1),
            end: new Date(year, month, 1)
        }
    } else if (year && month && day) {
        // year-month-day
        return {
            start: new Date(year, month - 1, day),
            end: new Date(year, month - 1, day + 1)
        }
    } else {
        return null;
    }
}

export enum QuickSearchItemType {
    "event" = "event",
    "song" = "song",
    "user" = "user",
    "wikiPage" = "wikiPage",
};

export interface QuickSearchItemMatch {
    id: number,
    name: string,
    absoluteUri?: string | undefined,
    matchStrength: number;
    matchingField: string | undefined;
    itemType: QuickSearchItemType;

    canonicalWikiSlug?: string | undefined, // for wiki pages return this.

    // here give context on the match. a snippet of the matching text with highlights
};


export const QuickSearchItemTypeSets /*: { [k: string]: QuickSearchItemType[] }*/ = {
    Songs: [QuickSearchItemType.song],
    WikiPages: [QuickSearchItemType.wikiPage],
    Everything: [
        QuickSearchItemType.event,
        QuickSearchItemType.song,
        QuickSearchItemType.user,
        QuickSearchItemType.wikiPage
    ],
    ForMarkdownReference: [
        QuickSearchItemType.event,
        QuickSearchItemType.song,
        QuickSearchItemType.user,
    ],
};

export const ZQuickSearchItemTypeArray = z.array(
    z.enum(["event", "song", "user", "wikiPage"])
).transform((value) => value as QuickSearchItemType[]);

export type QuickSearchItemTypeArray = z.infer<typeof ZQuickSearchItemTypeArray>;

export interface ParseQuickFilterResult {
    keywords: string[];
    tags: string[];
    pkid: number | null;
    typeFilter: string | null; // prefix a query with a type to filter by. e.g. "event:foo" or "song:foo"
    dateRange: { start: Date, end: Date } | undefined;
};

export function ParseQuickFilter(quickFilter: string): ParseQuickFilterResult {

    // first extract the type filter, if any.
    const typeFilterMatch = quickFilter.match(/^([a-zA-Z]+):/);
    let typeFilter: string | null = null;
    if (typeFilterMatch) {
        typeFilter = typeFilterMatch[1]!.toLowerCase();
        quickFilter = quickFilter.substring(typeFilterMatch[0].length); // remove the type filter from the query
    }

    const keywords = SplitQuickFilter(quickFilter);
    let dateRange: { start: Date, end: Date } | undefined = undefined;
    for (const keyword of keywords) {
        const parsedDateRange = parseDateRange(keyword);
        if (parsedDateRange) {
            dateRange = parsedDateRange;
        }
    }

    const [tagKeywords, nonTagKeywords] = partition(keywords, (keyword) => keyword.startsWith("#"));

    return {
        keywords: nonTagKeywords,
        tags: tagKeywords.map(tag => tag.substring(1)), // remove the # from the tag
        pkid: IsEntirelyIntegral(quickFilter) ? parseInt(quickFilter, 10) : null,
        dateRange,
        typeFilter,
    };
};

// returns an array of { field : contains: keyword } objects.
// callers decide whether to use AND (require all keyword match) or OR (require at least 1 keyword match) to combine them
function MakeWhereInputConditions(fieldName: string, keywords: string[]) {
    return keywords.map(keyword => ({
        [fieldName]: {
            contains: keyword
        }
    }));
}

function MakeWhereInputConditionRequiringAllKeywords(fieldName: string, keywords: string[]) {
    return { AND: MakeWhereInputConditions(fieldName, keywords) };
}

// // a condition testing for multiple keywords over multiple columns.
// // ALL keywords are required to match, but they can be in any of the columns.
// export function MakeWhereInputConditionRequiringAllKeywordsOverMultipleFields(fieldNames: string[], keywords: string[]) {
//     return { OR: fieldNames.map(fieldName => MakeWhereInputConditionRequiringAllKeywords(fieldName, keywords)) };
// }

export type SearchableTableFieldType = "string" | "pk" | "date";

export interface SearchableTableFieldSpec {
    fieldName: string;
    fieldType: SearchableTableFieldType;
    strengthMultiplier: number; // tweak matches
}

// given a list of db field info, and parsed query, return a single prisma condition to find matches
export function MakeWhereCondition(fields: SearchableTableFieldSpec[], keywords: ParseQuickFilterResult) {
    const conditions: any[] = [];

    for (const field of fields) {
        switch (field.fieldType) {
            case "string":
                conditions.push(MakeWhereInputConditionRequiringAllKeywords(field.fieldName, keywords.keywords));
                break;
            case "pk":
                if (keywords.pkid) {
                    conditions.push({
                        [field.fieldName]: keywords.pkid,
                    });
                }
                break;
            case "date":
                if (keywords.dateRange) {
                    conditions.push({
                        [field.fieldName]: {
                            gte: keywords.dateRange.start,
                            lt: keywords.dateRange.end,
                        },
                    });
                }
                break;
        }
    }

    return { OR: conditions };
};


export function MakeWhereConditionForTags(field: SearchableTableFieldSpec, keywords: ParseQuickFilterResult) {
    return { OR: [...MakeWhereInputConditions(field.fieldName, keywords.tags)] };
};



interface CalculateMatchStrengthResult {
    fieldName: string;
    matchStrength: number;
}


const gPkMatchStrength = 3;
const gDateRangeMatchStrength = 3;

function CalculateMatchStrengthForField(field: SearchableTableFieldSpec, value: any, filter: ParseQuickFilterResult): CalculateMatchStrengthResult {
    const NoMatch = {
        fieldName: field.fieldName,
        matchStrength: 0,
    };
    switch (field.fieldType) {
        case "string":
            return {
                fieldName: field.fieldName,
                matchStrength: field.strengthMultiplier * calculateMatchStrengthAllKeywordsRequired(value, filter.keywords),
            };
        case "pk":
            if (!filter.pkid || filter.pkid !== value) {
                return NoMatch;
            }
            return {
                fieldName: field.fieldName,
                matchStrength: field.strengthMultiplier * gPkMatchStrength,
            };
        case "date":
            if (!filter.dateRange) {
                return NoMatch;
            }
            const dateMatches = value >= filter.dateRange.start && value < filter.dateRange.end;
            if (!dateMatches) {
                return NoMatch;
            }
            return {
                fieldName: field.fieldName,
                matchStrength: field.strengthMultiplier * gDateRangeMatchStrength,
            };
    };
}

export function CalculateMatchStrength(fields: SearchableTableFieldSpec[], values: Record<string, any>, filter: ParseQuickFilterResult): CalculateMatchStrengthResult {
    // calculate a result for all fields, then return the best match.
    let results: CalculateMatchStrengthResult[] = [];
    for (const field of fields) {
        const value = values[field.fieldName];
        if (!value) continue;
        results.push(CalculateMatchStrengthForField(field, value, filter));
    }

    // filter out 0-strength matches.
    results = results.filter(result => result.matchStrength > 0);
    if (results.length === 0) return {
        fieldName: "",
        matchStrength: 0,
    }; // no matches found.

    // // return the best match.
    // const bestMatch = results.reduce((prev, current) => {
    //     return (prev.matchStrength > current.matchStrength) ? prev : current;
    // });
    //return bestMatch;

    // return combined match
    const totalMatchStrength = results.reduce((prev, current) => {
        return prev + current.matchStrength;
    }, 0);

    return {
        fieldName: results.map(r => r.fieldName).join(","), // results[0]!.fieldName,
        matchStrength: totalMatchStrength,
    };
};



function CalculateMatchStrengthForTagField(field: SearchableTableFieldSpec, value: any, filter: ParseQuickFilterResult): CalculateMatchStrengthResult {
    return {
        fieldName: field.fieldName,
        matchStrength: field.strengthMultiplier * calculateMatchStrengthAnyKeyword(value, filter.tags),
    };
}

export function CalculateMatchStrengthForTags(tagNameFieldSpec: SearchableTableFieldSpec, tagRecords: Record<string, string>[], filter: ParseQuickFilterResult): CalculateMatchStrengthResult {

    // calculate a result for all tags, then return the best match.
    let results: CalculateMatchStrengthResult[] = [];
    for (const tagRecord of tagRecords) {
        const tagName = tagRecord[tagNameFieldSpec.fieldName];
        if (!tagName) continue;
        results.push(CalculateMatchStrengthForTagField(tagNameFieldSpec, tagName, filter));
    }

    // filter out 0-strength matches.
    results = results.filter(result => result.matchStrength > 0);
    if (results.length === 0) return {
        fieldName: "",
        matchStrength: 0,
    }; // no matches found.

    // matching multiple tags yields a very strong match. sum and return.
    const totalMatchStrength = results.reduce((prev, current) => {
        return prev + current.matchStrength;
    }, 0);

    return {
        fieldName: tagNameFieldSpec.fieldName,
        matchStrength: totalMatchStrength,
    };
};