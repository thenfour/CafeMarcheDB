
import { FileEventTag, FileInstrumentTag, FileSongTag, FileUserTag, Prisma } from "db";
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { BoolField, ForeignSingleField, GenericStringField, MakeColorField, MakeCreatedAtField, MakeIntegerField, MakeMarkdownTextField, MakeSignificanceField, MakeSortOrderField, MakeTitleField, PKField, TagsField } from "../db3basicFields";
import * as db3 from "../db3core";
import { FileArgs, FileEventTagArgs, FileEventTagNaturalOrderBy, FileEventTagPayload, FileInstrumentTagArgs, FileInstrumentTagNaturalOrderBy, FileInstrumentTagPayload, FileNaturalOrderBy, FilePayload, FileSongTagArgs, FileSongTagNaturalOrderBy, FileSongTagPayload, FileTagArgs, FileTagAssignmentArgs, FileTagAssignmentNaturalOrderBy, FileTagAssignmentPayload, FileTagNaturalOrderBy, FileTagPayload, FileTagSignificance, FileUserTagArgs, FileUserTagNaturalOrderBy, FileUserTagPayload } from "./prismArgs";
import { CreatedByUserField, VisiblePermissionField } from "./user";
//import { xEvent } from "./event";



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
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagInclude => {
        return FileTagArgs.include;
    },
    tableName: "fileTag",
    naturalOrderBy: FileTagNaturalOrderBy,
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
        name: row.text,
        description: row.description,
        color: gGeneralPaletteList.findEntry(row.color),
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("text"),
        MakeMarkdownTextField("description"),
        MakeSortOrderField("sortOrder"),
        MakeColorField("color"),
        MakeSignificanceField("significance", FileTagSignificance),
    ]
});


//   model FileTagAssignment {
//     id         Int      @id @default(autoincrement())
//     fileId    Int
//     file      File    @relation(fields: [fileId], references: [id], onDelete: Restrict) // files are soft-delete.
//     fileTagId Int
//     fileTag   FileTag @relation(fields: [fileTagId], references: [id], onDelete: Cascade) // delete tag = delete the associations.

//     @@unique([fileId, fileTagId]) // 
//   }









export const xFileTagAssignment = new db3.xTable({
    tableName: "FileTagAssignment",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileTagAssignmentNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagAssignmentInclude => {
        return FileTagAssignmentArgs.include;
    },
    getRowInfo: (row: FileTagAssignmentPayload) => {
        return {
            name: row.fileTag.text,
            description: row.fileTag.description,
            color: gGeneralPaletteList.findEntry(row.fileTag.color),
        };
    }
    ,
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.FileTagGetPayload<{}>>({
            columnName: "fileTag",
            fkMember: "fileTagId",
            allowNull: false,
            foreignTableID: "FileTag",
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
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileUserTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileUserTagInclude => {
        return FileUserTagArgs.include;
    },
    getRowInfo: (row: FileUserTagPayload) => {
        return {
            name: row.user.name,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.FileUserTagGetPayload<{}>>({
            columnName: "user",
            fkMember: "userId",
            allowNull: false,
            foreignTableID: "User",
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
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileSongTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileSongTagInclude => {
        return FileSongTagArgs.include;
    },
    getRowInfo: (row: FileSongTagPayload) => {
        return {
            name: row.song.name,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.FileSongTagGetPayload<{}>>({
            columnName: "song",
            fkMember: "songId",
            allowNull: false,
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
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileEventTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileEventTagInclude => {
        return FileEventTagArgs.include;
    },
    getRowInfo: (row: FileEventTagPayload) => {
        return {
            name: row.event.name,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.EventGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableID: "Event",
            getQuickFilterWhereClause: (query: string) => false,
        }),
        new ForeignSingleField<Prisma.FileGetPayload<{}>>({
            columnName: "file",
            fkMember: "fileId",
            allowNull: false,
            foreignTableID: "File",
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
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileInstrumentTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInstrumentTagInclude => {
        return FileInstrumentTagArgs.include;
    },
    getRowInfo: (row: FileInstrumentTagPayload) => {
        return {
            name: row.instrument.name,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.FileInstrumentTagGetPayload<{}>>({
            columnName: "instrument",
            fkMember: "instrumentId",
            allowNull: false,
            foreignTableID: "Instrument",
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
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInclude => {
        return FileArgs.include;
    },
    softDeleteSpec: {
        isDeletedColumnName: "isDeleted",
    },
    visibilitySpec: {
        ownerUserIDColumnName: "uploadedByUserId",
        visiblePermissionIDColumnName: "visiblePermissionId",
    },
    naturalOrderBy: FileNaturalOrderBy,
    getParameterizedWhereClause: (params: xFileFilterParams, clientIntention: db3.xTableClientUsageContext): (Prisma.FileWhereInput[]) => {
        const ret: Prisma.FileWhereInput[] = [];

        console.assert(clientIntention.currentUser?.id !== undefined);
        console.assert(clientIntention.currentUser?.role?.permissions !== undefined);

        if (params.fileId !== undefined) {
            ret.push({ id: params.fileId, });
        }
        return ret;
    },
    getRowInfo: (row: FilePayload) => ({
        name: row.fileLeafName,
        description: row.description,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("fileLeafName"),
        MakeIntegerField("sizeBytes"),
        new GenericStringField({
            columnName: "storedLeafName",
            allowNull: false,
            format: "raw",
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
        }),
        new GenericStringField({
            columnName: "mimeType",
            allowNull: true,
            format: "raw",
        }),
        new GenericStringField({
            columnName: "previewData",
            allowNull: true,
            format: "raw",
        }),
        MakeCreatedAtField("uploadedAt"),
        new BoolField({ columnName: "isDeleted", defaultValue: false }),

        new CreatedByUserField({
            columnName: "uploadedByUser",
            fkMember: "uploadedByUserId",
        }),
        new VisiblePermissionField({
            columnName: "visiblePermission",
            fkMember: "visiblePermissionId",
        }),

        new TagsField<FileTagAssignmentPayload>({
            columnName: "tags",
            associationForeignIDMember: "fileTagId",
            associationForeignObjectMember: "fileTag",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileTagAssignment",
            foreignTableID: "FileTag",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => {
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedUsers

        new TagsField<FileSongTag>({
            columnName: "taggedSongs",
            associationForeignIDMember: "songId",
            associationForeignObjectMember: "song",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileSongTag",
            foreignTableID: "Song",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedSongs

        new TagsField<FileEventTag>({
            columnName: "taggedEvents",
            associationForeignIDMember: "eventId",
            associationForeignObjectMember: "event",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileEventTag",
            foreignTableID: "Event",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedEvents

        new TagsField<FileInstrumentTag>({
            columnName: "taggedInstruments",
            associationForeignIDMember: "instrumentId",
            associationForeignObjectMember: "instrument",
            associationLocalIDMember: "fileId",
            associationLocalObjectMember: "file",
            associationTableID: "FileInstrumentTag",
            foreignTableID: "Instrument",
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
            getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
        }), // column: taggedInstruments
    ]

});



















// export const xTestFile = new db3.xTable({
//     tableName: "File",
//     tableUniqueName: "testFile",
//     editPermission: Permission.login,
//     viewPermission: Permission.login,
//     getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInclude => {
//         return FileArgs.include;
//     },
//     naturalOrderBy: FileNaturalOrderBy,
//     // softDeleteSpec: {
//     //     isDeletedColumnName: "isDeleted",
//     // },
//     // visibilitySpec: {
//     //     ownerUserIDColumnName: "uploadedByUserId",
//     //     visiblePermissionIDColumnName: "visiblePermissionId",
//     // },
//     getRowInfo: (row: FilePayload) => ({
//         name: row.fileLeafName,
//         description: row.description,
//     }),
//     columns: [
//         new PKField({ columnName: "id" }),
//         new BoolField({ columnName: "isDeleted", defaultValue: false }),
//         new CreatedByUserField({
//             columnName: "uploadedByUser",
//             fkMember: "uploadedByUserId",
//         }),
//         new VisiblePermissionField({
//             columnName: "visiblePermission",
//             fkMember: "visiblePermissionId",
//         }),
//         new TagsField<FileEventTag>({
//             columnName: "taggedEvents",
//             associationTableID: "testFileEventTag",
//             foreignTableID: "testEvent",
//             associationForeignIDMember: "eventId",
//             associationForeignObjectMember: "event",
//             associationLocalIDMember: "fileId",
//             associationLocalObjectMember: "file",
//             getQuickFilterWhereClause: (query: string) => false,
//             getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.FileWhereInput | boolean => false,
//         }), // column: taggedEvents
//     ]

// });


// export const xTestFileEventTag = new db3.xTable({
//     tableName: "FileEventTag",
//     tableUniqueName: "TestFileEventTag",
//     editPermission: Permission.login,
//     viewPermission: Permission.login,
//     naturalOrderBy: FileEventTagNaturalOrderBy,
//     getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileEventTagInclude => {
//         return FileEventTagArgs.include;
//     },
//     getRowInfo: (row: FileEventTagPayload) => {
//         return {
//             name: row.event.name,
//         };
//     },
//     columns: [
//         new PKField({ columnName: "id" }),
//         new ForeignSingleField<Prisma.EventGetPayload<{}>>({
//             columnName: "event",
//             fkMember: "eventId",
//             allowNull: false,
//             foreignTableID: "testEvent",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),
//         new ForeignSingleField<Prisma.FileGetPayload<{}>>({
//             columnName: "file",
//             fkMember: "fileId",
//             allowNull: false,
//             foreignTableID: "testFile",
//             getQuickFilterWhereClause: (query: string) => false,
//         }),
//     ]
// });



// export const TestEventArgs = Prisma.validator<Prisma.EventArgs>()({
//     include: {
//         visiblePermission: VisiblePermissionInclude,
//         fileTags: {
//             include: {
//                 file: true,
//             },
//         },
//     },
// });


// export const xTestEvent = new db3.xTable({
//     tableName: "event",
//     tableUniqueName: "testEvent",
//     editPermission: Permission.admin_general,
//     viewPermission: Permission.view_general_info,
//     getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.EventInclude => {
//         return TestEventArgs.include;
//     },
//     // softDeleteSpec: {
//     //     isDeletedColumnName: "isDeleted",
//     // },
//     // visibilitySpec: {
//     //     ownerUserIDColumnName: "createdByUserId",
//     //     visiblePermissionIDColumnName: "visiblePermissionId",
//     // },
//     getRowInfo: (row: EventPayloadClient) => ({
//         name: row.name,
//         description: row.description,
//         color: gGeneralPaletteList.findEntry(row.type?.color || null),
//     }),
//     columns: [
//         new PKField({ columnName: "id" }),
//         new TagsField<EventTaggedFilesPayload>({
//             columnName: "fileTags",
//             foreignTableID: "testFile",
//             associationTableID: "testFileEventTag",
//             associationForeignIDMember: "fileId",
//             associationForeignObjectMember: "file",
//             associationLocalIDMember: "eventId",
//             associationLocalObjectMember: "event",
//             getQuickFilterWhereClause: (query: string): Prisma.EventWhereInput | boolean => false,
//             getCustomFilterWhereClause: (query: db3.CMDBTableFilterModel): Prisma.EventWhereInput | boolean => false,
//         }), // tags
//     ]
// });

