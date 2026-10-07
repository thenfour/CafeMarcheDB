import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { FilePublicId } from "shared/publicId";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../../columnTypes/genericString";
import { GenericIntegerField, MakeIsDeletedField, MakePKfield, MakePublicIdField } from "../../columnTypes/xTableColumnTypes";
import { serverOwnedField } from "../../columnTypes/inherited";
import * as db3 from "../../db3core";
import { CreatedByUserField, MakeVisiblePermissionField } from "../../schema/user";
import { kReadOnlyAuthMap } from "../common/entityCommon";

const customLinkFileArgs = Prisma.validator<Prisma.FileDefaultArgs>()({
    select: {
        id: true, publicId: true, bandId: true, fileLeafName: true, storedLeafName: true,
        description: true, isDeleted: true, externalURI: true,
        uploadedByUserId: true, visiblePermissionId: true,
    },
});

type CustomLinkFile = Prisma.FileGetPayload<typeof customLinkFileArgs>;

// Custom links need a local-file reader, independent of the unfinished File editor and its tag relations.
export const xCustomLinkFile = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileDelegate>(),
    getIdentity: (file: { publicId: FilePublicId }) => file.publicId,
    tableName: "File",
    tableUniqueName: "CustomLinkFile",
    deletePolicy: "disabled",
    bandScope: { member: "bandId", managePermission: Permission.manage_files },
    readConsistency: "snapshot",
    queryParameters: {},
    getParameterizedWhereClause: (): Prisma.FileWhereInput[] => [{ externalURI: null }],
    getSelectionArgs: () => customLinkFileArgs,
    naturalOrderBy: [{ fileLeafName: "asc" }],
    tableAuthMap: {
        View: Permission.view_files, ViewOwn: Permission.view_files,
        Insert: Permission.never_grant, Edit: Permission.never_grant, EditOwn: Permission.never_grant,
    },
    getRowInfo: (file: CustomLinkFile) => ({
        pk: file.publicId, name: file.fileLeafName, description: file.description,
        ownerUserId: file.uploadedByUserId,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "never" }),
        publicId: () => MakePublicIdField<FilePublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName, allowNull: false, allowSearchingThisField: false,
            authMap: db3.defineAuthMap({
                PostQuery: Permission.never_grant, PostQueryAsOwner: Permission.never_grant,
                PreInsert: Permission.never_grant, PreMutate: Permission.never_grant, PreMutateAsOwner: Permission.never_grant,
            }),
        })),
        fileLeafName: columnName => MakeTitleField(columnName, { authMap: kReadOnlyAuthMap }),
        storedLeafName: columnName => new GenericStringField({ columnName, allowNull: false, format: "raw", authMap: kReadOnlyAuthMap }),
        description: () => MakeDescriptionField({ authMap: kReadOnlyAuthMap }),
        externalURI: columnName => new GenericStringField({ columnName, allowNull: true, format: "uri", authMap: kReadOnlyAuthMap }),
        isDeleted: () => MakeIsDeletedField({ authMap: kReadOnlyAuthMap }),
        uploadedByUser: columnName => new CreatedByUserField<"uploadedByUserId">({
            columnName, fkidMember: "uploadedByUserId", authMap: kReadOnlyAuthMap,
        }),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: kReadOnlyAuthMap }),
    }),
});
