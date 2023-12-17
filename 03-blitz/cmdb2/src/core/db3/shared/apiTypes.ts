
import { Prisma } from "db";

// types used by mutations and other blitzy-things which can't export more than 1 thing.

export interface Size {
    width: number;
    height: number;
}

export const SizeToString = (x: Size): string => {
    return `[${x.width.toFixed(0)} x ${x.height.toFixed(0)}]`;
}

export interface Coord2D {
    x: number;
    y: number;
};

export const Coord2DToString = (x: Coord2D): string => {
    return `(${x.x.toFixed(0)}, ${x.y.toFixed(0)})`;
}

export const MulSize = (a: Size, f: number): Size => {
    return {
        width: a.width * f,
        height: a.height * f,
    }
};

export const MulSizeBySize = (a: Size, f: Size): Size => {
    return {
        width: a.width * f.width,
        height: a.height * f.height,
    }
};

//
export const SubCoord2D = (begin: Coord2D, end: Coord2D): Size => {
    return {
        width: end.x - begin.x,
        height: end.y - begin.y,
    }
};
export const AddCoord2D = (a: Coord2D, b: Coord2D): Coord2D => {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
    }
};

export const AddCoord2DSize = (a: Coord2D, b: Size): Coord2D => {
    return {
        x: a.x + b.width,
        y: a.y + b.height,
    }
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
    expectedAttendanceUserTagId?: number;
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
// - adjusting scale doesn't require readjusting every trickle down value
// - if i change order of operations things should be less broken.
// - for galleryimagedisplayparams, it feels safer if the viewport changes shape/size.
// export interface ServerImageFileEditParams {
//     //scaleOrigin01: Coord2D; // of original dimensions.... never needed because these params are for a static file operation. the idea of scaling around a point means nothing. the dimensions change, no movement is done.
//     scale: number;// even this is a factor rather than pixels, to avoid having to know the original dimensions.
//     //cropBegin01: Coord2D; // top/left, of scaled dimensions
//     //cropEnd01: Coord2D;  // bottom/right of scaled dimensions.
// };

// export const MakeDefaultServerImageFileEditParams = (): ServerImageFileEditParams => ({
//     scale: 1,
//     cropBegin01: {
//         x: 0, y: 0,
//     },
//     cropEnd01: {
//         x: 1, y: 1,
//     },
// });

// export interface GalleryImageDisplayParams {
//     scaledSize: Size; // specify the size of the image, in pixels. for mocked-up images this is going to be physical file * scaling. for 
//     cropOffset01: Coord2D; // factor of scaledsize, specifies the offset used to place the object within scaledSize, accounting for cropping. generally this would be the same as ServerImageFileEditParams.cropBegin01.
//     // the image will be centered here.
//     rotationDegrees: number;
//     position01: Coord2D; // factor of scaled size
// };

// export const MakeDefaultGalleryImageDisplayParams = (): GalleryImageDisplayParams => ({
//     scaledSize: {
//         width: 10, height: 10,
//     },
//     cropOffset01: {
//         x: 0, y: 0,
//     },
//     rotationDegrees: 0,
//     position01: {
//         x: 0, y: 0,
//     },
// });

export interface ImageEditParams {
    cropBegin: Coord2D;
    cropSize: Size | null; // if null use image end bound.
    rotate: number;
};

export const MakeDefaultImageEditParams = (): ImageEditParams => ({
    cropBegin: { x: 0, y: 0 },
    cropSize: null,
    rotate: 0
    //scale: 1,
    // scaledSize: {
    //     width: 10, height: 10,
    // },
    // cropOffset01: {
    //     x: 0, y: 0,
    // },
    // rotationDegrees: 0,
    // position01: {
    //     x: 0, y: 0,
    // },
});

// // because of how this is used, returns all options filled with NOP values, rather than undefined..
// export const MakeDefaultForkImageParams = (parentFile: Prisma.FileGetPayload<{}>): ForkImageParams => ({
//     outputType: "png",
//     quality: 80,
//     parentFileLeaf: parentFile.storedLeafName,
//     editParams: MakeDefaultImageEditParams(),
// });

export interface ImageMetadata {
    width?: number | undefined;
    height?: number | undefined;
};

export interface FileCustomData {
    // each physical file gets its own File record, therefore this should explain what its relationship is to its parent / related file(s).
    // JSON of FileCustomData that will depend how i feel like using it based on mimetype. links to thumbnails, metadata, pdf series of thumbnails, whatev.
    relationToParent?: "thumbnail" | "forkedImage";
    forkedImage?: { // when relationToParent is forkedImage.
        creationEditParams: ImageEditParams, // the parameters that were used to generate this forked image.
    };
    imageMetadata?: ImageMetadata;
    audioMetadata?: {
        bitrate: string;
        lengthMillis?: number;
    };
};

export const MakeDefaultFileCustomData = (): FileCustomData => ({});

// always returns valid due to having createDefault
export const parsePayloadJSON = <T,>(value: null | undefined | string, createDefault: (val: null | undefined | string) => T, onError?: (e) => void): T => {
    if (value === null || value === undefined || (typeof value !== 'string') || value.trim() === "") {
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

export interface TupdateGenericSortOrderArgs {
    tableID: string;
    tableName: string;
    movingItemId: number; // pk of the item being moved
    newPositionItemId: number; // pk of the item this should replace.
};


export interface UploadResponsePayload {
    files: Prisma.FileGetPayload<{}>[];
    isSuccess: boolean;
    errorMessage?: string;
};

export const MakeErrorUploadResponsePayload = (errorMessage: string): UploadResponsePayload => ({
    files: [],
    isSuccess: false,
    errorMessage,
});


export interface ForkImageParams {
    parentFileId: number; // which image file to use. for gallery items it may be different than the previous one.
    outputType: ImageFileFormat;
    quality: number; // 0-100 corresponds with jpeg quality / https://sharp.pixelplumbing.com/api-output options.quality.
    editParams: ImageEditParams;
    newDimensions?: Size;
};

export interface UpdateGalleryItemImageParams {
    galleryItemId: number;
    imageParams: ForkImageParams;
};
