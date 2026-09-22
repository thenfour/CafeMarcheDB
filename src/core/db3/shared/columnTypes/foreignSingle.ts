
import { TAnyModel } from "@/shared/rootroot";
import { assertIsNumberArray } from "shared/arrayUtils";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion, DiscreteCriterionFilterType,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import type { DB3Authorization } from "../db3Authorization";
import {
    type DB3AuthSpec, type DB3FieldPrismaMember, type DB3RowMode, ErrorValidateAndParseResult,
    FieldBase, GetTableById, type SqlGetSortableQueryElementsAPI, SqlSpecialColumnFunction, SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";

////////////////////////////////////////////////////////////////
// a single select field where the items are a db table with relation
// on client side, there is NO foreign key field (like instrumentId). Only the foreign object ('instrument').
export type ForeignSingleFieldArgs<TForeign> = {
    columnName: string; // "instrumentType"
    fkidMember: string; // "instrumentTypeId"
    foreignTableID: string; // for circular referencing don't force caller to use the xTable.
    allowNull: boolean;
    // Omit the local row when its target cannot be read. Use for dependent
    // records, such as a setlist entry whose song must remain private.
    requireVisibleTarget?: boolean;
    defaultValue?: TForeign | null;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    specialFunction?: SqlSpecialColumnFunction | undefined;
} & DB3AuthSpec;

// The write member is fkidMember rather than this field-map key, so it is not a
// same-key mutation field. Its projected key is supplied by the client column.
export class ForeignSingleField<TForeign> extends FieldBase<TForeign, undefined, false> {
    requireVisibleTarget: boolean;
    foreignTableID: string;
    localTableSpec: xTable;
    allowNull: boolean;
    defaultValue: TForeign | null;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.

    getForeignTableSchema = () => {
        return GetTableById(this.foreignTableID);
    };

    getPrismaMemberDescriptors = (): readonly DB3FieldPrismaMember[] => [{
        member: this.member,
        kind: "foreignObject",
    }, {
        member: this.fkidMember!,
        kind: "foreignKey",
    }];

    constructor(args: ForeignSingleFieldArgs<TForeign>) {
        super({
            member: args.columnName,
            fieldTableAssociation: "foreignObject",
            defaultValue: args.defaultValue || null,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
            specialFunction: args.specialFunction,
            fkidMember: args.fkidMember,
            _matchesMemberForAuthorization: (memberName: string) => {
                const mnl = memberName.toLowerCase();
                return mnl === this.member.toLowerCase() || mnl === this.fkidMember!.toLowerCase();
            },
        });

        // // does default behavior of case-insensitive, trimmed compare.
        // const itemExactlyMatches_defaultImpl = (value: TForeign, filterText: string): boolean => {
        //     //console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
        //     // if (!this.getChipCaption) {
        //     //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On ForeignSingleField ${args.columnName}`);
        //     // }
        //     //return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
        //     const rowInfo = this.getForeignTableSchema().getRowInfo(value as TAnyModel);
        //     return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        // }

        //this.fkMember = args.fkMember;
        this.allowNull = args.allowNull;
        this.requireVisibleTarget = args.requireVisibleTarget === true;
        this.defaultValue = args.defaultValue || null;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        //this.getForeignQuickFilterWhereClause = args.getForeignQuickFilterWhereClause;
        //this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
    }

    get allowInsertFromString() {
        return !!this.getForeignTableSchema().createInsertModelFromString;
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

    isEqual = (a: TForeign, b: TForeign) => {
        return a[this.getForeignTableSchema().clientIdMember] === b[this.getForeignTableSchema().clientIdMember];
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);
    getCustomFilterWhereClause = (query: CMDBTableFilterModel): TAnyModel | boolean => false;

    getOverallWhereClause = (): TAnyModel | boolean => false;

    getRowVisibilityWhereClause = async (publicData: DB3Authorization, includeDeleted: boolean): Promise<TAnyModel | undefined> => {
        if (!this.requireVisibleTarget) return undefined;
        const where = await this.getForeignTableSchema().CalculateWhereClause({
            publicData, includeDeleted, filterModel: { items: [] },
        });
        return { [this.member]: { is: where || {} } };
    };

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3Authorization, includeDeleted: boolean) => {
        const targetArgs = include[this.member];
        if (!targetArgs) return;
        await this.getForeignTableSchema().ApplyIncludeFiltering(targetArgs.include || targetArgs.select, publicData, includeDeleted);
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        //ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // leaves behind the fk id.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyToNewRow: FieldBase<TForeign>["ApplyToNewRow"] = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // mutations want ONLY the id, not the object. but in the case both exist, use the object not the fk.
        const foreignPk = this.getForeignTableSchema().clientIdMember;
        if (clientModel[this.member] !== undefined) {
            if (clientModel[this.member] === null) {
                mutationModel[this.fkidMember!] = null; // assumes foreign pk is 'id'
            } else {
                mutationModel[this.fkidMember!] = clientModel[this.member][foreignPk]; // assumes foreign pk is 'id'
            }
            return;
        }

        if (clientModel[this.fkidMember!] !== undefined) {
            if (clientModel[this.fkidMember!] === null) {
                mutationModel[this.fkidMember!] = null; // assumes foreign pk is 'id'
            } else {
                mutationModel[this.fkidMember!] = clientModel[this.fkidMember!]; // assumes foreign pk is 'id'
            }
            return;
        }



        // if (clientModel[this.fkMember]) {
        //     mutationModel[this.fkMember] = clientModel[this.fkMember];
        //     return;
        // }
        // const foreign = clientModel[this.member];
        // if (foreign === undefined) return;
        // if (foreign === null) {
        //     mutationModel[this.fkMember] = null;
        //     return;
        // }
        // mutationModel[this.fkMember] = foreign[this.getForeignTableSchema().pkMember];
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<TForeign>): ValidateAndParseResult<TForeign | null> => {
        let value = args.row[this.member];
        if (value === undefined) {
            let fkvalue = args.row[this.fkidMember!];
            if (fkvalue === undefined) return UndefinedValidateAndParseResult(); // both are undefined.

            // operate on fk instead of object.
            if (fkvalue === null && !this.allowNull) return ErrorValidateAndParseResult("field is required", { [this.fkidMember!]: fkvalue });
            return SuccessfulValidateAndParseResult({ [this.fkidMember!]: fkvalue });
        }

        if (value === null) {
            if (!this.allowNull) return ErrorValidateAndParseResult("field is required", {
                [this.member]: null,
                [this.fkidMember!]: null,
            });
            return SuccessfulValidateAndParseResult({
                [this.member]: null,
                [this.fkidMember!]: null,
            });
        }
        return SuccessfulValidateAndParseResult({
            [this.member]: value,
            [this.fkidMember!]: value[this.getForeignTableSchema().clientIdMember],
        });
    };

    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;
    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);
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
                    whereAnd: `(${this.fkidMember} is not null)`,
                };
            },
            hasNone: () => { // no options considered
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} is null)`,
                };
            },
            hasSomeOf: () => {
                // this is a bit meaningless but let's allow it. if you are demanding "some of" but don't specify anything, you necessarily get no results.
                // it gives continuity when selecting/deselecting items in the gui or switching back and forth between "include" vs. "exclude"
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `(false)`,//whereAnd: `(${this.fkMember} is null)`,
                };
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} = ${crit.options[0]})`,
                };
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} in (${crit.options.join(",")}))`,
                };
            },
            hasAllOf: () => {
                // you can't have multiple of this type of member; it would be impossible 
                throw new Error(`query type 'hasAllOf' is impossible for foreign single fields. make sure your filter spec doesn't invoke it. field:${crit.db3Column}`);
            },
            doesntHaveAnyOf: () => {
                // similar to hasSomeOf with 0 items, treat 0 items as a synonym for null.
                if (crit.options.length === 0) return {
                    error: "Select options to filter on",
                    whereAnd: `(${this.fkidMember} is not null)`,
                };
                if (crit.options.length === 1) return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} != ${crit.options[0]})`,
                };
                return {
                    error: undefined,
                    whereAnd: `(${this.fkidMember} not in (${crit.options.join(",")}))`,
                };
            },
            doesntHaveAllOf: () => {
                // this also doesn't make sense for fk fields. exclude it if it has all of (x,y,z) is meaningless.
                // yes, if there is 1 option here then it can mean something but then use doesntHaveAnyOf.
                throw new Error(`query type 'doesntHaveAllOf' is impossible for foreign single fields. make sure your filter spec doesn't invoke it; maybe you mean to use 'doesntHaveAnyOf'.`);
            },
        };
        return map[crit.behavior]();
    };
    SqlGetFacetInfoQuery = (currentUser: UserWithRolesPayload, filteredItemsQuery: string, filteredItemsQueryExcludingThisCriterion: string, crit: DiscreteCriterion): SearchResultsFacetQuery | null => {

        const filteredQuery = filteredItemsQueryExcludingThisCriterion;

        // a query that returns 1 row per option
        const foreignSchema = this.getForeignTableSchema();
        const foreignTable = foreignSchema.tableName;
        const foreignMembers = foreignSchema.SqlSpecialColumns;

        // we actually need to exclude this field from search
        return {
            sql: `with FIQ as (
                ${filteredQuery}
        )
        -- null option
        SELECT
            null id,
            null label,
            null color,
            null iconName,
            null tooltip,
            count(distinct(FIQ.id)) AS rowCount,
            -1 sortOrder
        FROM
            FIQ -- filtered events
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the statusId field
        where
            P.${this.fkidMember} is null

        union all

        SELECT
            FT.${foreignSchema.pkMember} id,
            ${foreignMembers.name ? `FT.${foreignMembers.name.member}` : "null"} label,
            ${foreignMembers.color ? `FT.${foreignMembers.color.member}` : "null"} color,
            ${foreignMembers.iconName ? `FT.${foreignMembers.iconName.member}` : "null"} iconName,
            ${foreignMembers.tooltip ? `FT.${foreignMembers.tooltip.member}` : "null"} tooltip,
            count(distinct(FIQ.id)) AS rowCount,
            FT.${foreignMembers.sortOrder?.member || foreignSchema.pkMember} sortOrder
        FROM
            FIQ -- filtered events
            inner join ${this.localTableSpec.tableName} as P on P.${this.localTableSpec.pkMember} = FIQ.id   -- join to events, to get access to the statusId field
            right join ${foreignTable} as FT on FT.${foreignSchema.pkMember} = P.${this.fkidMember}            -- like eventStatus
        where
            ${foreignSchema.SqlGetVisFilterExpression(currentUser, "FT")} -- account for delete, visibility
        GROUP BY 
            FT.${foreignSchema.pkMember}
        order by
            sortOrder asc
            `,
            transformResult: (row: { id: number, label: string | null, color: string | null, iconName: string | null, tooltip: string | null, rowCount: bigint }) => {
                const rowCount = new Number(row.rowCount).valueOf();
                return {
                    id: row.id,
                    rowCount,
                    label: row.label || row.id?.toString() || null,
                    color: row.color,
                    iconName: row.iconName,
                    tooltip: row.tooltip,
                    shape: undefined,
                };
            },
        };
    };
};

