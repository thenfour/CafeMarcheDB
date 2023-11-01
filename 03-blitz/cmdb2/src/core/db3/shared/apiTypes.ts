
import { Prisma } from "db";

// types used by mutations and other blitzy-things which can't export more than 1 thing.

export interface Size {
    width: number;
    height: number;
}

export interface Coord2D {
    x: number;
    y: number;
};

// // immutable. without clean function overloading it's hard to implement this.
// export class CCoord2D implements Coord2D {
//     x: number;
//     y: number;
//     constructor(a?: Coord2D) {
//         if (!a) {
//             this.x = 0;
//             this.y = 0;
//             return;
//         }
//         this.x = a.x;
//         this.y = a.y;
//     }
//     add(n: number): CCoord2D {
//         return new CCoord2D({ x: this.x + n, y: this.y + n });
//     }
//     add(n: Coord2D): CCoord2D {
//         return new CCoord2D({ x: this.x + n.x, y: this.y + n.y });
//     }
//     mul(n: number): CCoord2D {
//         return new CCoord2D({ x: this.x * n, y: this.y * n });
//     }
// };

export interface TupdateUserEventSegmentAttendanceMutationArgs {
    userId: number;
    eventSegmentId: number;
    attendanceId?: null | number;
    comment?: string | null;
    instrumentId?: number | null;
};

export interface TupdateEventBasicFieldsArgs {
    eventId: number;
    name?: string;
    slug?: string;
    description?: string;
    typeId?: number;
    locationDescription?: string;
    locationURL?: string;
    isDeleted?: boolean;
    statusId?: number;
    visiblePermissionId?: number | null;
    createdByUserId?: number;

    frontpageVisible?: boolean;
    frontpageDate?: string;  // e.g. "Zaterdag 11 november"
    frontpageTime?: string; // e.g. 14u
    frontpageTitle?: string | null; // null = use normal one
    frontpageDetails?: string;
    frontpageLocation?: string | null; // null = use normal
    frontpageLocationURI?: string | null; // null = use normal
    frontpageTags?: string | null; // null, use normal
}

export interface TupdateUserPrimaryInstrumentMutationArgs {
    userId: number;
    instrumentId: number;
};

export interface TinsertEventCommentArgs {
    eventId: number;
    text: string;
    visiblePermissionId: number | null;
    // created by user id = current user always
    // created at, updated at = automatic
};

export interface TinsertEventArgs {
    event: {
        name: string,
        description: string,
        slug: string,
        typeId: number | null,
        statusId: number | null,
        tags: number[],
        visiblePermissionId: number | null;
    },
    segment: {
        startsAt: Date | null,
        durationMillis: number,
        isAllDay: boolean,
        name: string,
        description: string,
    }
}

export interface TupdateEventCommentArgs {
    id: number;
    text?: string;
    visiblePermissionId?: number | null;
    // cannot change:
    // - event id
    // - user id
    // - created at
    // updated at = automatic
};

export type TGeneralDeleteArgs = {
    id: number;
};

export interface TdeleteEventCommentArgs {
    id: number;
};




/*
model EventSongList {
  id          Int    @id @default(autoincrement())
  sortOrder   Int    @default(0)
  name        String
  description String @default("")
  createdByUserId     Int? // required in order to know visibility when visiblePermissionId is NULL
  visiblePermissionId Int? // which permission determines visibility, when NULL, only visible by admins + creator
  eventId Int
}

model EventSongListSong {
  id        Int     @id @default(autoincrement())
  subtitle  String? // could be a small comment like "short version"
  sortOrder Int     @default(0)
  songId Int
  eventSongListId Int
}
*/

export interface TinsertOrUpdateEventSongListSong {
    id?: number;
    // don't rely on array ordering because it's shuffled etc during the change plan computation
    sortOrder: number;
    songId: number;
    subtitle: string;
};

export interface TinsertOrUpdateEventSongListArgs {
    id?: number; // for insertion, this is not used / specified.
    name: string;
    description: string;
    visiblePermissionId: number | null;
    eventId: number;
    sortOrder: number;
    songs: TinsertOrUpdateEventSongListSong[];
};

// interface from upload.ts to mutation. files themselves contain much of the data; this is only for associations.
export interface TClientUploadFileArgs {
    taggedUserId?: number;
    taggedSongId?: number;
    taggedEventId?: number;
    taggedInstrumentId?: number;
    visiblePermissionId?: number;
};

export interface TClientUpdateFile {
    id?: number;
    fileLeafName?: string;
    description?: string;
    isDeleted?: boolean; // allow soft delete via mutation
    visiblePermissionId?: number | null;

    tagsIds?: number[];
    taggedUserIds?: number[];
    taggedSongIds?: number[];
    taggedEventIds?: number[];
    taggedInstrumentIds?: number[];
};



// window.CMconfig.posts ....
export interface HomepageGalleryItemSpec {
    descriptionMarkdown: string;
    uri: string;
};
export interface HomepageAgendaItemSpec {
    date?: string | null;
    time?: string | null;
    title?: string | null;
    detailsMarkdown?: string | null;
    location?: string | null;
    locationURI?: string | null;
    tags?: string | null;
};
export interface HomepageContentSpec {
    agenda: HomepageAgendaItemSpec[];
    gallery: HomepageGalleryItemSpec[];
};



// https://stackoverflow.com/questions/36836011/checking-validity-of-string-literal-union-type-at-runtime
export const ImageFileFormatOptions = {
    "png": {},
    "jpg": {},
    "heic": {},
    "webp": {},
} as const;

export type ImageFileFormat = keyof typeof ImageFileFormatOptions;


// reasons to use 01 coords rather than absolute pixels:
// - i can create defaults that are static and work for any image
// - if i change order of operations things should be less broken.
// - for galleryimagedisplayparams, it feels safer if the viewport changes shape/size.
export interface ServerImageFileEditParams {
    //scaleOrigin01: Coord2D; // of original dimensions.... never needed because these params are for a static file operation. the idea of scaling around a point means nothing. the dimensions change, no movement is done.
    scale: number;// even this is a factor rather than pixels, to avoid having to know the original dimensions.
    cropBegin01: Coord2D; // top/left, of scaled dimensions
    cropEnd01: Coord2D;  // bottom/right of scaled dimensions.
};

export const MakeDefaultServerImageFileEditParams = (): ServerImageFileEditParams => ({
    scale: 1,
    cropBegin01: {
        x: 0, y: 0,
    },
    cropEnd01: {
        x: 1, y: 1,
    },
});

export interface GalleryImageDisplayParams {
    // the image will be centered here.
    rotationDegrees: number;
    position01: Coord2D; // factor of scaled size
};

export const MakeDefaultGalleryImageDisplayParams = (): GalleryImageDisplayParams => ({
    rotationDegrees: 0,
    position01: {
        x: 0, y: 0,
    },
});


export interface ForkImageParams {
    parentFileLeaf: string;
    outputType: ImageFileFormat;
    editParams: ServerImageFileEditParams;
};


// because of how this is used, returns all options filled with NOP values, rather than undefined..
export const MakeDefaultForkImageParams = (parentFile: Prisma.FileGetPayload<{}>): ForkImageParams => ({
    outputType: "png",
    parentFileLeaf: parentFile.storedLeafName,
    editParams: MakeDefaultServerImageFileEditParams(),
});

export interface FileCustomData {
    // each physical file gets its own File record, therefore this should explain what its relationship is to its parent / related file(s).
    // JSON of FileCustomData that will depend how i feel like using it based on mimetype. links to thumbnails, metadata, pdf series of thumbnails, whatev.
    relationToParent?: "thumbnail" | "forkedImage";
    forkedImage?: { // when relationToParent is forkedImage.
        editParams: ServerImageFileEditParams,
    };
    imageMetadata?: {
        width?: number | undefined;
        height?: number | undefined;
    };
    audioMetadata?: {
        bitrate: string;
        lengthMillis?: number;
    };
};

export const MakeDefaultFileCustomData = (): FileCustomData => ({});


// always returns valid due to having createDefault
export const parsePayloadJSON = <T,>(value: null | undefined | string, createDefault: (val: null | undefined | string) => T, onError?: (e) => void): T => {
    if (value === null || value === undefined || (typeof value !== 'string')) {
        return createDefault(value);
    }
    try {
        return JSON.parse(value) as T;
    } catch (err) {
        if (onError) onError(err);
        console.log(err);
        return createDefault(value);
    }
};



// always returns valid
export const getFileCustomData = (f: Prisma.FileGetPayload<{}>): FileCustomData => {
    return parsePayloadJSON<FileCustomData>(f.customData, MakeDefaultFileCustomData, (e) => {
        console.log(`failed to parse file custom data for file id ${f.id}, storedLeafName:${f.storedLeafName}, mime:${f.mimeType}`);
    });
};

