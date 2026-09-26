
import { TAnyModel } from "@/shared/rootroot";
import type { Prisma } from "db";
import { assertIsNumberArray } from "shared/arrayUtils";
import {
    type CMDBTableFilterModel, type CriterionQueryElements, type DiscreteCriterion, DiscreteCriterionFilterType,
    type SearchResultsFacetQuery, type SortQueryElements
} from "../apiTypes";
import type { DB3ServerAuthorization } from "src/core/db3/server/db3ServerAuthorization";
import {
    ApplyIncludeFilteringToRelation, type DB3AuthSpec, type DB3FieldPrismaMember,
    type DB3IdentityOf, type DB3MutationProjectionField,
    type DB3ReadPresenceForAuthSpec, type DB3RegisteredTableID,
    type DB3RelationTargetField, type DB3ResolvedRelationTarget, type DB3RowMode,
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

type DB3TagsForeignIdentity<TTableID extends DB3RegisteredTableID> =
    DB3IdentityOf<DB3ResolvedRelationTarget<TTableID>>;

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

// Tags encode an association collection rather than a same-key scalar value.
// Client preparation projects the association objects to target identities.
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
    true,
    TAssociation[],
    TAssociation[],
    DB3ReadPresenceForAuthSpec<TAuthSpec>
>
    implements DB3RelationTargetField<TAssociationTableID>,
    DB3MutationProjectionField<
        readonly unknown[],
        DB3TagsForeignIdentity<TForeignTableID>[]
    > {
    declare readonly __relationTargetTable: TAssociationTableID;
    declare readonly __mutationClientValue: readonly unknown[];
    declare readonly __mutationWriteTransportValue: DB3TagsForeignIdentity<TForeignTableID>[];
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

    /** Read this relation's association array from a row. */
    getAssociations = <TClientAssociation = TAssociation,>(row: TAnyModel): TClientAssociation[] => {
        const associations = row[this.member];
        if (associations === undefined) return [];
        if (!Array.isArray(associations)) {
            throw new Error(`Expected ${this.localTableSpec.tableID}.${this.member} to be an association array.`);
        }
        // The field's declared client value is TAssociation[]; the dynamic row
        // lookup is the only reason TypeScript cannot retain that element type.
        return associations as TClientAssociation[];
    };

    /** Extract and validate the foreign entity carried by an association row. */
    getForeignObject = <TForeignObject,>(
        association: TAnyModel,
    ): TForeignObject => {
        const foreignObject = association[this.associationForeignObjectMember];
        if (!foreignObject) {
            throw new Error(
                `Expected ${this.associationTableID}.${this.associationForeignObjectMember} to contain its foreign entity.`,
            );
        }
        this.getRuntimeForeignIdentity(foreignObject);
        // Relation metadata identifies the member and validates its canonical
        // identity; callers retain the richer hydrated object type they passed.
        return foreignObject as TForeignObject;
    };

    private getRuntimeForeignIdentity = (foreignObject: unknown) => {
        const foreignTable = this.getForeignTableShema();
        const getIdentity = foreignTable.getIdentity;
        if (!getIdentity) {
            throw new Error(`DB3 table ${foreignTable.tableID} does not declare an identity accessor.`);
        }
        // Legacy xTable accessors accept model-shaped values; the relation has
        // already selected the registered target object dynamically.
        return getIdentity(foreignObject as TAnyModel);
    };

    /** Extract the canonical foreign identity from an association or transport value. */
    getForeignIdentity = (
        association: unknown,
    ): DB3TagsForeignIdentity<TForeignTableID> => {
        const foreignTable = this.getForeignTableShema();
        if (foreignTable.isIdentity(association)) {
            // The registered foreign table determines this field's exact
            // identity type; the runtime registry exposes its base xTable.
            return association as DB3TagsForeignIdentity<TForeignTableID>;
        }

        if (!association || typeof association !== "object") {
            throw new Error(`Expected an identity or association value for ${this.localTableSpec.tableID}.${this.member}.`);
        }

        // The runtime object boundary is safe after the shape check; configured
        // relation member names select the candidate identity and entity.
        const associationModel = association as TAnyModel;
        const directIdentity = associationModel[this.associationForeignIDMember];
        if (foreignTable.isIdentity(directIdentity)) {
            // The runtime guard applies the registered foreign table's exact
            // identity contract, which the base xTable type cannot retain.
            return directIdentity as DB3TagsForeignIdentity<TForeignTableID>;
        }

        const foreignObject = associationModel[this.associationForeignObjectMember];
        const identity = this.getRuntimeForeignIdentity(foreignObject);
        // Runtime extraction and validation came from the registered target;
        // DB3TableTypeRegistry supplies the corresponding compile-time type.
        return identity as DB3TagsForeignIdentity<TForeignTableID>;
    };

    /**
     * Extract the resolved natural foreign key used by persistence code. This
     * is deliberately separate from getForeignIdentity(): converted client
     * identities remain public IDs, while the trusted command boundary resolves
     * them before mutation preparation reaches this method.
     */
    getForeignDatabaseIdentity = (association: unknown): number => {
        const foreignTable = this.getForeignTableShema();
        if (foreignTable.isDatabaseIdentity(association)) return association;
        if (!association || typeof association !== "object") {
            throw new Error(`Expected a resolved association value for ${this.localTableSpec.tableID}.${this.member}.`);
        }

        // Configured relation member names are runtime metadata, so inspect the
        // already-validated object through the dynamic DB3 model boundary.
        const associationModel = association as TAnyModel;
        const directIdentity = associationModel[this.associationForeignIDMember];
        if (foreignTable.isDatabaseIdentity(directIdentity)) return directIdentity;

        const foreignObject = associationModel[this.associationForeignObjectMember];
        return foreignTable.parseDatabaseIdentity(foreignObject?.[foreignTable.pkMember]);
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
        const localIdentityMember = this.localTableSpec.clientIdMember;
        const associationTable = this.getAssociationTableShema();
        // Converted association identities are server-generated; client drafts
        // are compared by their foreign target and must not invent one.
        const mockAssociationIdentity = associationTable.publicIdMember
            ? {}
            : { [associationTable.pkMember]: -1 };
        const ret = {
            ...mockAssociationIdentity,
            [this.associationLocalObjectMember]: row, // local object
            [this.associationLocalIDMember]: this.localTableSpec.parseIdentity(row[localIdentityMember]),
            [this.associationForeignObjectMember]: foreignObject, // local object
            [this.associationForeignIDMember]: this.getRuntimeForeignIdentity(foreignObject),
        } as TAssociation /* trust me */;
        return ret;
    };

    /**
     * Return an editor row whose association collection targets exactly the
     * supplied foreign objects. Association draft shape and identity rules stay
     * owned by the relation rather than leaking into feature components.
     */
    withForeignObjects = <TRow extends TAnyModel,>(
        row: TRow,
        foreignObjects: readonly TAnyModel[],
    ): TRow => ({
        ...row,
        [this.member]: foreignObjects.map(foreignObject => (
            this.createMockAssociation(row, foreignObject)
        )),
    });

    isEqual = (a: TAssociation[], b: TAssociation[]) => {
        console.assert(Array.isArray(a));
        console.assert(Array.isArray(b));
        if (a.length != b.length) {
            return false; // shortcut
        }
        // ok they are equal length arrays; check all items
        // tagsRef's Prisma metadata guarantees this conventional foreign-ID
        // member exists even though TAssociation remains reusable and generic.
        const foreignIdentityOf = (association: TAssociation) => (
            association as TAnyModel
        )[this.associationForeignIDMember];
        const avalues = a.map(foreignIdentityOf);
        const bvalues = b.map(foreignIdentityOf);
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

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3ServerAuthorization, includeDeleted: boolean) => {
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

        // Serialized transport values and rich association rows share one
        // persistence-side extraction path after public IDs have been resolved.
        mutationModel[this.member] = this.getAssociations(clientModel)
            .map(association => this.getForeignDatabaseIdentity(association));
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
    getDiscreteCriterionTargetTable = (): xTable => this.getForeignTableShema();

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
                FT.${foreignSchema.clientIdMember} AS id,
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
            transformResult: (row: {
                id: number | string,
                label: string | null,
                color: string | null,
                iconName: string | null,
                tooltip: string | null,
                rowCount: bigint
            }) => {
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
