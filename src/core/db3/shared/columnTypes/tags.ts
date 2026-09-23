
import { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion, DiscreteCriterionFilterType,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import type { DB3Authorization } from "../db3Authorization";
import {
    ApplyIncludeFilteringToRelation, type DB3AuthSpec, type DB3FieldPrismaMember,
    type DB3ReadPresenceForAuthSpec, type DB3RegisteredTableID,
    type DB3RelationTargetField, type DB3RowMode,
    FieldBase, GetTableById, type SqlGetSortableQueryElementsAPI,
    SuccessfulValidateAndParseResult, UndefinedValidateAndParseResult,
    type ValidateAndParseArgs, type ValidateAndParseResult,
    xTable
} from "../db3core";
import { type UserWithRolesPayload } from "../schema/userPayloads";


////////////////////////////////////////////////////////////////
// Tags fields are arrays of association rows. The selected Prisma relation
// targets the association xTable. Prisma's non-recursive model metadata checks
// both relation ends without eagerly expanding the xTable relation graph.
type TagsFieldArgs<
    TAssociation,
    TAssociationTableID extends DB3RegisteredTableID,
    TAssociationLocalObjectMember extends string,
    TAssociationForeignObjectMember extends string,
    TForeignTableID extends DB3RegisteredTableID,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> = Omit<
    TagsFieldValueArgs<
        TAssociation,
        TAssociationTableID,
        TAssociationLocalObjectMember,
        TAssociationForeignObjectMember,
        TForeignTableID
    >,
    "columnName" | "associationTableID" | "foreignTableID"
> & TAuthSpec & {
    columnName: string;
    associationTableID: TAssociationTableID;
    foreignTableID: TForeignTableID;
};

type TagsFieldValueArgs<
    TAssociation,
    TAssociationTableID extends DB3RegisteredTableID,
    TAssociationLocalObjectMember extends string,
    TAssociationForeignObjectMember extends string,
    TForeignTableID extends DB3RegisteredTableID,
> = {
    columnName: string; // "instrumentType"
    associationTableID: TAssociationTableID;
    foreignTableID: TForeignTableID;
    getQuickFilterWhereClause: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getCustomFilterWhereClause: (query: CMDBTableFilterModel) => TAnyModel | boolean;
    doesItemExactlyMatchText?: (item: TAssociation, filterText: string) => boolean;

    // when we get a list of tag options, they're foreign models (tags).
    // but we need our list to be association objects (itemTagAssocitaion)
    createMockAssociation?: (row: TAnyModel, item: TAnyModel) => TAssociation;

    // mutations needs to where:{} to find associations for local rows. so "getForeignID()" is not going to work.
    // better to 
    associationLocalObjectMember: TAssociationLocalObjectMember;
    associationForeignObjectMember: TAssociationForeignObjectMember;
};

type DB3RegisteredPrismaTableID = Extract<DB3RegisteredTableID, Prisma.ModelName>;

type DB3PrismaModelPayload<TTableID extends Prisma.ModelName> =
    Prisma.TypeMap["model"][TTableID]["payload"];

type DB3PrismaRelationKeys<TTableID extends Prisma.ModelName> = Extract<
    keyof DB3PrismaModelPayload<TTableID>["objects"],
    string
>;

type DB3PrismaScalarKeys<TTableID extends Prisma.ModelName> = Extract<
    keyof DB3PrismaModelPayload<TTableID>["scalars"],
    string
>;

type DB3SupportedTagsRelationKeys<TTableID extends Prisma.ModelName> = Extract<{
    [TMember in DB3PrismaRelationKeys<TTableID>]:
    `${TMember}Id` extends DB3PrismaScalarKeys<TTableID>
    ? TMember
    : never;
}[DB3PrismaRelationKeys<TTableID>], string>;

type DB3PrismaRelationTargetID<
    TTableID extends Prisma.ModelName,
    TRelationMember extends DB3PrismaRelationKeys<TTableID>,
> = Extract<
    DB3PrismaModelPayload<TTableID>["objects"][TRelationMember] extends { name: infer TName }
    ? TName
    : never,
    Prisma.ModelName
>;

type DB3PrismaRelationScalarPayload<
    TTableID extends Prisma.ModelName,
    TRelationMember extends DB3PrismaRelationKeys<TTableID>,
> = DB3PrismaModelPayload<TTableID>["objects"][TRelationMember] extends {
    scalars: infer TScalars;
} ? TScalars : never;

type DB3TagsAssociationValue<
    TAssociationTableID extends Prisma.ModelName,
    TForeignObjectMember extends DB3PrismaRelationKeys<TAssociationTableID>,
> = DB3PrismaModelPayload<TAssociationTableID>["scalars"] & {
    [TMember in TForeignObjectMember]: DB3PrismaRelationScalarPayload<
        TAssociationTableID,
        TForeignObjectMember
    >;
};

export type TagsRefArgs<
    TAssociationTableID extends DB3RegisteredPrismaTableID,
    TForeignObjectMember extends DB3SupportedTagsRelationKeys<TAssociationTableID>,
    TLocalObjectMember extends DB3SupportedTagsRelationKeys<TAssociationTableID>,
    TForeignTableID extends Extract<
        DB3PrismaRelationTargetID<TAssociationTableID, TForeignObjectMember>,
        DB3RegisteredTableID
    >,
    TAuthSpec extends DB3AuthSpec,
> = Omit<
    TagsFieldValueArgs<
        DB3TagsAssociationValue<
            TAssociationTableID,
            TForeignObjectMember
        >,
        TAssociationTableID,
        TLocalObjectMember,
        TForeignObjectMember,
        TForeignTableID
    >,
    "columnName" | "associationTableID" | "foreignTableID"
> & TAuthSpec;

// Tags encode an association collection rather than a same-key scalar value;
// their exact write shape belongs to their explicit mutation projection.
class TagsFieldImpl<
    TAssociation,
    TAssociationTableID extends DB3RegisteredTableID = DB3RegisteredTableID,
    TAssociationLocalObjectMember extends string = string,
    TAssociationForeignObjectMember extends string = string,
    TForeignTableID extends DB3RegisteredTableID = DB3RegisteredTableID,
    const TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> extends FieldBase<
    TAssociation[],
    undefined,
    false,
    TAssociation[],
    TAssociation[],
    DB3ReadPresenceForAuthSpec<TAuthSpec>
>
    implements DB3RelationTargetField<TAssociationTableID> {
    declare readonly __relationTargetTable: TAssociationTableID;
    localTableSpec: xTable;
    readonly associationTableID: TAssociationTableID;
    readonly foreignTableID: TForeignTableID;
    getQuickFilterWhereClause__: (query: string) => TAnyModel | boolean; // basically this prevents the need to subclass and implement.
    getCustomFilterWhereClause__: (query: CMDBTableFilterModel) => TAnyModel | boolean;

    createMockAssociation: (row: TAnyModel, foreignObject: TAnyModel) => TAssociation;
    //doesItemExactlyMatchText: (item: TAssociation, filterText: string) => boolean;
    // getChipCaption?: (value: TAssociation) => string; // chips can be automatically rendered if you set this (and omit renderAsChip / et al)
    // getChipColor?: (value: TAssociation) => ColorPaletteEntry;
    // getChipDescription?: (value: TAssociation) => string;

    readonly associationLocalObjectMember: TAssociationLocalObjectMember;
    readonly associationForeignObjectMember: TAssociationForeignObjectMember;

    get associationLocalIDMember(): `${TAssociationLocalObjectMember}Id` {
        return `${this.associationLocalObjectMember}Id`;
    }

    get associationForeignIDMember(): `${TAssociationForeignObjectMember}Id` {
        return `${this.associationForeignObjectMember}Id`;
    }

    getAssociationTableShema = () => {
        return GetTableById(this.associationTableID);
    };
    getForeignTableShema = () => {
        return GetTableById(this.foreignTableID);
    };

    getPrismaMemberDescriptors = (): readonly DB3FieldPrismaMember[] => [{
        member: this.member,
        kind: "relationCollection",
        getTargetTable: () => GetTableById(this.associationTableID),
    }];

    get allowInsertFromString() {
        return !!this.getForeignTableShema().createInsertModelFromString;
    }

    constructor(args: TagsFieldArgs<
        TAssociation,
        TAssociationTableID,
        TAssociationLocalObjectMember,
        TAssociationForeignObjectMember,
        TForeignTableID,
        TAuthSpec
    >) {
        super({
            member: args.columnName,
            fieldTableAssociation: "associationRecord",
            defaultValue: [],
            specialFunction: undefined,
            authMap: (args as any).authMap || null,
            _customAuth: (args as any)._customAuth || null,
        });

        // // does default behavior of case-insensitive, trimmed compare.
        // const itemExactlyMatches_defaultImpl = (value: TAssociation, filterText: string): boolean => {
        //     // console.assert(!!this.getChipCaption); // this relies on caller specifying a chip caption.
        //     // if (!this.getChipCaption) {
        //     //     throw new Error(`If you don't provide an implementation of 'doesItemExactlyMatchText', then you must provide an implementation of 'getChipCaption'. On TagsField ${args.columnName}`);
        //     // }
        //     // return this.getChipCaption!(value).trim().toLowerCase() === filterText.trim().toLowerCase();
        //     const rowInfo = this.getAssociationTableShema().getRowInfo(value as TAnyModel);
        //     return rowInfo.name.trim().toLowerCase() === filterText.trim().toLowerCase();
        // }

        this.associationTableID = args.associationTableID;
        this.foreignTableID = args.foreignTableID;
        this.getQuickFilterWhereClause__ = args.getQuickFilterWhereClause;
        this.getCustomFilterWhereClause__ = args.getCustomFilterWhereClause;
        this.createMockAssociation = args.createMockAssociation || this.createMockAssociation_DefaultImpl;
        this.associationLocalObjectMember = args.associationLocalObjectMember;
        this.associationForeignObjectMember = args.associationForeignObjectMember;
        //this.doesItemExactlyMatchText = args.doesItemExactlyMatchText || itemExactlyMatches_defaultImpl;
    }

    connectToTable = (table: xTable) => {
        this.localTableSpec = table;
    };

    createMockAssociation_DefaultImpl = (row: TAnyModel, foreignObject: TAnyModel): TAssociation => {
        const ret = {
            [this.getAssociationTableShema().pkMember]: -1, // an ID that we can assume is never valid or going to match an existing. we could also put null which may be more accurate but less safe in terms of query compatibiliy.
            [this.associationLocalObjectMember]: row, // local object
            [this.associationLocalIDMember]: row[this.localTableSpec.pkMember], // local ID
            [this.associationForeignObjectMember]: foreignObject, // local object
            [this.associationForeignIDMember]: foreignObject[this.getForeignTableShema().pkMember], // foreign ID
        } as TAssociation /* trust me */;
        return ret;
    };

    isEqual = (a: TAssociation[], b: TAssociation[]) => {
        console.assert(Array.isArray(a));
        console.assert(Array.isArray(b));
        if (a.length != b.length) {
            return false; // shortcut
        }
        // ok they are equal length arrays; check all items
        const asst = this.getAssociationTableShema();
        const avalues = a.map(x => x[asst.pkMember]);
        const bvalues = b.map(x => x[asst.pkMember]);
        avalues.sort();
        bvalues.sort();
        for (let i = 0; i < avalues.length; ++i) {
            if (avalues[i] !== bvalues[i]) return false;
        }
        return true;
    };

    getQuickFilterWhereClause = (query: string): TAnyModel | boolean => this.getQuickFilterWhereClause__(query);
    getCustomFilterWhereClause = (query: CMDBTableFilterModel) => this.getCustomFilterWhereClause__(query);
    getOverallWhereClause = (): TAnyModel | boolean => false;

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3Authorization, includeDeleted: boolean) => {
        await ApplyIncludeFilteringToRelation(include, this.member, this.associationForeignObjectMember, this.foreignTableID, publicData, includeDeleted);
    };

    ApplyDbToClient = (dbModel: TAnyModel, clientModel: TAnyModel, mode: DB3RowMode) => {
        if (dbModel[this.member] === undefined) return;
        // the "includes" clause already returns the correct structure for clients.
        clientModel[this.member] = dbModel[this.member];
    }

    ApplyToNewRow = (args: TAnyModel) => {
        args[this.member] = this.defaultValue;
    };

    ApplyClientToDb = (clientModel: TAnyModel, mutationModel: TAnyModel, mode: DB3RowMode) => {
        // clients work with associations, even mock associations (where id is empty).
        // mutations don't require any of this info; associations are always with existing local & foreign items.
        // so basically we just need to reduce associations down to an update/mutate model.
        if (clientModel[this.member] === undefined) return;

        // there's a possibility the client model is the one coming from the serialized format. yea terrible. but support this case
        // until we have proper clean serialized formats.
        mutationModel[this.member] = clientModel[this.member].map(a => {
            if (typeof a === 'number') return a;
            return a[this.associationForeignIDMember];
        });
    };

    // the edit grid needs to be able to call this in order to validate the whole form and optionally block saving
    ValidateAndParse = (args: ValidateAndParseArgs<TAssociation[]>): ValidateAndParseResult<TAssociation[] | null> => {
        // there's really nothing else to validate here. in theory you can make sure the IDs are valid but it should never be possible plus enforced by the db relationship.
        // therefore not worth the overhead / roundtrip / complexity.
        let value = args.row[this.member];
        let objValue = { [this.member]: value };
        if (value === undefined) return UndefinedValidateAndParseResult();
        return SuccessfulValidateAndParseResult(objValue);
    };


    SqlGetSortableQueryElements = (api: SqlGetSortableQueryElementsAPI): SortQueryElements | null => null;
    SqlGetQuickFilterElementsForToken = (token: string, quickFilterTokens: string[]): string | null => null;

    SqlGetDiscreteCriterionElements = (crit: DiscreteCriterion, tableAlias: string): CriterionQueryElements | null => {
        assertIsNumberArray(crit.options);
        // select 1 from eventTagAssociations mt where mt.eventId = 
        const associationSchema = this.getAssociationTableShema();
        const associationTable = associationSchema.tableName;
        const assLocalId = this.associationLocalIDMember;
        const assTagId = this.associationForeignIDMember;
        const errorResult: CriterionQueryElements = {
            whereAnd: `(true)`,
            error: "Select options to filter on",
        };
        const hasAny: CriterionQueryElements = {
            error: undefined,
            whereAnd: `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id)`,
        };
        const hasNone: CriterionQueryElements = {
            error: undefined,
            whereAnd: `NOT EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id)`,
        };
        const map: { [key in DiscreteCriterionFilterType]: () => CriterionQueryElements | null } = {
            alwaysMatch: () => {
                return {
                    error: undefined,
                    whereAnd: `(true)`,
                }
            },
            hasAny: () => {
                return hasAny;
            },
            hasNone: () => {
                return hasNone;
            },
            hasSomeOf: () => {
                // this is a bit meaningless but let's allow it. if you are demanding "some of" but don't specify anything,
                // treat as if "is null". this has simple continuity for gui.
                if (crit.options.length === 0) return errorResult;
                return {
                    error: undefined,
                    whereAnd: `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} IN (${crit.options.join(",")}))`,
                };
            },
            hasAllOf: () => {
                if (crit.options.length === 0) return errorResult;
                const subQueries = crit.options.map(option =>
                    `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} = ${option})`
                );
                return {
                    error: undefined,
                    whereAnd: `(${subQueries.join(" AND ")})`,
                };
            },
            doesntHaveAnyOf: () => {
                if (crit.options.length === 0) return errorResult;
                return {
                    error: undefined,
                    whereAnd: `NOT EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} IN (${crit.options.join(",")}))`,
                };
            },
            doesntHaveAllOf: () => {
                if (crit.options.length === 0) return errorResult;
                const subQueries = crit.options.map(option =>
                    `EXISTS (SELECT 1 FROM ${associationTable} mt WHERE mt.${assLocalId} = ${tableAlias}.id AND mt.${assTagId} = ${option})`
                );
                return {
                    error: undefined,
                    whereAnd: `NOT (${subQueries.join(" AND ")})`,
                };
            },
        };
        return map[crit.behavior]();
    }

    SqlGetFacetInfoQuery = (
        currentUser: UserWithRolesPayload,
        filteredItemsQuery: string,
        filteredItemsQueryExcludingThisCriterion: string,
        crit: DiscreteCriterion
    ): SearchResultsFacetQuery | null => {
        //return null;
        const foreignSchema = this.getForeignTableShema();
        const foreignTable = foreignSchema.tableName;
        const foreignMembers = foreignSchema.SqlSpecialColumns;
        const filteredQuery = filteredItemsQueryExcludingThisCriterion;
        return {
            sql: `
            with FIQ as (${filteredQuery})

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
                left join ${this.getAssociationTableShema().tableName} ASS on ASS.${this.associationLocalIDMember} = FIQ.id
            where
                ASS.${this.associationForeignIDMember} is null
    
            union all
    
            select
                FT.${foreignSchema.pkMember} AS id,
                ${foreignMembers.name ? `FT.${foreignMembers.name.member}` : "null"} AS label,
                ${foreignMembers.color ? `FT.${foreignMembers.color.member}` : "null"} AS color,
                ${foreignMembers.iconName ? `FT.${foreignMembers.iconName.member}` : "null"} AS iconName,
                ${foreignMembers.tooltip ? `FT.${foreignMembers.tooltip.member}` : "null"} AS tooltip,
                count(distinct(FIQ.id)) AS rowCount,
                FT.${foreignMembers.sortOrder?.member || foreignSchema.pkMember} AS sortOrder
            from
                FIQ
                inner join ${this.getAssociationTableShema().tableName} ASS on ASS.${this.associationLocalIDMember} = FIQ.id
                right join ${foreignTable} FT on FT.${foreignSchema.pkMember} = ASS.${this.associationForeignIDMember}
            group by
                FT.${foreignSchema.pkMember}

            order by
                sortOrder asc
                `,

            // converts the query result to a styled chip
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
        }
    } // SqlGetFacetInfoQuery

}; // TagsFieldImpl

/** Public type used by generic DB3 consumers; values are created by tagsRef(). */
export type TagsField<
    TAssociation,
    TAssociationTableID extends DB3RegisteredTableID = DB3RegisteredTableID,
    TAssociationLocalObjectMember extends string = string,
    TAssociationForeignObjectMember extends string = string,
    TForeignTableID extends DB3RegisteredTableID = DB3RegisteredTableID,
    TAuthSpec extends DB3AuthSpec = DB3AuthSpec,
> = TagsFieldImpl<
    TAssociation,
    TAssociationTableID,
    TAssociationLocalObjectMember,
    TAssociationForeignObjectMember,
    TForeignTableID,
    TAuthSpec
>;

/**
 * Declares a tags/association relation between registered DB3 tables. Prisma
 * metadata verifies both relation members, their conventional `${member}Id`
 * scalar keys, and the exact foreign model. Relationships that do not follow
 * that currently supported shape fail here and need an explicit new contract.
 */
export const tagsRef = <
    const TAssociationTableID extends DB3RegisteredPrismaTableID,
    const TForeignObjectMember extends DB3SupportedTagsRelationKeys<TAssociationTableID>,
    const TLocalObjectMember extends DB3SupportedTagsRelationKeys<TAssociationTableID>,
    const TForeignTableID extends Extract<
        DB3PrismaRelationTargetID<TAssociationTableID, TForeignObjectMember>,
        DB3RegisteredTableID
    >,
    const TAuthSpec extends DB3AuthSpec,
>(
    associationTableID: TAssociationTableID,
    foreignTableID: TForeignTableID,
    args: TagsRefArgs<
        TAssociationTableID,
        TForeignObjectMember,
        TLocalObjectMember,
        TForeignTableID,
        TAuthSpec
    >,
) => (columnName: string) => new TagsFieldImpl<
    DB3TagsAssociationValue<
        TAssociationTableID,
        TForeignObjectMember
    >,
    TAssociationTableID,
    TLocalObjectMember,
    TForeignObjectMember,
    TForeignTableID,
    TAuthSpec
>({
    ...args,
    columnName,
    associationTableID,
    foreignTableID,
});
