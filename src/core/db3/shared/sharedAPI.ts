// internal APIs which can be called from server code.

import { Prisma } from "db";
import { Clamp, concatenateUrlParts, gMinImageDimension } from "shared/utils";
import * as db3 from "@db3/db3";
import { PublicGalleryItemSpec } from "./publicTypes";
import { Size } from "recharts/types/util/types";
import { ImageEditParams, MakeDefaultImageEditParams } from "./fileTypes";
import { AddCoord2DSize, Coord2D, parsePayloadJSON } from "@/shared/rootroot";
import { getFileCustomData } from "./fileAPI";


// db3.FilePayloadMinimum
type GetImageFileEditInfo_File = {
    storedLeafName: string;
    customData: string | null;
    id: number;
    mimeType: string | null;
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

        //const displayParams = editParams || db3.getGalleryItemDisplayParams(post);

        const cropBegin: Coord2D = { ...editParams.cropBegin };

        const cropSize: Size = editParams.cropSize ? { ...editParams.cropSize } : { ...fileDimensions };
        // crop size needs to be adjusted if we clamped cropbegin.
        if (cropBegin.x < 0) {
            cropSize.width += editParams.cropBegin.x;
            cropBegin.x = 0;
        }
        if (cropBegin.y < 0) {
            cropSize.height += editParams.cropBegin.y;
            cropBegin.y = 0;
        }
        const cropMax: Coord2D = {
            x: fileDimensions.width - gMinImageDimension,
            y: fileDimensions.height - gMinImageDimension,
        }
        if (cropBegin.x > cropMax.x) {
            cropSize.width -= cropMax.x - cropBegin.x;
            cropBegin.x = cropMax.x;
        }
        if (cropBegin.y > cropMax.y) {
            cropSize.height -= cropMax.y - cropBegin.y;
            cropBegin.y = cropMax.y;
        }

        // if the cropsize would put cropend beyond the image, clamp it.
        cropSize.width = Clamp(cropSize.width, gMinImageDimension, fileDimensions.width - cropBegin.x);
        cropSize.height = Clamp(cropSize.height, gMinImageDimension, fileDimensions.height - cropBegin.y);
        const cropEnd = AddCoord2DSize(cropBegin, cropSize);
        const cropCenter: Coord2D = {
            x: (cropBegin.x + cropEnd.x) / 2,
            y: (cropBegin.y + cropEnd.y) / 2,
        };

        const rotate = editParams.rotate;

        const maskTopHeight = cropBegin.y;
        const maskBottomHeight = fileDimensions.height - cropEnd.y;
        const maskRightWidth = fileDimensions.width - cropEnd.x;
        const maskLeftWidth = cropBegin.x;

        return {
            imageURI,
            fileDimensions, // raw
            displayParams: { ...editParams }, // as passed in
            cropBegin, // clamped / sanitized
            cropEnd,// clamped / sanitized
            cropCenter,// clamped / sanitized
            cropSize,// coalesced / clamped / sanitized
            rotate,
            maskTopHeight, // some precalcs for mask display
            maskBottomHeight,
            maskRightWidth,
            maskLeftWidth,
        };
    }; // getGalleryItemImageInfo


    // always returns valid
    getGalleryItemDisplayParams = (f: Prisma.FrontpageGalleryItemGetPayload<{ select: { displayParams: true, id: true } }>): ImageEditParams => {
        const ret = parsePayloadJSON<ImageEditParams>(f.displayParams, MakeDefaultImageEditParams, (e) => {
            console.log(`failed to parse gallery item display params for gallery item id ${f.id}, val:${f.displayParams}`);
        });
        // validate since this is coming from db.
        if (!ret.cropBegin) ret.cropBegin = { x: 0, y: 0 };
        if (!ret.rotate) ret.rotate = 0;
        if (!ret.cropSize) ret.cropSize = null;
        return ret;
    };


    // if editParams is omitted, use the ones embedded in the post.
    getGalleryItemImageInfo = (post: db3.FrontpageGalleryItemPayload, editParams?: ImageEditParams) => {
        return this.getImageFileEditInfo(post.file, editParams || this.getGalleryItemDisplayParams(post));
    }; // getGalleryItemImageInfo

    getPublicGalleryImageInfo = (item: PublicGalleryItemSpec) => {
        return this.getImageFileEditInfo(item, this.getGalleryItemDisplayParams(item));
    }
};

const gFilesSharedAPI = new FilesSharedAPI();

export const SharedAPI = {
    files: gFilesSharedAPI,

    // clients cannot access process.env. For client-side, use the routing API on the dashboardContext.
    serverGetAbsoluteUri: (relativePath: string) => {
        return concatenateUrlParts(process.env.CMDB_BASE_URL!, relativePath);
    },

};
