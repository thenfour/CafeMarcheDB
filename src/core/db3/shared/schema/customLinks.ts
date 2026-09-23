
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { BoolField, ConstEnumStringField, GhostField, MakeCreatedAtField, MakePKfield } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { MakeCreatedByField } from "./user";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";

const xAuthMap: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_custom_links,
    PostQuery: Permission.view_custom_links,
    PreMutateAsOwner: Permission.manage_custom_links,
    PreMutate: Permission.manage_custom_links,
    PreInsert: Permission.manage_custom_links,
} as const;

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_custom_links,
    View: Permission.view_custom_links,
    EditOwn: Permission.manage_custom_links,
    Edit: Permission.manage_custom_links,
    Insert: Permission.manage_custom_links,
} as const;


const CustomLinkArgs = Prisma.validator<Prisma.CustomLinkDefaultArgs>()({
    include: {
        _count: {
            select: {
                visits: true,
            }
        },
        createdByUser: AuxUserArgs,
    }
});

export type CustomLinkPayload = Prisma.CustomLinkGetPayload<typeof CustomLinkArgs>;

export const CustomLinkNaturalOrderBy: Prisma.CustomLinkOrderByWithRelationInput[] = [
    { createdAt: 'desc' },
];

export const CustomLinkRedirectType = {
    Permanent: "Permanent", // 301
    Temporary: "Temporary", // 302
    Client: "Client", // allows preserving hash
    Disabled: "Disabled",
    IntermediatePage: "IntermediatePage",
} as const satisfies Record<string, string>;



////////////////////////////////////////////////////////////////
export const xCustomLink = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.CustomLinkDelegate>(),
    getIdentity: (link: { id: number }) => link.id,
    getSelectionArgs: (): Prisma.CustomLinkDefaultArgs => {
        return CustomLinkArgs;
    },
    tableName: "CustomLink",
    deletePolicy: "hard",
    naturalOrderBy: CustomLinkNaturalOrderBy,
    getRowInfo: (row: CustomLinkPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        color: null,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        name: columnName => MakeTitleField(columnName, { authMap: xAuthMap, }),
        description: () => MakeDescriptionField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField(),
        createdByUser: () => MakeCreatedByField(),
        slug: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "customLinkSlug",
            authMap: xAuthMap,
        }),
        destinationURL: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "uri",
            authMap: xAuthMap,
        }),
        redirectType: columnName => new ConstEnumStringField({
            columnName,
            allowNull: true,
            defaultValue: CustomLinkRedirectType.Temporary,
            options: CustomLinkRedirectType,
            authMap: xAuthMap,
        }),
        intermediateMessage: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "markdown",
            authMap: xAuthMap,
        }),
        forwardQuery: columnName => new BoolField({
            columnName,
            defaultValue: true,
            allowNull: false,
            authMap: xAuthMap,
        }),
        _count: memberName => new GhostField({
            authMap: xAuthMap,
            memberName,
        }),
    })
});


