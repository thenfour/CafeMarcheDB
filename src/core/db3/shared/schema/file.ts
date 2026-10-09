import { xBandFileTag } from "../entities/file/fileTagCatalogs";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import type { FileEventTagPublicId, FileInstrumentTagPublicId, FilePublicId, FileSongTagPublicId, FileTagAssignmentPublicId, FileTagPublicId, FileUserTagPublicId, FileWikiPageTagPublicId, FrontpageGalleryItemPublicId } from "shared/publicId";
import { TAnyModel } from "shared/rootroot";
import { CMDBTableFilterModel } from "../apiTypes";
import { DateTimeField, foreignRef, ForeignCollectionField, foreignRefByTableId, GenericIntegerField, MakeCreatedAtField, MakeIsDeletedField, MakePKfield, MakePublicIdField, MakeSortOrderField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { serverOwnedField } from "../columnTypes/inherited";
import { FileArgs, FileEventTagArgs, FileEventTagNaturalOrderBy, FileEventTagPayload, FileInstrumentTagArgs, FileInstrumentTagNaturalOrderBy, FileInstrumentTagPayload, FileNaturalOrderBy, FilePayload, FileSongTagArgs, FileSongTagNaturalOrderBy, FileSongTagPayload, BandFileTagAssignmentArgs, BandFileTagAssignmentNaturalOrderBy, BandFileTagAssignmentPayload, FileUserTagArgs, FileUserTagNaturalOrderBy, FileUserTagPayload, FileWikiPageTagArgs, FileWikiPageTagNaturalOrderBy, FileWikiPageTagPayload, FrontpageGalleryItemArgs, FrontpageGalleryItemNaturalOrderBy, FrontpageGalleryItemPayload } from "./prismArgs";
import { CreatedByUserField, MakeCreatedByField, MakeVisiblePermissionField } from "./user";
import { xEvent } from "./event";
import { xInstrument } from "./instrument";
import { xBandUser } from "../entities/user/bandUser";
import { xSong } from "./song";
import { xWikiPage } from "./wiki";
import { GenericStringField, MakeDescriptionField, MakeTitleField } from "../columnTypes/genericString";
import { localizedText } from "../columnTypes/localizedString";
import { catalogColor } from "../columnTypes/bandCatalog";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

export const xFrontpageTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.edit_public_homepage,
    Edit: Permission.edit_public_homepage,
    Insert: Permission.edit_public_homepage,
};


// files for example, where
// - most people can view them
// - uploaders can upload and edit their own files
// - but editing other peoples files is for managers only.
export const xFileTableAuth_FileObjects: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_files,
    View: Permission.view_files,
    EditOwn: Permission.upload_files, // anyone can edit their own uploaded files.
    Edit: Permission.manage_files,
    Insert: Permission.upload_files,
};

export const xFileAuthMap_FileObjects = db3.defineAuthMap({
    PostQueryAsOwner: db3.DB3FieldReadAuth.inheritRow,
    PostQuery: db3.DB3FieldReadAuth.inheritRow,
    PreMutateAsOwner: Permission.upload_files,
    PreMutate: Permission.manage_files,
    PreInsert: Permission.upload_files,
});

// mime type or those kinds of things can only be edited by admins.
export const xFileAuthMap_FileObjects_AdminEdit = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
    PreMutateAsOwner: Permission.admin_files,
    PreMutate: Permission.admin_files,
    PreInsert: Permission.upload_files,
});

// some fields are server-owned -- like storage identity UUID / derived metadata
// that, if user-edited, could break integrity.
//
// these fields on File are treated specially:
// - readable along with the file itself
// - only creatable by trusted server-side code
// - never modified
const authorizeFileServerOwnedField = (args: db3.DB3AuthorizeAndSanitizeFieldInput<TAnyModel>): boolean => {
    if (args.rowMode === "view") {
        return args.auth.hasPermission(Permission.view_files);
    }
    if (args.rowMode === "new") {
        // for now, "trusted code" is assumed.
        // this is safe because this function is called by the server before mutation occurs.
        // unit test coverage verifies this
        return args.auth.hasPermission(Permission.upload_files);
    }
    return false; // by default, server-owned fields are not authorized for mutation
};





export const xBandFileTagAssignment = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.BandFileTagAssignmentDelegate>(),
    getIdentity: (association: { publicId: FileTagAssignmentPublicId }) => association.publicId,
    tableName: "bandFileTagAssignment",
    tableUniqueName: "BandFileTagAssignment",
    // File ownership is still deferred; selected-band row services reject this undeclared policy.
    deletePolicy: "hard",
    naturalOrderBy: BandFileTagAssignmentNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.BandFileTagAssignmentDefaultArgs => {
        return BandFileTagAssignmentArgs;
    },
    getRowInfo: (row: BandFileTagAssignmentPayload) => {
        return {
            pk: row.publicId,
            name: localizedText(row.bandFileTag?.name) ?? "",
            description: localizedText(row.bandFileTag?.description) ?? undefined,
            color: catalogColor(row.bandFileTag?.color, gGeneralPaletteList),
            // A view may select only the association IDs and hydrate the tag
            // from a reference store, so the owning file is not guaranteed to
            // be present in every legitimate query shape.
            ownerUserId: row.file?.uploadedByUserId,
        };
    }
    ,
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileTagAssignmentPublicId>(),
        file: foreignRefByTableId("File", {
            fkidMember: "fileId",
            authMap: xFileAuthMap_FileObjects,
        }),
        bandFileTag: foreignRef(() => xBandFileTag, {
            fkidMember: "bandFileTagId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});








//   model FileUserTag {
//     id       Int     @id @default(autoincrement())
//     publicId String  @unique @db.Char(16)
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     user   User?   @relation(fields: [userId], references: [id], onDelete: Restrict)
//     userId Int?

//     @@unique([fileId, userId]) // 
//   }





export const xFileUserTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileUserTagDelegate>(),
    getIdentity: (association: { publicId: FileUserTagPublicId }) => association.publicId,
    tableName: "FileUserTag",
    deletePolicy: "hard",
    naturalOrderBy: FileUserTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.FileUserTagDefaultArgs => {
        return FileUserTagArgs;
    },
    getRowInfo: (row: FileUserTagPayload) => {
        return {
            pk: row.publicId,
            name: row.bandUser?.user?.name ?? "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileUserTagPublicId>(),
        bandUser: foreignRef(() => xBandUser, {
            fkidMember: "bandUserId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});







//   model FileSongTag {
//     id       Int     @id @default(autoincrement())
//     publicId String  @unique @db.Char(16)
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     song   Song?   @relation(fields: [songId], references: [id], onDelete: Restrict)
//     songId Int?

//     @@unique([fileId, songId]) // 
//   }




export const xFileSongTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileSongTagDelegate>(),
    getIdentity: (association: { publicId: FileSongTagPublicId }) => association.publicId,
    tableName: "FileSongTag",
    deletePolicy: "hard",
    naturalOrderBy: FileSongTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.FileSongTagDefaultArgs => {
        return FileSongTagArgs;
    },
    getRowInfo: (row: FileSongTagPayload) => {
        return {
            pk: row.publicId,
            name: row.song?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileSongTagPublicId>(),
        file: foreignRef(() => xFile, {
            fkidMember: "fileId",
            authMap: xFileAuthMap_FileObjects,
        }),
        song: foreignRef(() => xSong, {
            fkidMember: "songId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});





//   model FileEventTag {
//     id       Int     @id @default(autoincrement())
//     publicId String  @unique @db.Char(16)
//     fileId  Int
//     file    File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     event   Event?  @relation(fields: [eventId], references: [id], onDelete: Restrict)
//     eventId Int?

//     @@unique([fileId, eventId]) // 
//   }

export const xFileEventTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileEventTagDelegate>(),
    getIdentity: (association: { publicId: FileEventTagPublicId }) => association.publicId,
    tableName: "FileEventTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileEventTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileEventTagDefaultArgs => {
        return FileEventTagArgs;
    },
    getRowInfo: (row: FileEventTagPayload) => {
        return {
            pk: row.publicId,
            name: row.event?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileEventTagPublicId>(),
        event: foreignRef(() => xEvent, {
            fkidMember: "eventId",
            authMap: xFileAuthMap_FileObjects,
        }),
        file: foreignRef(() => xFile, {
            fkidMember: "fileId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});



//   // this is hm. i suppose this is correct, but tagging instrument groups may be more accurate in some scenarios?
//   model FileInstrumentTag {
//     id           Int         @id @default(autoincrement())
//     publicId     String      @unique @db.Char(16)
//     fileId       Int
//     file         File        @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     instrument   Instrument? @relation(fields: [instrumentId], references: [id], onDelete: Cascade)
//     instrumentId Int?

//     @@unique([fileId, instrumentId]) // 
//   }



////////////////////////////////////////////////////////////////
export const xFileInstrumentTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileInstrumentTagDelegate>(),
    getIdentity: (association: { publicId: FileInstrumentTagPublicId }) => association.publicId,
    tableName: "FileInstrumentTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileInstrumentTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileInstrumentTagDefaultArgs => {
        return FileInstrumentTagArgs;
    },
    getRowInfo: (row: FileInstrumentTagPayload) => {
        return {
            pk: row.publicId,
            name: localizedText(row.bandInstrument?.name) ?? "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileInstrumentTagPublicId>(),
        bandInstrument: foreignRef(() => xInstrument, {
            fkidMember: "bandInstrumentId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});





//   // files can also just be floating uploads for example dropped into a markdown field
//   model File {
//     id             Int     @id @default(autoincrement())
//     fileLeafName   String // the name of the file as it was uploaded, visible (& editable) to users. IMG20113.jpg for example.
//     storedLeafName String // a unique filename used in server storage; a guid probably.
//     description    String
//     isDeleted      Boolean @default(false)

// uploadedAt          DateTime
// uploadedByUserId    Int?
// uploadedByUser      User?       @relation(fields: [uploadedByUserId], references: [id], onDelete: SetDefault)
// visiblePermissionId Int?
// visiblePermission   Permission? @relation(fields: [visiblePermissionId], references: [id], onDelete: SetDefault)

//     tags FileTagAssignment[]
//     taggedUsers       FileUserTag[]
//     taggedSongs       FileSongTag[]
//     taggedEvents      FileEventTag[]
//     taggedInstruments FileInstrumentTag[]
//   }

////////////////////////////////////////////////////////////////

export interface xFileFilterParams {
    fileId?: FilePublicId;
    fileTagIds: FileTagPublicId[];
};

interface ResolvedFileFilterParams {
    fileId?: number;
    fileTagIds: number[];
}

const xFileBaseArgs = db3.defineTableDesc({
    prismaModel: db3.prismaModel<Prisma.FileDelegate>(),
    getIdentity: (file: { publicId: FilePublicId }) => file.publicId,
    tableName: "File",
    bandScope: {
        member: "bandId",
        managePermission: Permission.manage_files
    },
    readConsistency: "snapshot",
    deletePolicy: "softOnly" as const,
    viewDeletedPermission: Permission.recover_files,
    restorePermission: Permission.recover_files,
    queryParameters: {
        fileId: { kind: "entityIdentity", targetTableID: "File", authorizeAs: "publicId" },
        fileTagIds: {
            kind: "entityIdentityArray",
            targetTableID: "BandFileTag",
            authorizeAs: "tags",
        },
    } satisfies db3.DB3QueryParameterMap,
    getSelectionArgs: (): Prisma.FileDefaultArgs => {
        return FileArgs;
    },
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileNaturalOrderBy,
    getParameterizedWhereClause: (params: ResolvedFileFilterParams): (Prisma.FileWhereInput[]) => {
        const ret: Prisma.FileWhereInput[] = [];
        if (params.fileId !== undefined) {
            ret.push({ id: params.fileId, });
        }
        if (params.fileTagIds?.length) {
            ret.push({
                AND: params.fileTagIds.map(fileTagId => ({
                    tags: { some: { bandFileTagId: fileTagId } },
                })),
            });
        }
        return ret;
    },
    getRowInfo: (row: FilePayload) => ({
        pk: row.publicId,
        name: row.fileLeafName,
        description: row.description,
        ownerUserId: row.uploadedByUserId,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FilePublicId>(),
        bandId: columnName => serverOwnedField(new GenericIntegerField({
            columnName,
            allowNull: false,
            allowSearchingThisField: false,
            authMap:
            {
                ...xFileAuthMap_FileObjects,
                PostQuery: Permission.never_grant,
                PostQueryAsOwner: Permission.never_grant
            },
        })),
        fileLeafName: columnName => MakeTitleField(columnName, { authMap: xFileAuthMap_FileObjects_AdminEdit }),
        description: () => MakeDescriptionField({ authMap: xFileAuthMap_FileObjects }),
        uploadedAt: columnName => MakeCreatedAtField({ columnName }),
        isDeleted: () => MakeIsDeletedField({ authMap: xFileAuthMap_FileObjects, }),
        uploadedByUser: columnName => new CreatedByUserField<"uploadedByUserId">({
            columnName,
            fkidMember: "uploadedByUserId",
            _customAuth: authorizeFileServerOwnedField,
        }),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xFileAuthMap_FileObjects }),

        sizeBytes: columnName => new GenericIntegerField({
            columnName,
            allowNull: true,
            allowSearchingThisField: false,
            _customAuth: authorizeFileServerOwnedField,
        }),
        storedLeafName: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            _customAuth: authorizeFileServerOwnedField,
        }),
        mimeType: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            _customAuth: authorizeFileServerOwnedField,
        }),
        externalURI: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            authMap: xFileAuthMap_FileObjects,
        }),
        customData: columnName => new GenericStringField({
            columnName,
            allowNull: true,
            format: "raw",
            _customAuth: authorizeFileServerOwnedField,
        }),
        fileCreatedAt: columnName => new DateTimeField({
            columnName,
            allowNull: true,
            authMap: xFileAuthMap_FileObjects,
        }),
        previewFile: foreignRefByTableId("File", {
            fkidMember: "previewFileId",
            allowNull: true,
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        parentFile: foreignRefByTableId("File", {
            fkidMember: "parentFileId",
            allowNull: true,
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        tags: tagsRef("BandFileTagAssignment", "BandFileTag", {
            associationForeignObjectMember: "bandFileTag",
            associationForeignIDMember: "bandFileTagId",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            // Localized tag labels are resolved by their catalog, outside raw File SQL matching.
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => {
                // see events tagIds on how to filter by this field.
                return false;
            },
        }), // column: tags

        taggedUsers: tagsRef("FileUserTag", "BandUser", {
            associationForeignObjectMember: "bandUser",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedUsers: {
                    some: {
                        bandUser: {
                            user: { name: { contains: query } }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedUsers

        taggedSongs: tagsRef("FileSongTag", "Song", {
            associationForeignObjectMember: "song",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedSongs: {
                    some: {
                        song: {
                            name: {
                                contains: query
                            }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedSongs

        taggedEvents: tagsRef("FileEventTag", "Event", {
            associationForeignObjectMember: "event",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedEvents: {
                    some: {
                        event: {
                            name: {
                                contains: query
                            }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedEvents

        taggedInstruments: tagsRef("FileInstrumentTag", "BandInstrument", {
            associationForeignObjectMember: "bandInstrument",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            // Inherited localized names require the resolved search owner.
            getQuickFilterWhereClause: () => false,
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedInstruments

        taggedWikiPages: tagsRef("FileWikiPageTag", "WikiPage", {
            associationForeignObjectMember: "wikiPage",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedWikiPages: {
                    some: {
                        wikiPage: {
                            slug: {
                                contains: query
                            }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedWikiPages

        // parentFile and previewFile are already the authoritative relation
        // fields above. The old array repeated them as later GhostFields; those
        // duplicates could not be addressed independently and are not carried
        // into the new one-key-per-field contract.
        childFiles: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "File",
            authMap: xFileAuthMap_FileObjects,
        }),
        frontpageGalleryItems: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "FrontpageGalleryItem",
            authMap: xFileAuthMap_FileObjects,
        }),
        pinnedForSongs: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "Song",
            authMap: xFileAuthMap_FileObjects,
        }),
        previewForFile: memberName => new ForeignCollectionField({
            memberName,
            foreignTableID: "File",
            authMap: xFileAuthMap_FileObjects,
        }),
    })

});

export const xFile = db3.defineTable(xFileBaseArgs);






export const xFrontpageAuthMap_Basic = db3.defineAuthMap({
    PostQueryAsOwner: Permission.public,
    PostQuery: Permission.public,
    PreMutateAsOwner: Permission.edit_public_homepage,
    PreMutate: Permission.edit_public_homepage,
    PreInsert: Permission.edit_public_homepage,
});



// model FrontpageGalleryItem {
//     id            Int     @id @default(autoincrement())
//     isDeleted     Boolean @default(false) //  soft delete. when hidden, users won't see them.
//     caption       String // markdown
//     sortOrder     Int     @default(0)
//     fileId        Int
//     file          File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     displayParams String // JSON of GalleryImageDisplayParams

//     createdByUserId     Int? // required in order to know visibility when visiblePermissionId is NULL
//     createdByUser       User?       @relation(fields: [createdByUserId], references: [id], onDelete: SetDefault)
//     visiblePermissionId Int?
//     visiblePermission   Permission? @relation(fields: [visiblePermissionId], references: [id], onDelete: SetDefault)
//   }
export const xFrontpageGalleryItem = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FrontpageGalleryItemDelegate>(),
    getIdentity: (item: { publicId: FrontpageGalleryItemPublicId }) => item.publicId,
    tableName: "FrontpageGalleryItem",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.edit_public_homepage,
    restorePermission: Permission.edit_public_homepage,
    queryParameters: {},
    getSelectionArgs: (): Prisma.FrontpageGalleryItemDefaultArgs => {
        return FrontpageGalleryItemArgs;
    },
    tableAuthMap: xFrontpageTableAuthMap,
    naturalOrderBy: FrontpageGalleryItemNaturalOrderBy,
    getParameterizedWhereClause: (params: any): (Prisma.FrontpageGalleryItemWhereInput[]) => [],
    getRowInfo: (row: FrontpageGalleryItemPayload) => ({
        pk: row.publicId,
        name: row.caption,
        description: row.caption,
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FrontpageGalleryItemPublicId>(),
        isDeleted: () => MakeIsDeletedField({ authMap: xFrontpageAuthMap_Basic }),
        sortOrder: () => MakeSortOrderField({ authMap: xFrontpageAuthMap_Basic }),
        createdByUser: () => MakeCreatedByField(),
        visiblePermission: () => MakeVisiblePermissionField({ authMap: xFrontpageAuthMap_Basic }),
        caption: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xFrontpageAuthMap_Basic,
        }),

        caption_nl: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xFrontpageAuthMap_Basic,
        }),
        caption_fr: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "markdown",
            authMap: xFrontpageAuthMap_Basic,
        }),
        displayParams: columnName => new GenericStringField({
            columnName,
            allowNull: false,
            format: "raw",
            authMap: xFrontpageAuthMap_Basic,
        }),
        file: foreignRef(() => xFile, {
            fkidMember: "fileId",
            authMap: xFrontpageAuthMap_Basic,
        }),
    })

});


////////////////////////////////////////////////////////////////
export const xFileWikiPageTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileWikiPageTagDelegate>(),
    getIdentity: (association: { publicId: FileWikiPageTagPublicId }) => association.publicId,
    tableName: "FileWikiPageTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileWikiPageTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileWikiPageTagDefaultArgs => {
        return FileWikiPageTagArgs;
    },
    getRowInfo: (row: FileWikiPageTagPayload) => {
        return {
            pk: row.publicId,
            name: row.wikiPage?.slug || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield({ naturalIdVisibility: "sysadmin" }),
        publicId: () => MakePublicIdField<FileWikiPageTagPublicId>(),
        wikiPage: foreignRef(() => xWikiPage, {
            fkidMember: "wikiPageId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        File: typeof xFile;
        BandFileTagAssignment: typeof xBandFileTagAssignment;
        FileUserTag: typeof xFileUserTag;
        FileSongTag: typeof xFileSongTag;
        FileEventTag: typeof xFileEventTag;
        FileInstrumentTag: typeof xFileInstrumentTag;
        FileWikiPageTag: typeof xFileWikiPageTag;
        FrontpageGalleryItem: typeof xFrontpageGalleryItem;
    }
}


// MIGRATION_RESTORE: file-search
// Source: 16e1df9a3676926a787728cb1ef970f9d99cf70e:src/core/db3/shared/schema/file.ts:514-533
// Reason: Raw File tag text matching cannot query the new localized catalog. General File ownership recovery remains pending.
// Restore: Restore File quick filtering against resolved band tag labels, alongside the File ownership migration.
// Verification: Test localized names, intentional blanks, hidden assigned tags, cross-band visibility, pagination and the built File search.
// SHA256: 53c67c38509c8af2b219262e0379ba637cdb443bcb04c00ecdeab26f0d2b2c0d
// MIGRATION_REFERENCE_BEGIN
//         tags: tagsRef("FileTagAssignment", "FileTag", {
//             associationForeignObjectMember: "fileTag",
//             associationLocalObjectMember: "file",
//             authMap: xFileAuthMap_FileObjects,
//             getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
//                 tags: {
//                     some: {
//                         fileTag: {
//                             text: {
//                                 contains: query
//                             }
//                         }
//                     }
//                 }
//             }),
//             getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => {
//                 // see events tagIds on how to filter by this field.
//                 return false;
//             },
//         }), // column: tags
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-search
// Source: 3eef35e286d02c61aebd0bb000c433c34cfb15a6:src/core/db3/shared/schema/file.ts:517-533
// Reason: Raw File tag and instrument name matching cannot query the new localized catalogs safely.
// Restore: Restore File quick filtering against resolved band tag and instrument labels, preserving blanks, hidden assignments, visibility and pagination.
// Verification: Test localized names, intentional blanks, hidden assigned tags, cross-band visibility, pagination and the built File search.
// SHA256: dc73e42b7b289110a48094338e4cb658ec4b371bd36aca432a76f3473b0e02c8
// MIGRATION_REFERENCE_BEGIN
//         taggedInstruments: tagsRef("FileInstrumentTag", "BandInstrument", {
//             associationForeignObjectMember: "instrument",
//             associationLocalObjectMember: "file",
//             authMap: xFileAuthMap_FileObjects,
//             getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
//                 taggedInstruments: {
//                     some: {
//                         instrument: {
//                             name: {
//                                 contains: query
//                             }
//                         }
//                     }
//                 }
//             }),
//             getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
//         }), // column: taggedInstruments
// MIGRATION_REFERENCE_END
