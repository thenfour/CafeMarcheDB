import type { Coord2D, Size } from "shared/rootroot";
import { gMinImageDimension } from "shared/utils";
import type { ImageEditParams } from "./fileTypes";

function cropAxis(bound: number, begin: number, size: number): { begin: number; size: number } {
    // The editor's minimum crop must also fit images smaller than ten pixels.
    const minimum = Math.min(gMinImageDimension, bound);
    const clampedBegin = Math.min(bound - minimum, Math.max(0, begin));
    return { begin: clampedBegin, size: Math.min(bound - clampedBegin, Math.max(minimum, begin + size - clampedBegin)) };
}

/** Shared by the editor preview and the decoder-backed image transform. */
export function resolveImageEditGeometry(fileDimensions: Size, editParams: ImageEditParams) {
    const requestedSize = editParams.cropSize ?? fileDimensions;
    const horizontal = cropAxis(fileDimensions.width, editParams.cropBegin.x, requestedSize.width);
    const vertical = cropAxis(fileDimensions.height, editParams.cropBegin.y, requestedSize.height);
    const cropBegin: Coord2D = { x: horizontal.begin, y: vertical.begin };
    const cropSize: Size = { width: horizontal.size, height: vertical.size };
    const cropEnd: Coord2D = { x: cropBegin.x + cropSize.width, y: cropBegin.y + cropSize.height };
    return {
        fileDimensions, displayParams: { ...editParams }, cropBegin, cropSize, cropEnd,
        cropCenter: { x: (cropBegin.x + cropEnd.x) / 2, y: (cropBegin.y + cropEnd.y) / 2 },
        rotate: editParams.rotate,
        maskTopHeight: cropBegin.y, maskBottomHeight: fileDimensions.height - cropEnd.y,
        maskLeftWidth: cropBegin.x, maskRightWidth: fileDimensions.width - cropEnd.x,
    };
}
