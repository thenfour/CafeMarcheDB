
import db, { FileEventTag, FileInstrumentTag, FileSongTag, FileUserTag, Prisma } from "db";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, Date_MAX_VALUE, KeysOf, TAnyModel, assertIsNumberArray, gIconOptions } from "shared/utils";
import * as db3 from "../db3core";
import { ColorField, ConstEnumStringField, ForeignSingleField, GenericIntegerField, GenericStringField, BoolField, PKField, TagsField, DateTimeField, MakePlainTextField, MakeMarkdownTextField, MakeSortOrderField, MakeColorField, MakeSignificanceField, MakeIntegerField, MakeSlugField, MakeTitleField, MakeCreatedAtField, MakeIconField } from "../db3basicFields";
import { CreatedByUserField, VisiblePermissionField, xPermission, xUser } from "./user";
import { xSong } from "./song";
import { InstrumentArgs, InstrumentPayload, SongArgs, UserArgs, UserPayload, getUserPrimaryInstrument, xInstrument } from "./instrument";
import { xEvent } from "./event";



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

////////////////////////////////////////////////////////////////
const FileTagArgs = Prisma.validator<Prisma.FileTagArgs>()({
    include: {
        fileAssignments: true,
    }
});

export type FileTagPayload = Prisma.FileTagGetPayload<typeof FileTagArgs>;

export const FileTagNaturalOrderBy: Prisma.FileTagOrderByWithRelationInput[] = [
    { sortOrder: 'desc' },
    { text: 'asc' },
    { id: 'asc' },
];

export const FileTagSignificance = {
    Partition: "Partition",
    Invoice: "Invoice",
    Recording: "Recording",
    Video: "Video",
    Rider: "Rider",
    Email: "Email",
} as const satisfies Record<string, string>;

export const xFileTag = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagInclude => {
        return FileTagArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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



////////////////////////////////////////////////////////////////
export const FileTagAssignmentArgs = Prisma.validator<Prisma.FileTagAssignmentArgs>()({
    include: {
        file: true,
        fileTag: true,
    }
});
export type FileTagAssignmentPayload = Prisma.FileTagAssignmentGetPayload<typeof FileTagAssignmentArgs>;


const FileTagAssignmentNaturalOrderBy: Prisma.FileTagAssignmentOrderByWithRelationInput[] = [
    { fileTag: { sortOrder: 'desc' } },
    { fileTag: { text: 'asc' } },
    { fileTag: { id: 'asc' } },
];
export const xFileTagAssignment = new db3.xTable({
    tableName: "FileTagAssignment",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileTagAssignmentNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileTagAssignmentInclude => {
        return FileTagAssignmentArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            foreignTableSpec: xFileTag,
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

////////////////////////////////////////////////////////////////
export const FileUserTagArgs = Prisma.validator<Prisma.FileUserTagArgs>()({
    include: {
        file: true,
        user: true,
    }
});
export type FileUserTagPayload = Prisma.FileUserTagGetPayload<typeof FileUserTagArgs>;

const FileUserTagNaturalOrderBy: Prisma.FileUserTagOrderByWithRelationInput[] = [
    { user: { name: 'asc' } },
    { user: { id: 'asc' } },
];
export const xFileUserTag = new db3.xTable({
    tableName: "FileUserTag",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileUserTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileUserTagInclude => {
        return FileUserTagArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            foreignTableSpec: xUser,
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

////////////////////////////////////////////////////////////////
export const FileSongTagArgs = Prisma.validator<Prisma.FileSongTagArgs>()({
    include: {
        file: true,
        song: true,
    }
});
export type FileSongTagPayload = Prisma.FileSongTagGetPayload<typeof FileSongTagArgs>;

const FileSongTagNaturalOrderBy: Prisma.FileSongTagOrderByWithRelationInput[] = [
    { song: { name: 'asc' } },
    { song: { id: 'asc' } },
];
export const xFileSongTag = new db3.xTable({
    tableName: "FileSongTag",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileSongTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileSongTagInclude => {
        return FileSongTagArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            foreignTableSpec: xSong,
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

////////////////////////////////////////////////////////////////
export const FileEventTagArgs = Prisma.validator<Prisma.FileEventTagArgs>()({
    include: {
        file: true,
        event: true,
    }
});
export type FileEventTagPayload = Prisma.FileEventTagGetPayload<typeof FileEventTagArgs>;

const FileEventTagNaturalOrderBy: Prisma.FileEventTagOrderByWithRelationInput[] = [
    { event: { name: 'asc' } },
    { event: { id: 'asc' } },
];
export const xFileEventTag = new db3.xTable({
    tableName: "FileEventTag",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileEventTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileEventTagInclude => {
        return FileEventTagArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    getRowInfo: (row: FileEventTagPayload) => {
        return {
            name: row.event.name,
        };
    },
    columns: [
        new PKField({ columnName: "id" }),
        new ForeignSingleField<Prisma.FileEventTagGetPayload<{}>>({
            columnName: "event",
            fkMember: "eventId",
            allowNull: false,
            foreignTableSpec: xEvent,
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
export const FileInstrumentTagArgs = Prisma.validator<Prisma.FileInstrumentTagArgs>()({
    include: {
        file: true,
        instrument: true,
    }
});
export type FileInstrumentTagPayload = Prisma.FileInstrumentTagGetPayload<typeof FileInstrumentTagArgs>;

const FileInstrumentTagNaturalOrderBy: Prisma.FileInstrumentTagOrderByWithRelationInput[] = [
    { instrument: { name: 'asc' } },
    { instrument: { id: 'asc' } },
];
export const xFileInstrumentTag = new db3.xTable({
    tableName: "FileInstrumentTag",
    editPermission: Permission.login,
    viewPermission: Permission.login,
    naturalOrderBy: FileInstrumentTagNaturalOrderBy,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInstrumentTagInclude => {
        return FileInstrumentTagArgs.include;
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
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
            foreignTableSpec: xInstrument,
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
export const FileArgs = Prisma.validator<Prisma.FileArgs>()({
    include: {
        visiblePermission: {
            include: {
                roles: true
            }
        },
        uploadedByUser: true,

        tags: FileTagAssignmentArgs,
        taggedUsers: FileUserTagArgs,
        taggedSongs: FileSongTagArgs,
        taggedEvents: FileEventTagArgs,
        taggedInstruments: FileInstrumentTagArgs,
    }
});

export type FilePayload = Prisma.FileGetPayload<typeof FileArgs>;

// order by functional group, then by File.
export const FileNaturalOrderBy: Prisma.FileOrderByWithRelationInput[] = [
];

export interface xFileFilterParams {
    fileId?: number;
    fileTagIds: number[];
};

export const xFile = new db3.xTable({
    editPermission: Permission.admin_general,
    viewPermission: Permission.view_general_info,
    getInclude: (clientIntention: db3.xTableClientUsageContext): Prisma.FileInclude => {
        return FileArgs.include;
    },
    applyIncludeFilteringForExtraColumns: (include: TAnyModel, clientIntention: db3.xTableClientUsageContext) => {
        // db3.ApplyIncludeFilteringToRelation(include, "tags", "event", xEventTagAssignment, clientIntention);
        // db3.ApplyIncludeFilteringToRelation(include, "comments", "event", xEventComment, clientIntention);
        // db3.ApplyIncludeFilteringToRelation(include, "segments", "event", xEventSegment, clientIntention);
        // db3.ApplyIncludeFilteringToRelation(include, "songLists", "event", xEventSongList, clientIntention);
    },
    applyExtraColumnsToNewObject: (obj: TAnyModel, clientIntention: db3.xTableClientUsageContext) => { },
    tableName: "File",
    naturalOrderBy: FileNaturalOrderBy,
    getParameterizedWhereClause: (params: xFileFilterParams, clientIntention: db3.xTableClientUsageContext): (Prisma.FileWhereInput[]) => {
        const ret: Prisma.FileWhereInput[] = [];

        console.assert(clientIntention.currentUser?.id !== undefined);
        console.assert(clientIntention.currentUser?.role?.permissions !== undefined);

        if (params.fileId !== undefined) {
            ret.push({ id: params.fileId, });
        }

        if (clientIntention.intention === "user") {
            // apply soft delete
            ret.push({ isDeleted: { equals: false } });
        }

        db3.ApplySoftDeleteWhereClause(ret, clientIntention);
        db3.ApplyVisibilityWhereClause(ret, clientIntention, "createdByUserId");
        return ret;
    },
    getRowInfo: (row: FilePayload) => ({
        name: row.fileLeafName,
        description: row.description,
    }),
    columns: [
        new PKField({ columnName: "id" }),
        MakeTitleField("fileLeafName"),
        new GenericStringField({
            columnName: "storedLeafName",
            allowNull: false,
            format: "plain",
        }),
        new GenericStringField({
            columnName: "description",
            allowNull: false,
            format: "markdown",
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
            associationTableSpec: xFileTagAssignment,
            foreignTableSpec: xFileTag,
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
            associationTableSpec: xFileUserTag,
            foreignTableSpec: xUser,
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
            associationTableSpec: xFileSongTag,
            foreignTableSpec: xSong,
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
            associationTableSpec: xFileEventTag,
            foreignTableSpec: xEvent,
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
            associationTableSpec: xFileInstrumentTag,
            foreignTableSpec: xInstrument,
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






