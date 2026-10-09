import type { Coord2D, Size } from "shared/rootroot";
import { MulSize } from "shared/rootroot";
import type { ImageEditParams } from "./fileTypes";
import { resolveImageEditGeometry } from "./imageGeometry";

export type ImageEditorTool = "CropBegin" | "CropEnd" | "Move" | "Scale" | "Rotate";

/** Preserve the reference joystick's move, crop, scale and angle semantics. */
export function applyGalleryImageDrag(dimensions: Size, params: ImageEditParams, tool: ImageEditorTool, delta: Coord2D): ImageEditParams {
    const info = resolveImageEditGeometry(dimensions, params);
    const cropSize = { ...(params.cropSize ?? info.cropSize) };
    switch (tool) {
        case "Move":
            return {
                ...params,
                cropBegin: {
                    x: params.cropBegin.x - delta.x,
                    y: params.cropBegin.y - delta.y
                }
            };
        case "CropBegin":
            return {
                ...params,
                cropBegin: {
                    x: params.cropBegin.x + delta.x,
                    y: params.cropBegin.y + delta.y
                },
                cropSize: {
                    width: Math.max(1, cropSize.width - delta.x),
                    height: Math.max(1, cropSize.height - delta.y)
                }
            };
        case "CropEnd":
            return {
                ...params, cropSize: {
                    width: Math.max(1, cropSize.width + delta.x),
                    height: Math.max(1, cropSize.height + delta.y)
                }
            };
        case "Rotate":
            return {
                ...params,
                rotate: params.rotate + 0.02 * (delta.x - delta.y)
            };
        case "Scale": {
            const change = MulSize(info.cropSize, (delta.x + delta.y) * -0.001);
            return {
                ...params,
                cropBegin: {
                    x: info.cropBegin.x - change.width,
                    y: info.cropBegin.y - change.height
                },
                cropSize: {
                    width: Math.max(1, info.cropSize.width + change.width * 2),
                    height: Math.max(1, info.cropSize.height + change.height * 2)
                }
            };
        }
    }
}
