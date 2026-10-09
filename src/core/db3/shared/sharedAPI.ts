// app apis which can be called from server or client code.
// it's useful to group things like this instead of freestanding functions

import { parsePayloadJSON } from "@/shared/rootroot";
import { Prisma } from "db";
import { Size } from "recharts/types/util/types";
import { gMinImageDimension } from "shared/utils";
import { getFileCustomData } from "./fileAPI";
import { ImageEditParams, MakeDefaultImageEditParams } from "./fileTypes";
import { PublicGalleryItemSpec } from "./publicTypes";
import type { FrontpageGalleryItemPublicId } from "shared/publicId";
import { resolveImageEditGeometry } from "./imageGeometry";


// db3.FilePayloadMinimum
type GetImageFileEditInfo_File = {
    storedLeafName: string;
    customData: string | null;
    // id?: number;
    // publicId?: string;
    mimeType: string | null;
};

type GetGalleryItemImageInfo_Item = {
    publicId: FrontpageGalleryItemPublicId;
    displayParams: string;
    file: GetImageFileEditInfo_File;
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class FilesSharedAPI {
    getURIForFile = (file: Prisma.FileGetPayload<{ select: { storedLeafName: true } }>) => {
        return `/api/files/download/${file.storedLeafName}`;
    }

    getImageFileDimensions = (file: GetImageFileEditInfo_File): Size | undefined => {
        const customData = getFileCustomData(file);

        if (customData.imageMetadata?.height != null && customData.imageMetadata?.width != null) {
            return {
                width: customData.imageMetadata!.width!,
                height: customData.imageMetadata!.height!,
            };
        }
        return undefined;
    };


    // if editParams is omitted, use the ones embedded in the post.
    getImageFileEditInfo = (file: GetImageFileEditInfo_File, editParams: ImageEditParams) => {
        const imageURI = this.getURIForFile(file);
        const fileDimensions = this.getImageFileDimensions(file) || { width: gMinImageDimension, height: gMinImageDimension };

        return { imageURI, ...resolveImageEditGeometry(fileDimensions, editParams) };
    }; // getGalleryItemImageInfo


    // always returns valid
    getGalleryItemDisplayParams = (f: {
        displayParams: string
    }): ImageEditParams => {
        const ret = parsePayloadJSON<ImageEditParams>(f.displayParams, MakeDefaultImageEditParams, (e) => {
            console.log(`failed to parse gallery item display params for gallery item`);
        });
        // validate since this is coming from db.
        if (!ret.cropBegin) ret.cropBegin = { x: 0, y: 0 };
        if (!ret.rotate) ret.rotate = 0;
        if (!ret.cropSize) ret.cropSize = null;
        return ret;
    };


    // if editParams is omitted, use the ones embedded in the post.
    getGalleryItemImageInfo = (post: GetGalleryItemImageInfo_Item, editParams?: ImageEditParams) => {
        return this.getImageFileEditInfo(post.file, editParams || this.getGalleryItemDisplayParams(post));
    }; // getGalleryItemImageInfo

    getPublicGalleryImageInfo = (item: PublicGalleryItemSpec) => {
        return {
            ...this.getImageFileEditInfo(item, this.getGalleryItemDisplayParams(item)),
            imageURI: item.imageFileUri
        };
    }
};

const gFilesSharedAPI = new FilesSharedAPI();

export const SharedAPI = {
    files: gFilesSharedAPI,
};
