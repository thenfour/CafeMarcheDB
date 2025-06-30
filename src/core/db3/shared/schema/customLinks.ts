
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { AuxUserArgs } from "types";
import { BoolField, ConstEnumStringField, GhostField, MakeCreatedAtField, MakePKfield } from "../db3basicFields";
import * as db3 from "../db3core";
import { MakeCreatedByField } from "./user";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../genericStringField";

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
export const xCustomLink = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.CustomLinkInclude => {
        return CustomLinkArgs.include;
    },
    tableName: "CustomLink",
    naturalOrderBy: CustomLinkNaturalOrderBy,
    getRowInfo: (row: CustomLinkPayload) => ({
        pk: row.id,
        name: row.name,
        description: row.description,
        color: null,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    columns: [
        MakePKfield(),
        MakeTitleField("name", { authMap: xAuthMap, }),
        MakeDescriptionField({ authMap: xAuthMap, }),
        MakeCreatedAtField(),
        MakeCreatedByField(),
        new GenericStringField({
            columnName: "slug",
            allowNull: false,
            format: "customLinkSlug",
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "destinationURL",
            allowNull: false,
            format: "uri",
            authMap: xAuthMap,
        }),
        new ConstEnumStringField({
            columnName: "redirectType",
            allowNull: true,
            defaultValue: CustomLinkRedirectType.Temporary,
            options: CustomLinkRedirectType,
            authMap: xAuthMap,
        }),
        new GenericStringField({
            columnName: "intermediateMessage",
            allowNull: true,
            format: "markdown",
            authMap: xAuthMap,
        }),
        new BoolField({
            columnName: "forwardQuery",
            defaultValue: true,
            allowNull: false,
            authMap: xAuthMap,
        }),
        new GhostField({
            authMap: xAuthMap,
            memberName: "_count",
        }),
    ]
});


