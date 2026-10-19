import { BandPermission } from "src/auth/shared/bandPermissionPolicy";

import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { CustomLinkPublicId } from "shared/publicId";
import { AuxUserArgs } from "types";
import { z } from "zod";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { serverOwnedField } from "../columnTypes/inherited";
import { BoolField, ConstEnumStringField, foreignRef, GenericIntegerField, GhostField, MakeCreatedAtField, MakePKfield, MakePublicIdField } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { kReadOnlyAuthMap } from "../entities/common/entityCommon";
import { xCustomLinkFile } from "../entities/customLink/customLinkFile";
import { MakeCreatedByField } from "./user";

const xAuthMap = db3.defineAuthMap({
    PostQueryAsOwner: BandPermission.view_custom_links,
    PostQuery: BandPermission.view_custom_links,
    PreMutateAsOwner: BandPermission.manage_custom_links,
    PreMutate: BandPermission.manage_custom_links,
    PreInsert: BandPermission.manage_custom_links,
});

const xTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: BandPermission.view_custom_links,
    View: BandPermission.view_custom_links,
    EditOwn: BandPermission.manage_custom_links,
    Edit: BandPermission.manage_custom_links,
    Insert: BandPermission.manage_custom_links,
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
    ServeFile: "ServeFile",
} as const satisfies Record<string, string>;



////////////////////////////////////////////////////////////////
export const xCustomLink = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.CustomLinkDelegate>(),
    getIdentity: (link: { publicId: CustomLinkPublicId }) => link.publicId,
    getSelectionArgs: (): Prisma.CustomLinkDefaultArgs => {
        return CustomLinkArgs;
    },
    tableName: "CustomLink",
    bandScope: {
        member: "bandId",
        managePermission: BandPermission.manage_custom_links
    },
    readConsistency: "snapshot",
    deletePolicy: "hard",
    naturalOrderBy: CustomLinkNaturalOrderBy,
    getRowInfo: (row: CustomLinkPayload) => ({
        pk: row.publicId,
        name: row.name,
        description: row.description,
        color: null,
        ownerUserId: row.createdByUserId,
    }),
    tableAuthMap: xTableAuthMap,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<CustomLinkPublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant, PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant,
            }),
        })),
        name: columnName => MakeTitleField(columnName, { authMap: xAuthMap, maxLength: 768 }),
        description: () => MakeDescriptionField({ authMap: xAuthMap, }),
        createdAt: () => MakeCreatedAtField({ authMap: kReadOnlyAuthMap }),
        createdByUser: () => MakeCreatedByField(),
        slug: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "customLinkSlug",
            maxLength: 767,
            authMap: xAuthMap,
        }),
        destinationURL: columnName => {
            const field = new GenericStringField({
                columnName,
                allowNull: true,
                format: "uri",
                maxLength: 768,
                authMap: xAuthMap,
            });
            const parse = field.ValidateAndParse;
            // redirectType-dependent validation
            field.ValidateAndParse = args => args.row.redirectType === CustomLinkRedirectType.ServeFile
                ? db3.SuccessfulValidateAndParseResult({ [columnName]: null })
                : parse(args);
            return field;
        },
        file: foreignRef(() => xCustomLinkFile, {
            fkidMember: "fileId",
            allowNull: true,
            requireVisibleTarget: true,
            authMap: xAuthMap,
        }),
        redirectType: columnName => new ConstEnumStringField({
            columnName,
            allowNull: false,
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
            authMap: kReadOnlyAuthMap,
            memberName,
            readTransportSchema: z.object({
                visits: z.number().int().nonnegative(),
            }),
        }),
    })
});


