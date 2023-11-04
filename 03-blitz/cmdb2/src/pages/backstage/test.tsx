/*

[SERVER EDITS:] (original size)
- scale (x) -> (scaled size)
- crop 01 of scaled (cropped size)

then the file gets baked in, and <GalleryImage> presents itself the same way as <FakeGalleryImage> by presenting in uncropped dimensions.

[GALLERY TRANSFORMS:] - these don't need to be precise 01 coordinates because it's all CSS; no translation between systems needs to be done.
- rotate (deg)
- position01 px - goes after rotate for a more pleasant ux.

why is this so freakin specialized? why doesn't it work just like normal editors?
1. i want this to be more mobile-friendly, so less modifiers like shift+ etc.
2. you actually need control over which operations are done on the server and client.
3. i don't want to make a detailed sophisticated UI with drag handles and stuff. hence the odd cropping experience.
4. editing is not a generic list of operations, it's fixed and therefore the workflow is a bit fixed.

why does <FakeGalleryImage> present itself with full uncropped dimensions?
because it's a very jolting UX when, by cropping (and thus changing presented dimensions), the image is moving all over the place.
could be compensated but it's not very simple or easy, and makes the whole edit system more complex.
cropping is meant to be somtehing after you have positioned the image, it should not change positioning.

<control container wrapper> - can add things like padding/margin.
    <control container> - required to have no margin etc and serve as the relative positioning box.
        <cropped image container> - acts like a processed image, so this object gets transformed using live gallery params (position + rotation). size is equal to post-crop and resize.
            <cropped image> - size is the original image * resize factor, then positioned based on cropping.
            <cropped mask> - size is original image; borders are the cropped areas.

            */

import { BlitzPage } from "@blitzjs/next";
import { Suspense } from "react";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as DB3Client from "src/core/db3/DB3Client";
import { Button, Tooltip } from "@mui/material";
import { Clamp, formatFileSize } from "shared/utils";
import { JoystickDiv } from "src/core/components/CMCoreComponents";
import { API, HomepageContentSpec } from "src/core/db3/clientAPI"; // this line causes an exception . uh oh some circular reference.
import * as db3 from "src/core/db3/db3";
import { Coord2D, GalleryImageDisplayParams, MakeDefaultGalleryImageDisplayParams, MakeDefaultServerImageFileEditParams, MulSize, MulSizeBySize, ServerImageFileEditParams, Size, SubCoord2D, getFileCustomData } from "src/core/db3/shared/apiTypes";
import { HomepageMain } from "src/core/components/homepageComponents";
import { nanoid } from 'nanoid';

// returns a valid ForkImageParams
const getCropParamsForFile = (f: db3.FilePayloadMinimum): ServerImageFileEditParams => {
    const customData = getFileCustomData(f);
    return customData.forkedImage?.editParams || MakeDefaultServerImageFileEditParams();
};

const getImageFileDimensions = (file: db3.FilePayloadMinimum): Size => {
    const customData = getFileCustomData(file);
    if (customData.imageMetadata?.height != null && customData.imageMetadata?.width != null) {
        return {
            width: customData.imageMetadata!.width!,
            height: customData.imageMetadata!.height!,
        };
    }
    return { width: 10, height: 10 };
};



// when you know that the server params are correct, then correct the gallery params.
const correctGalleryParams = (gi: db3.FrontpageGalleryItemPayload, mutableGp: GalleryImageDisplayParams, fp: ServerImageFileEditParams) => {
    // assumes the file dimensions are pre-server-effects.
    const fileDimensions = getImageFileDimensions(gi.file)
    mutableGp.cropOffset01 = { ...fp.cropBegin01 };
    mutableGp.scaledSize = MulSize(fileDimensions, fp.scale);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// represents the image as it's coming from the server. therefore does not apply final rotate/positioning.
// parameterized for editing.
interface FakeGalleryImageProps {
    // do not use the edit params from this, because they are the params that were used to create this image. not params to apply to this image.
    // we do however need the image dimensions.
    galleryItem: db3.FrontpageGalleryItemPayload;

    //imageSize: Size; // the gallery item file URI dimensions.
    fileParams: ServerImageFileEditParams; // 
    style?: React.CSSProperties;
};

const FakeGalleryImage = ({ fileParams, ...props }: FakeGalleryImageProps) => {
    const uri = API.files.getURIForFile(props.galleryItem.file);
    //const customData = getFileCustomData(props.galleryItem.file);
    const fileDimensions = getImageFileDimensions(props.galleryItem.file)
    //const imageSize = db3.getGalleryImageDisplayParams(props.galleryItem).scaledSize;
    const scaledSize = MulSize(fileDimensions, fileParams.scale);

    // offset, in post-scaled (screen) pixels, to offset the image to simulate crop
    // we don't need to compensate for crop, because the f act that we're already using the original image does it automatically.
    // we do a theoretical shift RIGHT to crop,
    // but because this is a mockup, we shift LEFT back to compensate for the crop.
    // const cropCompensation: Coord2D = {
    //     x: -scaledSize.width * fileParams.cropBegin01.x,
    //     y: -scaledSize.height * fileParams.cropBegin01.y,
    // };

    // this is the size of the image we imagine the server would return to us. the size of this component.
    const mockImageDimensions: Size = MulSizeBySize(scaledSize, SubCoord2D(fileParams.cropEnd01, fileParams.cropBegin01))
    const scaleTx = `scale(${fileParams.scale})`;
    //const cropCompTx = `translate(${cropCompensation.x}px, ${cropCompensation.y}px)`;

    const commonStyle: React.CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)

        // transforms...
        width: `${fileDimensions.width}px`, // css transform works AFTER width/height, so this should be the original dimensions.
        height: `${fileDimensions.height}px`,
        transformOrigin: `0 0`, // because the resulting image should be like an image file from 0,0, the scale origin should be about 0,0
    }

    const maskStyle: React.CSSProperties = {
        zIndex: 3,
        backgroundColor: "transparent",

        // transform is *applied to the border* so these need to be original dimensions not scaled.
        boxSizing: "border-box",
        borderLeft: `${fileDimensions.width * fileParams.cropBegin01.x}px solid var(--crop-mask-color)`,
        borderTop: `${fileDimensions.height * fileParams.cropBegin01.y}px solid var(--crop-mask-color)`,
        borderRight: `${fileDimensions.width * (1 - fileParams.cropEnd01.x)}px solid var(--crop-mask-color)`,
        borderBottom: `${fileDimensions.height * (1 - fileParams.cropEnd01.y)}px solid var(--crop-mask-color)`,
        transform: `${scaleTx}`,
        ...commonStyle,
    }

    const imageStyle: React.CSSProperties = {
        zIndex: 2,
        backgroundImage: `url(${uri})`,
        //transform: `${cropCompTx} ${scaleTx}`,
        transform: `${scaleTx}`,
        ...commonStyle,
        //border: `20px dashed green`,
    }

    const containerStyle: React.CSSProperties = {
        width: `${mockImageDimensions.width}px`,
        height: `${mockImageDimensions.height}px`,
        //border: `3px dashed blue`,
        position: "relative",
    };

    return <div className="ImageEditor cropMockupContainer" style={{ ...containerStyle, ...props.style }}>
        <div className="ImageEditor cropMockup Image" style={imageStyle}></div>
        <div className="ImageEditor cropMockup Mask" style={maskStyle}></div>
    </div >;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// represents the image as it's coming from the server. therefore does not apply final rotate/positioning.
// parameterized for editing.
interface RealGalleryImageProps {
    // do not use the edit params from this, because they are the params that were used to create this image. not params to apply to this image.
    // we do however need the image dimensions.
    galleryItem: db3.FrontpageGalleryItemPayload;

    //imageSize: Size; // the gallery item file URI dimensions.
    //fileParams: ServerImageFileEditParams; // 
    style?: React.CSSProperties;
};

const RealGalleryImage = (props: RealGalleryImageProps) => {
    const uri = API.files.getURIForFile(props.galleryItem.file);
    //const customData = getFileCustomData(props.galleryItem.file);
    const fileDimensions = getImageFileDimensions(props.galleryItem.file)
    //const imageSize = db3.getGalleryImageDisplayParams(props.galleryItem).scaledSize;
    //const scaledSize = MulSize(fileDimensions, fileParams.scale);

    // this is the size of the image we imagine the server would return to us. the size of this component.
    //const mockImageDimensions: Size = MulSizeBySize(scaledSize, SubCoord2D(fileParams.cropEnd01, fileParams.cropBegin01))
    //const scaleTx = `scale(${fileParams.scale})`;
    //const cropCompTx = `translate(${cropCompensation.x}px, ${cropCompensation.y}px)`;

    const commonStyle: React.CSSProperties = {
        position: "absolute",
        left: 0,
        top: 0,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)

        // transforms...
        width: `${fileDimensions.width}px`, // css transform works AFTER width/height, so this should be the original dimensions.
        height: `${fileDimensions.height}px`,
        //transformOrigin: `0 0`, // because the resulting image should be like an image file from 0,0, the scale origin should be about 0,0
    }

    const imageStyle: React.CSSProperties = {
        zIndex: 2,
        backgroundImage: `url(${uri})`,
        //transform: `${cropCompTx} ${scaleTx}`,
        //transform: `${scaleTx}`,
        ...commonStyle,
        //border: `20px dashed green`,
    }

    const containerStyle: React.CSSProperties = {
        width: `${fileDimensions.width}px`,
        height: `${fileDimensions.height}px`,
        //border: `3px dashed blue`,
        position: "relative",
    };

    return <div className="ImageEditor cropMockupContainer" style={{ ...containerStyle, ...props.style }}>
        <div className="ImageEditor cropMockup Image" style={imageStyle}></div>
    </div >;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface CalcGalleryImageTransformArgs {
    viewportSize: Size;
    galleryParams: GalleryImageDisplayParams;
};

const CalcGalleryImageTransform = (args: CalcGalleryImageTransformArgs) => {
    const scaledSize = args.galleryParams.scaledSize;
    const centerImage = `translate(${(args.viewportSize.width - scaledSize.width) * .5}px, ${(args.viewportSize.height - scaledSize.height) * .5}px)`;
    const galleryRotate = `rotate(${args.galleryParams.rotationDegrees}deg)`;
    const galleryTranslatePos = `translate(${args.galleryParams.position01.x * scaledSize.width}px, ${args.galleryParams.position01.y * scaledSize.height}px)`;
    return `${galleryTranslatePos} ${galleryRotate} ${centerImage}`;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface GalleryImageFrameProps {
    galleryItem: db3.FrontpageGalleryItemPayload; // do not use the edit params from this, because they are the params that were used to create this image. not params to apply to this image.
    //imageSize: Size; // the gallery item file URI dimensions.
    fileParams?: ServerImageFileEditParams | null; // if null, this is a "real" image and not a faked one.
    galleryParams: GalleryImageDisplayParams;

    size: Size; // size of this (viewport)
    maskSize: number; // size of a mask around the viewport.

    //style?: React.CSSProperties;
};

/*

   +----------------------+----------------------+
   | 1. parent file       |  2. scaled           |
   |                      |                      |
   |                      |                      |
   |                +------------------+         |
   |                |     |            |         |
   +----------------|-----+            |         |
   |                |                  |         |
   |                | 3. scaled+cropped|         |
   |                |                  |         |
   |                +------------------+         |
   |                                             |
   +---------------------------------------------+

    for mockups, the physical file is the parent file, and dimensions get calculated from that. the "mocked up" file is the 3. scaled+cropped.
    for real processed images, the physical file is 3.cropped.

    the image frame is the SCALED view, so the physical file needs to be positioned according to its cropping.

    the point is that the physical file dimensions can't be known without also knowing it's fake or not.
    or, we use params which account for this?

    bleh that's dumb and adds complexity.....

    can parent containers operate without knowing image dimensions? i guess no they can't, for example centering.
    so can we bubble up dimensions? in practice the gallery item spec should ALWAYS contain this info.


*/
// applies client-side ("gallery") transformations to the underlying image.
// this component should avoid knowing anything about whether the child image is faked or real.
// the difference is where data comes from to calculate dimensions.
// FILEParams should never be used here; it's used for live editing. they won't be known for "real" scenarios.
//                     REAL           MOCK
// file dimensions     file           file*scale
// cropBegin01         galleryParams  fileparams
// scaled size         galleryParams  fileparams
const GalleryImageFrame = (props: GalleryImageFrameProps) => {
    //const cropOffset01 = props.galleryParams.cropOffset01;
    const scaledSize = props.galleryParams.scaledSize;

    const mainStyle: React.CSSProperties = {
        position: "relative",
        width: `100%`,
        height: `100%`,
        backgroundColor: "#f0f",
        //border: `${props.maskSize}px solid var(--frame-mask-color)`,
        boxSizing: "content-box",
        zIndex: 6,
        touchAction: "none",
        pointerEvents: "none",
    };

    const maskStyle: React.CSSProperties = {
        position: "absolute",
        top: 0,
        left: 0,
        width: `100%`,
        height: `100%`,
        border: `${props.maskSize}px solid var(--frame-mask-color)`,
        boxSizing: "border-box",
        zIndex: 5,
        touchAction: "none",
        pointerEvents: "none",
    };

    const gridStyle: React.CSSProperties & Record<string, string> = {
        position: "absolute",
        top: "0",
        left: "0",
        width: `100%`,
        height: `100%`,
        border: `${props.maskSize}px solid transparent`,
        boxSizing: "border-box",
        zIndex: "7",
        touchAction: "none",
        pointerEvents: "none",
        "--grid-size-x": `${props.size.width / 3}px`,
        "--grid-size-y": `${props.size.height / 3}px`,
    };

    //const halfViewportTranslateNEG = `translate(${props.size.width * -.5}px, ${props.size.height * -.5}px)`;
    // //const halfViewportTranslatePOS = `translate(${props.size.width * .5}px, ${props.size.height * .5}px)`;
    // const centerImage = `translate(${(props.size.width - scaledSize.width) * .5}px, ${(props.size.height - scaledSize.height) * .5}px)`;
    // const galleryRotate = `rotate(${props.galleryParams.rotationDegrees}deg)`;
    // const galleryTranslatePos = `translate(${props.galleryParams.position01.x * scaledSize.width}px, ${props.galleryParams.position01.y * scaledSize.height}px)`;

    const imageWrapperStyle: React.CSSProperties = {
        width: `${props.size.width + props.maskSize * 2}px`,
        height: `${props.size.height + props.maskSize * 2}px`,
        touchAction: "none",
        userSelect: "none",
        border: `${props.maskSize}px solid transparent`,
        position: "relative",
        //overflow: "hidden",
        boxSizing: "border-box",
        //boxSizing: "content-box", // we're setting width & height; let the border not interfere with the dimensions.
        //transformOrigin: `50% 50%`,//${viewportSize.width * 0.5}px ${viewportSize.height * 0.5}px`,
        //transformOrigin: `${props.size.width * 0.5 + props.maskSize}px ${props.size.height * 0.5 + + props.maskSize}px`,
        //transformOrigin: `0 0`,
        //transform: `${galleryTranslatePos} ${halfViewportTranslateNEG} ${galleryRotate} ${halfViewportTranslatePOS} ${centerToUL}`,
        transform: CalcGalleryImageTransform({ galleryParams: props.galleryParams, viewportSize: props.size }),// `${galleryTranslatePos} ${galleryRotate} ${centerImage}`,
        //transform: `${galleryTranslatePos}  ${galleryRotate}`,
    };

    return <div className="galleryImage serverFileWithMaskContainer" style={mainStyle}>
        <div className="galleryImage serverFileMask" style={maskStyle}></div>
        <div className="galleryImage serverFileGrid dashed-grid-paper" style={gridStyle}></div>
        <div className="galleryImage serverFileWrapper" style={imageWrapperStyle}>
            {!!props.fileParams ? (
                <FakeGalleryImage fileParams={props.fileParams} galleryItem={props.galleryItem} />
            ) : (
                <RealGalleryImage galleryItem={props.galleryItem} />
            )}
        </div>
    </div>;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// take an existing file record, allow editing and forking.
// a parent control should also account for re-editing. So if you choose to "EDIT" a file that has a parent, better to traverse
// up and edit from the original. its crop params are specified in its customData field so it can be re-processed.
type SelectedTool = "CropSize" | "CropMove" | "Scale" | "Rotate" | "Move" | "WindowSize" | "MaskSize";

interface ImageEditorProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
    fileParams: ServerImageFileEditParams;
    galleryParams: GalleryImageDisplayParams;
    onFileParamsChange: (params: ServerImageFileEditParams) => void;
    onGalleryParamsChange: (params: GalleryImageDisplayParams) => void;
    onReset: () => void;
};

const ImageEditor = (props: ImageEditorProps) => {
    const [viewportSize, setViewportSize] = React.useState<Size>({ width: 600, height: 500 });
    const [viewportMaskSize, setViewportMaskSize] = React.useState<number>(100);
    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const [cropSize01, setCropSize01] = React.useState<{ factor: number }>({ factor: 1.05 }); // use an object so we can easier trigger the react effect.
    const [cropMove01, setCropMove01] = React.useState<Coord2D>({ x: 0, y: 0 });
    const fileDimensions = getImageFileDimensions(props.galleryItem.file)

    const handleFork = () => {
        // perform fork mutation
        // then, update gallery record
        // then, reset params.
    };

    React.useEffect(() => {
        // viewport-sized crop area so just take the proportion to scaled.
        const scaledSize = props.galleryParams.scaledSize;
        const cropSizeOfScaled: Size = {
            width: (viewportSize.width / scaledSize.width) * cropSize01.factor,
            height: (viewportSize.height / scaledSize.height) * cropSize01.factor,
        };

        // and center it over the center+offset
        let cropBegin01: Coord2D = {
            x: .5 - props.galleryParams.position01.x - (cropSizeOfScaled.width / 2) + cropMove01.x,
            y: .5 - props.galleryParams.position01.y - (cropSizeOfScaled.height / 2) + cropMove01.y,
        };
        let cropEnd01: Coord2D = {
            x: .5 - props.galleryParams.position01.x + (cropSizeOfScaled.width / 2) + cropMove01.x,
            y: .5 - props.galleryParams.position01.y + (cropSizeOfScaled.height / 2) + cropMove01.y,
        };

        const minDimensionX01 = 10 / scaledSize.width; // min 10 pixels ok?
        const minDimensionY01 = 10 / scaledSize.height; // min 10 pixels ok?
        cropBegin01 = {
            x: Clamp(cropBegin01.x, 0, 1 - minDimensionX01),
            y: Clamp(cropBegin01.y, 0, 1 - minDimensionY01),
        };
        cropEnd01 = {
            x: Clamp(cropEnd01.x, cropBegin01.x + minDimensionX01, 1),
            y: Clamp(cropEnd01.y, cropBegin01.y + minDimensionY01, 1),
        };

        props.onFileParamsChange({ ...props.fileParams, cropBegin01, cropEnd01 });

    }, [cropSize01, cropMove01]);

    const handleDragMove = (delta: Coord2D) => {

        switch (selectedTool) {
            case "CropSize": {
                let newFactor = cropSize01.factor + 0.003 * ((delta.x + delta.y) * .5);
                newFactor = Clamp(newFactor, 0.05, 1.4);
                setCropSize01({ factor: newFactor });
                break;
            }
            case "CropMove": {
                setCropMove01({
                    x: cropMove01.x + delta.x / props.galleryParams.scaledSize.width,
                    y: cropMove01.y + delta.y / props.galleryParams.scaledSize.height,
                });
                break;
            }
            case "Scale":
                {
                    let newSizeFactor = props.fileParams.scale + 0.003 * ((delta.x + delta.y) * .5);
                    newSizeFactor = Clamp(newSizeFactor, 0.05, 10);
                    props.onFileParamsChange({ ...props.fileParams, scale: newSizeFactor });
                    break;
                }
            case "Rotate":
                props.onGalleryParamsChange({ ...props.galleryParams, rotationDegrees: props.galleryParams.rotationDegrees + 0.1 * ((delta.x - delta.y) * .5) });
                break;
            case "Move":
                props.onGalleryParamsChange({
                    ...props.galleryParams,
                    position01: {
                        x: props.galleryParams.position01.x + delta.x / props.galleryParams.scaledSize.width,
                        y: props.galleryParams.position01.y + delta.y / props.galleryParams.scaledSize.height,
                    },
                });
                break;
            case "WindowSize":
                setViewportSize({ width: Clamp(viewportSize.width + delta.x, 10, 1000), height: Clamp(viewportSize.height + delta.y, 10, 1000) });
                break;
            case "MaskSize":
                setViewportMaskSize(Clamp(viewportMaskSize + (delta.x + delta.y) * .5, 0, 500));
                break;
        };

    };

    const containerWrapperStyle: React.CSSProperties & Record<string, any> = {
        width: "min-content",
        height: "min-content",
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        userSelect: "none",
        //margin: `40px`,
        position: "relative",
        overflow: "hidden",
        border: "4px dashed blue",
        boxSizing: "content-box", // we're setting width & height; let the border not interfere with the dimensions.
    };

    const origArea = fileDimensions.width * fileDimensions.height;
    const croppedSize: Size = {
        width: props.galleryParams.scaledSize.width * (props.fileParams.cropEnd01.x - props.fileParams.cropBegin01.x),
        height: props.galleryParams.scaledSize.height * (props.fileParams.cropEnd01.y - props.fileParams.cropBegin01.y),
    };
    const newArea = croppedSize.width * croppedSize.height;

    return <div>
        <div>
            {props.fileParams.scale.toFixed(1)}x, {props.galleryParams.rotationDegrees.toFixed(1)}°
        </div>
        <div>
            crop: [{(props.fileParams.cropBegin01.x).toFixed(2)},{(props.fileParams.cropBegin01.y).toFixed(2)}] - [{(props.fileParams.cropEnd01.x).toFixed(2)},{(props.fileParams.cropEnd01.y).toFixed(2)}]
        </div>
        <div>
            auto-crop size: {cropSize01.factor.toFixed(2)}
        </div>
        <div>
            Position: [{(props.galleryParams.position01.x).toFixed(2)},{(props.galleryParams.position01.y).toFixed(2)}]
        </div>
        <div>
            window size: [{(viewportSize.width).toFixed(0)},{viewportSize.height.toFixed(0)}], mask: [{viewportMaskSize.toFixed(0)}] px
        </div>
        <div className="ImageEditor editorMain">
            <div className="ImageEditor toolbar">
                <Button onClick={() => setSelectedTool("Scale")} className={`toolbutton ${selectedTool === "Scale" && "selected"}`}>Z</Button>
                <Button onClick={() => setSelectedTool("Move")} className={`toolbutton ${selectedTool === "Move" && "selected"}`}>XY</Button>
                <Button onClick={() => setSelectedTool("Rotate")} className={`toolbutton ${selectedTool === "Rotate" && "selected"}`}>Rotate</Button>
                {/* <Button onClick={() => setSelectedTool("CropBegin")} className={`toolbutton ${selectedTool === "CropBegin" && "selected"}`}>Crop TL</Button>
                <Button onClick={() => setSelectedTool("CropEnd")} className={`toolbutton ${selectedTool === "CropEnd" && "selected"}`}>Crop BR</Button> */}
                <Button onClick={() => setSelectedTool("CropSize")} className={`toolbutton ${selectedTool === "CropSize" && "selected"}`}>Crop Z</Button>
                <Button onClick={() => setSelectedTool("CropMove")} className={`toolbutton ${selectedTool === "CropMove" && "selected"}`}>Crop XY</Button>
            </div>
            <div className="ImageEditor toolbar">
                <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, scale: 1 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onGalleryParamsChange({ ...props.galleryParams, position01: { x: 0, y: 0 } });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onGalleryParamsChange({ ...props.galleryParams, rotationDegrees: 0 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                {/* <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, cropBegin01: { x: 0, y: 0 } });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, cropEnd01: { x: 1, y: 1 } });
                }} className={`toolbutton resetIcon`}>⟲</Button> */}
                <Button onClick={() => {
                    setCropSize01({ factor: 1.05 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    setCropMove01({ x: 0, y: 0 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
            </div>
            <JoystickDiv className="ImageEditor GalleryImageFrameContainer" style={containerWrapperStyle} enabled={true} onDragMove={handleDragMove}>
                <GalleryImageFrame
                    fileParams={props.fileParams}
                    galleryItem={props.galleryItem}
                    galleryParams={props.galleryParams}
                    maskSize={viewportMaskSize}
                    size={viewportSize}
                />
            </JoystickDiv>
            <div className="ImageEditor toolbar">
                <Button onClick={() => setSelectedTool("WindowSize")} className={`toolbutton ${selectedTool === "WindowSize" && "selected"}`}>WindowSize</Button>
                <Button onClick={() => setSelectedTool("MaskSize")} className={`toolbutton ${selectedTool === "MaskSize" && "selected"}`}>MaskSize</Button>
                <Button onClick={() => {
                    props.onReset();
                    setCropSize01({ factor: 1.05 });
                    setCropMove01({ x: 0, y: 0 });
                }}>Reset</Button>
                <Tooltip title={"Fork the image in order to crop & resize it, optimizing it for presentation."}><Button onClick={handleFork}>Fork</Button></Tooltip>
            </div>
            <div>
                [{fileDimensions.width} x {fileDimensions.height}], [{formatFileSize(props.galleryItem.file.sizeBytes)}], new size:[{croppedSize.width.toFixed(0)} x {croppedSize.height.toFixed(0)}] ({(newArea * 100 / origArea).toFixed(0)}%)
            </div>
        </div>{/* editorMain */}
    </div >;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// has a save button, keeps temporary state.
interface ImageEditControlProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
};

const ImageEditControl = (props: ImageEditControlProps) => {
    const [fileParams, setFileParams] = React.useState<ServerImageFileEditParams>(() => getCropParamsForFile(props.galleryItem.file));
    const [galleryParams, setGalleryParams] = React.useState<GalleryImageDisplayParams>(() => {
        const gp = db3.getGalleryImageDisplayParams(props.galleryItem);
        correctGalleryParams(props.galleryItem, gp, fileParams);
        return gp;
    });
    const [instanceKey, setInstanceKey] = React.useState<string>(() => nanoid());

    const handleFileParamsChange = (newFileParams: ServerImageFileEditParams) => {
        const newGalleryParams: GalleryImageDisplayParams = { ...galleryParams };
        newGalleryParams.cropOffset01 = { ...fileParams.cropBegin01 };
        correctGalleryParams(props.galleryItem, newGalleryParams, newFileParams);
        setGalleryParams(newGalleryParams);
        setFileParams(newFileParams);
    };

    const content: HomepageContentSpec = {
        agenda: [],
        gallery: [{ ...props.galleryItem, displayParams: JSON.stringify(galleryParams) }],
    };

    return <div>
        <ImageEditor
            galleryItem={props.galleryItem}
            //imageSize={realParentImageDimensions}
            fileParams={fileParams}
            galleryParams={galleryParams}
            onFileParamsChange={handleFileParamsChange}
            onReset={() => {
                const fp = MakeDefaultServerImageFileEditParams();
                const gp = MakeDefaultGalleryImageDisplayParams();
                correctGalleryParams(props.galleryItem, gp, fp);
                setGalleryParams(gp);
                setFileParams(fp);
            }}
            onGalleryParamsChange={setGalleryParams}
        />
        <div>

            <HomepageMain content={content} fullPage={false} className="embeddedPreview" />
        </div>
    </div>;

};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const TestPageContent = () => {

    // get a file as a test
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
        ],
    });
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    const client = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec,
    });
    const items = client.items as db3.FrontpageGalleryItemPayload[];

    return <div>
        TestPageContent
        <Suspense>
            {items.map(f => <ImageEditControl key={f.id} galleryItem={f} />)}
        </Suspense>
    </div>;
}

const TestPage: BlitzPage = () => {
    return <Suspense fallback={"outer suspense"}><TestPageContent /></Suspense>;
}

export default TestPage;
