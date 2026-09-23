import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { TAnyModel } from "shared/rootroot";
import { CMDBTableFilterModel } from "../apiTypes";
import { DateTimeField, foreignRef, foreignRefByTableId, GenericIntegerField, GhostField, MakeColorField, MakeCreatedAtField, MakeIsDeletedField, MakePKfield, MakeSignificanceField, MakeSortOrderField, tagsRef } from "../columnTypes/xTableColumnTypes";
import * as db3 from "../db3core";
import { FileArgs, FileEventTagArgs, FileEventTagNaturalOrderBy, FileEventTagPayload, FileInstrumentTagArgs, FileInstrumentTagNaturalOrderBy, FileInstrumentTagPayload, FileNaturalOrderBy, FilePayload, FileSongTagArgs, FileSongTagNaturalOrderBy, FileSongTagPayload, FileTagArgs, FileTagAssignmentArgs, FileTagAssignmentNaturalOrderBy, FileTagAssignmentPayload, FileTagNaturalOrderBy, FileTagPayload, FileTagSignificance, FileUserTagArgs, FileUserTagNaturalOrderBy, FileUserTagPayload, FileWikiPageTagArgs, FileWikiPageTagNaturalOrderBy, FileWikiPageTagPayload, FrontpageGalleryItemArgs, FrontpageGalleryItemNaturalOrderBy, FrontpageGalleryItemPayload } from "./prismArgs";
import { CreatedByUserField, MakeCreatedByField, MakeVisiblePermissionField, xUser } from "./user";
import { xEvent } from "./event";
import { xInstrument } from "./instrument";
import { xSong } from "./song";
import { xWikiPage } from "./wiki";
import { GenericStringField, MakeDescriptionField, MakeMarkdownTextField, MakeTitleField } from "../columnTypes/genericString";
import { gGeneralPaletteList } from "@/src/core/components/color/palette";

export const xFrontpageTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.public,
    View: Permission.public,
    EditOwn: Permission.edit_public_homepage,
    Edit: Permission.edit_public_homepage,
    Insert: Permission.edit_public_homepage,
};


// Admin objects are like file tags and similar fields which are viewable by any file users, but only managed by admins.
export const xFileTableAuth_AdminObjects: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.view_files,
    View: Permission.view_files,
    EditOwn: Permission.view_files,
    Edit: Permission.admin_files,
    Insert: Permission.admin_files,
};

export const xFileAuthMap_AdminObjects = db3.defineAuthMap({
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
    PreMutateAsOwner: Permission.view_files,
    PreMutate: Permission.admin_files,
    PreInsert: Permission.admin_files,
});


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
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
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
const authorizeFileServerOwnedField = (args: db3.DB3AuthorizeAndSanitizeInput<TAnyModel>): boolean => {
    if (args.rowMode === "view") {
        return args.publicData.effectivePermissions.includesName(Permission.view_files);
    }
    if (args.rowMode === "new") {
        // for now, "trusted code" is assumed.
        // this is safe because this function is called by the server before mutation occurs.
        // unit test coverage verifies this
        return args.publicData.effectivePermissions.includesName(Permission.upload_files);
    }
    return false; // by default, server-owned fields are not authorized for mutation
};





// // tech rider, partition, invoice, contract, event media, other, what is the usage?
// model FileTag {
//     id           Int                  @id @default(autoincrement())
//     text         String
//     description  String               @default("")
//     color        String?
//     significance String? // 
//     sortOrder    Int                  @default(0)
//     fileAssignments       FileTagAssignment[]
//   }


export const xFileTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileTagDelegate>(),
    getIdentity: (tag: Prisma.FileTagGetPayload<{}>) => tag.id,
    getSelectionArgs: (): Prisma.FileTagDefaultArgs => {
        return FileTagArgs;
    },
    tableName: "FileTag",
    deletePolicy: "hard",
    naturalOrderBy: FileTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_AdminObjects,
    createInsertModelFromString: (input: string): Prisma.FileTagCreateInput => {
        return {
            text: input,
            description: "auto-created",
            sortOrder: 0,
            color: null,
            significance: null,
        };
    },
    getRowInfo: (row: FileTagPayload) => ({
        pk: row.id,
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        text: columnName => MakeTitleField(columnName, { authMap: xFileAuthMap_AdminObjects }),
        description: columnName => MakeMarkdownTextField(columnName, { authMap: xFileAuthMap_AdminObjects }),
        sortOrder: () => MakeSortOrderField({ authMap: xFileAuthMap_AdminObjects }),
        color: () => MakeColorField({ authMap: xFileAuthMap_AdminObjects }),
        significance: columnName => MakeSignificanceField(columnName, FileTagSignificance, { authMap: xFileAuthMap_AdminObjects }),
        fileAssignments: memberName => new GhostField({ memberName, authMap: xFileAuthMap_AdminObjects }),
    })
});


export const xFileTagAssignment = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileTagAssignmentDelegate>(),
    tableName: "FileTagAssignment",
    deletePolicy: "hard",
    naturalOrderBy: FileTagAssignmentNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.FileTagAssignmentDefaultArgs => {
        return FileTagAssignmentArgs;
    },
    getRowInfo: (row: FileTagAssignmentPayload) => {
        return {
            pk: row.id,
            name: row.fileTag?.text || "",
            description: row.fileTag?.description || "",
            color: gGeneralPaletteList.findEntry(row.fileTag?.color || null),
            // A view may select only the association IDs and hydrate the tag
            // from a reference store, so the owning file is not guaranteed to
            // be present in every legitimate query shape.
            ownerUserId: row.file?.uploadedByUserId,
        };
    }
    ,
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        fileTag: foreignRef(() => xFileTag, {
            fkidMember: "fileTagId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});








//   model FileUserTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     user   User?   @relation(fields: [userId], references: [id], onDelete: Restrict)
//     userId Int?

//     @@unique([fileId, userId]) // 
//   }





export const xFileUserTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileUserTagDelegate>(),
    tableName: "FileUserTag",
    deletePolicy: "hard",
    naturalOrderBy: FileUserTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.FileUserTagDefaultArgs => {
        return FileUserTagArgs;
    },
    getRowInfo: (row: FileUserTagPayload) => {
        return {
            pk: row.id,
            name: row.user?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        user: foreignRef(() => xUser, {
            fkidMember: "userId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});







//   model FileSongTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     song   Song?   @relation(fields: [songId], references: [id], onDelete: Restrict)
//     songId Int?

//     @@unique([fileId, songId]) // 
//   }




export const xFileSongTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileSongTagDelegate>(),
    tableName: "FileSongTag",
    deletePolicy: "hard",
    naturalOrderBy: FileSongTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getSelectionArgs: (): Prisma.FileSongTagDefaultArgs => {
        return FileSongTagArgs;
    },
    getRowInfo: (row: FileSongTagPayload) => {
        return {
            pk: row.id,
            name: row.song?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
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
//     id      Int     @id @default(autoincrement())
//     fileId  Int
//     file    File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     event   Event?  @relation(fields: [eventId], references: [id], onDelete: Restrict)
//     eventId Int?

//     @@unique([fileId, eventId]) // 
//   }

export const xFileEventTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileEventTagDelegate>(),
    tableName: "FileEventTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileEventTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileEventTagDefaultArgs => {
        return FileEventTagArgs;
    },
    getRowInfo: (row: FileEventTagPayload) => {
        return {
            pk: row.id,
            name: row.event?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
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
//     fileId       Int
//     file         File        @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     instrument   Instrument? @relation(fields: [instrumentId], references: [id], onDelete: Cascade)
//     instrumentId Int?

//     @@unique([fileId, instrumentId]) // 
//   }



////////////////////////////////////////////////////////////////
export const xFileInstrumentTag = db3.defineTable({
    prismaModel: db3.prismaModel<Prisma.FileInstrumentTagDelegate>(),
    tableName: "FileInstrumentTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileInstrumentTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileInstrumentTagDefaultArgs => {
        return FileInstrumentTagArgs;
    },
    getRowInfo: (row: FileInstrumentTagPayload) => {
        return {
            pk: row.id,
            name: row.instrument?.name || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        instrument: foreignRef(() => xInstrument, {
            fkidMember: "instrumentId",
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
    fileId?: number;
    fileTagIds: number[];
};

const xFileBaseArgs = {
    prismaModel: db3.prismaModel<Prisma.FileDelegate>(),
    getIdentity: (file: { id: number }) => file.id,
    tableName: "File",
    deletePolicy: "softOnly" as const,
    viewDeletedPermission: Permission.recover_files,
    restorePermission: Permission.recover_files,
    queryParameters: {
        fileId: { kind: "integer", authorizeAs: "id" },
        fileTagIds: { kind: "integerArray", authorizeAs: "tags" },
    } satisfies db3.DB3QueryParameterMap,
    getSelectionArgs: (): Prisma.FileDefaultArgs => {
        return FileArgs;
    },
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileNaturalOrderBy,
    getParameterizedWhereClause: (params: xFileFilterParams): (Prisma.FileWhereInput[]) => {
        const ret: Prisma.FileWhereInput[] = [];
        if (params.fileId !== undefined) {
            ret.push({ id: params.fileId, });
        }
        return ret;
    },
    getRowInfo: (row: FilePayload) => ({
        pk: row.id,
        name: row.fileLeafName,
        description: row.description,
        ownerUserId: row.uploadedByUserId,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
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

        tags: tagsRef("FileTagAssignment", "FileTag", {
            associationForeignObjectMember: "fileTag",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                tags: {
                    some: {
                        fileTag: {
                            text: {
                                contains: query
                            }
                        }
                    }
                }
            }),
            getCustomFilterWhereClause: (query: CMDBTableFilterModel): Prisma.FileWhereInput | boolean => {
                // see events tagIds on how to filter by this field.
                return false;
            },
        }), // column: tags

        taggedUsers: tagsRef("FileUserTag", "User", {
            associationForeignObjectMember: "user",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedUsers: {
                    some: {
                        user: {
                            name: {
                                contains: query
                            }
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

        taggedInstruments: tagsRef("FileInstrumentTag", "Instrument", {
            associationForeignObjectMember: "instrument",
            associationLocalObjectMember: "file",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string): Prisma.FileWhereInput => ({
                taggedInstruments: {
                    some: {
                        instrument: {
                            name: {
                                contains: query
                            }
                        }
                    }
                }
            }),
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
        childFiles: memberName => new GhostField({ memberName, authMap: xFileAuthMap_FileObjects }),
        frontpageGalleryItems: memberName => new GhostField({ memberName, authMap: xFileAuthMap_FileObjects }),
        pinnedForSongs: memberName => new GhostField({ memberName, authMap: xFileAuthMap_FileObjects }),
        previewForFile: memberName => new GhostField({ memberName, authMap: xFileAuthMap_FileObjects }),
    })

};

export const xFile = db3.defineTable(xFileBaseArgs);
export const xFileVerbose = db3.defineTable(xFileBaseArgs);





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
    getIdentity: (item: { id: number }) => item.id,
    tableName: "FrontpageGalleryItem",
    deletePolicy: "softOnly",
    viewDeletedPermission: Permission.edit_public_homepage,
    restorePermission: Permission.edit_public_homepage,
    sortOrderPolicy: { groupingColumn: null, scope: "explicitRowIds" },
    queryParameters: {},
    getSelectionArgs: (): Prisma.FrontpageGalleryItemDefaultArgs => {
        return FrontpageGalleryItemArgs;
    },
    tableAuthMap: xFrontpageTableAuthMap,
    naturalOrderBy: FrontpageGalleryItemNaturalOrderBy,
    getParameterizedWhereClause: (params: any): (Prisma.FrontpageGalleryItemWhereInput[]) => [],
    getRowInfo: (row: FrontpageGalleryItemPayload) => ({
        pk: row.id,
        name: row.caption,
        description: row.caption,
        ownerUserId: null,
    }),
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
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
    tableName: "FileWikiPageTag",
    deletePolicy: "hard",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileWikiPageTagNaturalOrderBy,
    getSelectionArgs: (): Prisma.FileWikiPageTagDefaultArgs => {
        return FileWikiPageTagArgs;
    },
    getRowInfo: (row: FileWikiPageTagPayload) => {
        return {
            pk: row.id,
            name: row.wikiPage?.slug || "",
            ownerUserId: null,
        };
    },
    fields: db3.makeColumnSet({
        id: () => MakePKfield(),
        wikiPage: foreignRef(() => xWikiPage, {
            fkidMember: "wikiPageId",
            authMap: xFileAuthMap_FileObjects,
        }),
    })
});

declare module "../db3core" {
    interface DB3TableTypeRegistry {
        File: typeof xFile;
        FileTag: typeof xFileTag;
        FileTagAssignment: typeof xFileTagAssignment;
        FileUserTag: typeof xFileUserTag;
        FileSongTag: typeof xFileSongTag;
        FileEventTag: typeof xFileEventTag;
        FileInstrumentTag: typeof xFileInstrumentTag;
        FileWikiPageTag: typeof xFileWikiPageTag;
    }
}
