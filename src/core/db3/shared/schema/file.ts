import { FileEventTag, FileInstrumentTag, FileSongTag, FileUserTag, FileWikiPageTag, Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CMDBTableFilterModel } from "../apiTypes";
import { DateTimeField, ForeignSingleField, GenericIntegerField, GenericStringField, GhostField, MakeColorField, MakeCreatedAtField, MakeDescriptionField, MakeIsDeletedField, MakeMarkdownTextField, MakePKfield, MakeSignificanceField, MakeSortOrderField, MakeTitleField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { FileArgs, FileEventTagArgs, FileEventTagNaturalOrderBy, FileEventTagPayload, FileInstrumentTagArgs, FileInstrumentTagNaturalOrderBy, FileInstrumentTagPayload, FileNaturalOrderBy, FilePayload, FileSongTagArgs, FileSongTagNaturalOrderBy, FileSongTagPayload, FileTagArgs, FileTagAssignmentArgs, FileTagAssignmentNaturalOrderBy, FileTagAssignmentPayload, FileTagNaturalOrderBy, FileTagPayload, FileTagSignificance, FileUserTagArgs, FileUserTagNaturalOrderBy, FileUserTagPayload, FileWikiPageTagArgs, FileWikiPageTagNaturalOrderBy, FileWikiPageTagPayload, FrontpageGalleryItemArgs, FrontpageGalleryItemNaturalOrderBy, FrontpageGalleryItemPayload } from "./prismArgs";
import { CreatedByUserField, MakeCreatedByField, MakeVisiblePermissionField } from "./user";

export const xFrontpageTableAuthMap: db3.DB3AuthTablePermissionMap = {
    ViewOwn: Permission.basic_trust,
    View: Permission.basic_trust,
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

export const xFileAuthMap_AdminObjects: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
    PreMutateAsOwner: Permission.view_files,
    PreMutate: Permission.admin_files,
    PreInsert: Permission.admin_files,
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

export const xFileAuthMap_FileObjects: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
    PreMutateAsOwner: Permission.upload_files,
    PreMutate: Permission.manage_files,
    PreInsert: Permission.upload_files,
};

// mime type or those kinds of things can only be edited by admins.
export const xFileAuthMap_FileObjects_AdminEdit: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.view_files,
    PostQuery: Permission.view_files,
    PreMutateAsOwner: Permission.admin_files,
    PreMutate: Permission.admin_files,
    PreInsert: Permission.upload_files,
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


export const xFileTag = new db3.xTable({
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagInclude => {
        return FileTagArgs.include;
    },
    tableName: "FileTag",
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
    columns: [
        MakePKfield(),
        MakeTitleField("text", { authMap: xFileAuthMap_AdminObjects }),
        MakeMarkdownTextField("description", { authMap: xFileAuthMap_AdminObjects }),
        MakeSortOrderField({ authMap: xFileAuthMap_AdminObjects }),
        MakeColorField({ authMap: xFileAuthMap_AdminObjects }),
        MakeSignificanceField("significance", FileTagSignificance, { authMap: xFileAuthMap_AdminObjects }),
        new GhostField({ memberName: "fileAssignments", authMap: xFileAuthMap_AdminObjects }),
    ]
});


export const xFileTagAssignment = new db3.xTable({
    tableName: "FileTagAssignment",
    naturalOrderBy: FileTagAssignmentNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagAssignmentInclude => {
        return FileTagAssignmentArgs.include;
    },
    getRowInfo: (row: FileTagAssignmentPayload) => {
        return {
            pk: row.id,
            name: row.fileTag?.text || "",
            description: row.fileTag?.description || "",
            color: gGeneralPaletteList.findEntry(row.fileTag?.color || null),
            ownerUserId: row.file.uploadedByUserId,
        };
    }
    ,
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.FileTagGetPayload<{}>>({
            columnName: "fileTag",
            fkidMember: "fileTagId",
            allowNull: false,
            foreignTableID: "FileTag",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});








//   model FileUserTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     user   User?   @relation(fields: [userId], references: [id], onDelete: Restrict)
//     userId Int?

//     @@unique([fileId, userId]) // 
//   }





export const xFileUserTag = new db3.xTable({
    tableName: "FileUserTag",
    naturalOrderBy: FileUserTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileUserTagInclude => {
        return FileUserTagArgs.include;
    },
    getRowInfo: (row: FileUserTagPayload) => {
        return {
            pk: row.id,
            name: row.user?.name || "",
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.FileUserTagGetPayload<{}>>({
            columnName: "user",
            fkidMember: "userId",
            allowNull: false,
            foreignTableID: "User",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});







//   model FileSongTag {
//     id     Int     @id @default(autoincrement())
//     fileId Int
//     file   File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     song   Song?   @relation(fields: [songId], references: [id], onDelete: Restrict)
//     songId Int?

//     @@unique([fileId, songId]) // 
//   }




export const xFileSongTag = new db3.xTable({
    tableName: "FileSongTag",
    naturalOrderBy: FileSongTagNaturalOrderBy,
    tableAuthMap: xFileTableAuth_FileObjects,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileSongTagInclude => {
        return FileSongTagArgs.include;
    },
    getRowInfo: (row: FileSongTagPayload) => {
        return {
            pk: row.id,
            name: row.song?.name || "",
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.FileSongTagGetPayload<{}>>({
            columnName: "song",
            fkidMember: "songId",
            allowNull: false,
            authMap: xFileAuthMap_FileObjects,
            foreignTableID: "Song",
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});





//   model FileEventTag {
//     id      Int     @id @default(autoincrement())
//     fileId  Int
//     file    File    @relation(fields: [fileId], references: [id], onDelete: Cascade)
//     event   Event?  @relation(fields: [eventId], references: [id], onDelete: Restrict)
//     eventId Int?

//     @@unique([fileId, eventId]) // 
//   }

export const xFileEventTag = new db3.xTable({
    tableName: "FileEventTag",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileEventTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileEventTagInclude => {
        return FileEventTagArgs.include;
    },
    getRowInfo: (row: FileEventTagPayload) => {
        return {
            pk: row.id,
            name: row.event?.name || "",
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkidMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.FileGetPayload<{}>>({
            columnName: "file",
            fkidMember: "fileId",
            allowNull: false,
            foreignTableID: "File",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
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
export const xFileInstrumentTag = new db3.xTable({
    tableName: "FileInstrumentTag",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileInstrumentTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInstrumentTagInclude => {
        return FileInstrumentTagArgs.include;
    },
    getRowInfo: (row: FileInstrumentTagPayload) => {
        return {
            pk: row.id,
            name: row.instrument?.name || "",
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.FileInstrumentTagGetPayload<{}>>({
            columnName: "instrument",
            fkidMember: "instrumentId",
            allowNull: false,
            foreignTableID: "Instrument",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
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

export const xFile = new db3.xTable({
    tableName: "File",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInclude => {
        return FileArgs.include;
    },
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileNaturalOrderBy,
    getParameterizedWhereClause: (params: xFileFilterParams, clientIntention: db3.xTableClientUsageContext): (Prisma.FileWhereInput[]) => {
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
    columns: [
        MakePKfield(),
        MakeTitleField("fileLeafName", { authMap: xFileAuthMap_FileObjects_AdminEdit }),
        MakeDescriptionField({ authMap: xFileAuthMap_FileObjects }),
        MakeCreatedAtField({ columnName: "uploadedAt" }),
        MakeIsDeletedField({ authMap: xFileAuthMap_FileObjects, }),
        new CreatedByUserField({
            columnName: "uploadedByUser",
            fkidMember: "uploadedByUserId",
            //authMap: xFileAuthMap_FileObjects_AdminEdit,
        }),
        MakeVisiblePermissionField({ authMap: xFileAuthMap_FileObjects }),

        new GenericIntegerField({
            columnName: "sizeBytes",
            allowNull: true,
            allowSearchingThisField: false,
            authMap: xFileAuthMap_FileObjects_AdminEdit,
        }),
        new GenericStringField({
            columnName: "storedLeafName",
            allowNull: false,
            format: "raw",
            authMap: xFileAuthMap_FileObjects_AdminEdit,
        }),
        new GenericStringField({
            columnName: "mimeType",
            allowNull: true,
            format: "raw",
            authMap: xFileAuthMap_FileObjects_AdminEdit,
        }),
        new GenericStringField({
            columnName: "externalURI",
            allowNull: true,
            format: "raw",
            authMap: xFileAuthMap_FileObjects,
        }),
        new GenericStringField({
            columnName: "customData",
            allowNull: true,
            format: "raw",
            authMap: xFileAuthMap_FileObjects,
        }),
        new DateTimeField({
            columnName: "fileCreatedAt",
            allowNull: true,
            authMap: xFileAuthMap_FileObjects,
        }),
        new ForeignSingleField<Prisma.FileTagGetPayload<{}>>({
            columnName: "previewFile",
            fkidMember: "previewFileId",
            allowNull: true,
            foreignTableID: "File",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.FileTagGetPayload<{}>>({
            columnName: "parentFile",
            fkidMember: "parentFileId",
            allowNull: true,
            foreignTableID: "File",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),

        new TagsField<FileTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "fileTagId",
            associationForeignObjectMember: "fileTag",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileTagAssignment",
            foreignTableID: "FileTag",
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

        new TagsField<FileUserTag>({
            columnName: "taggedUsers",
            associationForeignIDMember: "userId",
            associationForeignObjectMember: "user",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileUserTag",
            foreignTableID: "User",
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

        new TagsField<FileSongTag>({
            columnName: "taggedSongs",
            associationForeignIDMember: "songId",
            associationForeignObjectMember: "song",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileSongTag",
            foreignTableID: "Song",
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

        new TagsField<FileEventTag>({
            columnName: "taggedEvents",
            associationForeignIDMember: "eventId",
            associationForeignObjectMember: "event",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileEventTag",
            foreignTableID: "Event",
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

        new TagsField<FileInstrumentTag>({
            columnName: "taggedInstruments",
            associationForeignIDMember: "instrumentId",
            associationForeignObjectMember: "instrument",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileInstrumentTag",
            foreignTableID: "Instrument",
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

        new TagsField<FileWikiPageTag>({
            columnName: "taggedWikiPages",
            associationForeignIDMember: "wikiPageId",
            associationForeignObjectMember: "wikiPage",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileWikiPageTag",
            foreignTableID: "WikiPage",
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
    ]

});





export const xFrontpageAuthMap_Basic: db3.DB3AuthContextPermissionMap = {
    PostQueryAsOwner: Permission.public,
    PostQuery: Permission.public,
    PreMutateAsOwner: Permission.edit_public_homepage,
    PreMutate: Permission.edit_public_homepage,
    PreInsert: Permission.edit_public_homepage,
};



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
export const xFrontpageGalleryItem = new db3.xTable({
    tableName: "FrontpageGalleryItem",
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FrontpageGalleryItemInclude => {
        return FrontpageGalleryItemArgs.include;
    },
    tableAuthMap: xFrontpageTableAuthMap,
    naturalOrderBy: FrontpageGalleryItemNaturalOrderBy,
    getParameterizedWhereClause: (params: any, clientIntention: db3.xTableClientUsageContext): (Prisma.FrontpageGalleryItemWhereInput[]) => [],
    getRowInfo: (row: FrontpageGalleryItemPayload) => ({
        pk: row.id,
        name: row.caption,
        description: row.caption,
        ownerUserId: null,
    }),
    columns: [
        MakePKfield(),
        MakeIsDeletedField({ authMap: xFrontpageAuthMap_Basic }),
        MakeSortOrderField({ authMap: xFrontpageAuthMap_Basic }),
        MakeCreatedByField(),
        MakeVisiblePermissionField({ authMap: xFrontpageAuthMap_Basic }),
        new GenericStringField({
            columnName: "caption",
            allowNull: false,
            format: "markdown",
            specialFunction: db3.SqlSpecialColumnFunction.name,
            authMap: xFrontpageAuthMap_Basic,
        }),

        new GenericStringField({
            columnName: "caption_nl",
            allowNull: false,
            format: "markdown",
            authMap: xFrontpageAuthMap_Basic,
        }),
        new GenericStringField({
            columnName: "caption_fr",
            allowNull: false,
            format: "markdown",
            authMap: xFrontpageAuthMap_Basic,
        }),
        new GenericStringField({
            columnName: "displayParams",
            allowNull: false,
            format: "raw",
            authMap: xFrontpageAuthMap_Basic,
        }),
        new ForeignSingleField<Prisma.FileGetPayload<{}>>({
            columnName: "file",
            fkidMember: "fileId",
            allowNull: false,
            foreignTableID: "File",
            authMap: xFrontpageAuthMap_Basic,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]

});


////////////////////////////////////////////////////////////////
export const xFileWikiPageTag = new db3.xTable({
    tableName: "FileWikiPageTag",
    tableAuthMap: xFileTableAuth_FileObjects,
    naturalOrderBy: FileWikiPageTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileWikiPageTagInclude => {
        return FileWikiPageTagArgs.include;
    },
    getRowInfo: (row: FileWikiPageTagPayload) => {
        return {
            pk: row.id,
            name: row.wikiPage?.slug || "",
            ownerUserId: null,
        };
    },
    columns: [
        MakePKfield(),
        new ForeignSingleField<Prisma.FileWikiPageTagGetPayload<{}>>({
            columnName: "wikiPage",
            fkidMember: "wikiPageId",
            allowNull: false,
            foreignTableID: "WikiPage",
            authMap: xFileAuthMap_FileObjects,
            getQuickFilterWhereClause: (query: string) => false,
        }),
    ]
});
