/*


in order,
each 01 size/dimensions are the size of the previous transform.

[SERVER EDITS:] (original size)
- translate origin 01 (of original size)
- scale (x) -> (scaled size)
- crop 01 of scaled (cropped size)

[GALLERY TRANSFORMS:] - these don't need to be precise 01 coordinates because it's all CSS; no translation between systems needs to be done.
- translate origin px
- position01 px 
- rotate (deg)

crop, resize, rotate, position.

so, i think rotate & position will need to be separate gallery params. for saving image variations, it will just be cropping and resizing.
so for the editor, we need to simulate the result of cropping and resizing the image, and then treat that like an image itself.


so the "background" image will be of the original size, with a mask overlay

why when cropping does the position change? because position is 01 based off server image size. that size will change when cropping changes.

<control container wrapper> - can add things like padding/margin.
    <control container> - required to have no margin etc and serve as the relative positioning box.
        <cropped image container> - acts like a processed image, so this object gets transformed using live gallery params (position + rotation). size is equal to post-crop and resize.
            <cropped image> - size is the original image * resize factor, then positioned based on cropping.
            <cropped mask> - size is original image; borders are the cropped areas.

            */

import { BlitzPage } from "@blitzjs/next";
// import { useQuery } from "@blitzjs/rpc";
import { Suspense } from "react";
// import getAllRoles from "src/auth/queries/getAllRoles";
// import getTestQuery from "src/auth/queries/getTestQuery";
import * as React from 'react';
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import * as DB3Client from "src/core/db3/DB3Client";
// import { InspectObject } from "src/core/components/CMCoreComponents";
// import { Autocomplete, AutocompleteRenderInputParams, Badge, FormControlLabel, FormGroup, InputBase, MenuItem, NoSsr, Popover, Popper, Select, Switch, TextField, Tooltip } from "@mui/material";
// import { LocalizationProvider } from "@mui/x-date-pickers";
// import dayjs, { Dayjs } from "dayjs";
// import { DateCalendar, PickersDay, PickersDayProps } from '@mui/x-date-pickers';
// import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
// import { gIconMap } from "src/core/db3/components/IconSelectDialog";
// import { DateTimeRange, DateTimeRangeHitTestResult, DateTimeRangeSpec, TimeOption, TimeOptionsGenerator, combineDateAndTime, formatMillisecondsToDHMS, gMillisecondsPerDay, gMillisecondsPerHour, gMillisecondsPerMinute, getTimeOfDayInMillis, getTimeOfDayInMinutes } from "shared/time";
// import { CoerceToNumber, CoerceToNumberOrNull, isBetween } from "shared/utils";
// import { CalendarEventSpec, DateTimeRangeControlExample } from "src/core/components/DateTimeRangeControl";
import { Coord2D, FileCustomData, ForkImageParams, GalleryImageDisplayParams, MakeDefaultForkImageParams, MakeDefaultGalleryImageDisplayParams, MakeDefaultServerImageFileEditParams, MulSize, MulSizeBySize, ServerImageFileEditParams, Size, SubCoord2D, getFileCustomData } from "src/core/db3/shared/apiTypes";
import { API } from "src/core/db3/clientAPI"; // this line causes an exception . uh oh some circular reference.
import * as db3 from "src/core/db3/db3";
import { Button, Tooltip } from "@mui/material";
import { Clamp, Coalesce, formatFileSize } from "shared/utils";
import { JoystickDiv, JoystickDivDragState } from "src/core/components/CMCoreComponents";

////////////////////////////////////////////////////////////////
// const getImageDimensions = (url: string): Promise<Size> => {
//     return new Promise((resolve, reject) => {
//         const img = new Image();
//         img.onload = () => resolve({
//             width: img.width,
//             height: img.height,
//         });
//         img.onerror = (error) => reject(error);
//         img.src = url;
//     });
// };

// returns a valid ForkImageParams
const getCropParamsForFile = (f: db3.FilePayloadMinimum): ServerImageFileEditParams => {
    const customData = getFileCustomData(f);
    return customData.forkedImage?.editParams || MakeDefaultServerImageFileEditParams();
};

// const getImageFileDimensions = (file: db3.FilePayloadMinimum): Promise<Size> => {
//     const uri = API.files.getURIForFile(file);
//     const customData = getFileCustomData(file);
//     if (customData.imageMetadata?.height != null && customData.imageMetadata?.width != null) {
//         return new Promise((resolve, reject) => {
//             resolve({
//                 width: customData.imageMetadata!.width!,
//                 height: customData.imageMetadata!.height!,
//             });
//         });
//     }
//     return getImageDimensions(uri);
// };

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
interface GalleryImageFrameProps {
    galleryItem: db3.FrontpageGalleryItemPayload; // do not use the edit params from this, because they are the params that were used to create this image. not params to apply to this image.
    //imageSize: Size; // the gallery item file URI dimensions.
    fileParams: ServerImageFileEditParams; // 
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

    const centerToUL = `translate(${(props.size.width - scaledSize.width) * .5}px, ${(props.size.height - scaledSize.height) * .5}px)`;
    const galleryRotate = `rotate(${props.galleryParams.rotationDegrees}deg)`;
    const galleryTranslatePos = `translate(${props.galleryParams.position01.x * scaledSize.width}px, ${props.galleryParams.position01.y * scaledSize.height}px)`;

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
        transformOrigin: `50% 50%`,//${viewportSize.width * 0.5}px ${viewportSize.height * 0.5}px`,
        transform: `${galleryTranslatePos} ${galleryRotate} ${centerToUL}`,
    };

    return <div className="galleryImage serverFileWithMaskContainer" style={mainStyle}>
        <div className="galleryImage serverFileMask" style={maskStyle}></div>
        <div className="galleryImage serverFileGrid dashed-grid-paper" style={gridStyle}></div>
        <div className="galleryImage serverFileWrapper" style={imageWrapperStyle}>
            <FakeGalleryImage fileParams={props.fileParams} galleryItem={props.galleryItem} />
        </div>
    </div>;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// take an existing file record, allow editing and forking.
// a parent control should also account for re-editing. So if you choose to "EDIT" a file that has a parent, better to traverse
// up and edit from the original. its crop params are specified in its customData field so it can be re-processed.
type SelectedTool = "CropBegin" | "CropEnd" | "Scale" | "Rotate" | "Move" | "WindowSize" | "MaskSize";

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
    const [viewportMaskSize, setViewportMaskSize] = React.useState<number>(40);
    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const fileDimensions = getImageFileDimensions(props.galleryItem.file)

    const handleFork = () => {

    };

    const handleDragMove = (delta: Coord2D) => {

        switch (selectedTool) {
            case "CropBegin":
                {
                    const minDimensionX01 = 10 / props.galleryParams.scaledSize.width; // min 10 pixels ok?
                    const minDimensionY01 = 10 / props.galleryParams.scaledSize.height; // min 10 pixels ok?

                    let newCropBeginX01 = props.fileParams.cropBegin01.x + delta.x / viewportSize.width;
                    newCropBeginX01 = Clamp(newCropBeginX01, 0, 1 - minDimensionX01);

                    let newCropBeginY01 = props.fileParams.cropBegin01.y + delta.y / viewportSize.height;
                    newCropBeginY01 = Clamp(newCropBeginY01, 0, 1 - minDimensionY01);

                    // make sure image always has a valid dimension by also adjusting other rect if needed.
                    let newCropEndX01 = Clamp(props.fileParams.cropEnd01.x, newCropBeginX01 + minDimensionX01, 1);
                    let newCropEndY01 = Clamp(props.fileParams.cropEnd01.y, newCropBeginY01 + minDimensionY01, 1);

                    props.onFileParamsChange({
                        ...props.fileParams,
                        cropBegin01: {
                            x: newCropBeginX01,
                            y: newCropBeginY01,
                        },
                        cropEnd01: {
                            x: newCropEndX01,
                            y: newCropEndY01,
                        },
                    });
                    break;
                }
            case "CropEnd":
                {
                    const minDimensionX01 = 10 / props.galleryParams.scaledSize.width; // min 10 pixels ok?
                    const minDimensionY01 = 10 / props.galleryParams.scaledSize.height; // min 10 pixels ok?

                    let newCropEndX01 = props.fileParams.cropEnd01.x + delta.x / viewportSize.width;
                    newCropEndX01 = Clamp(newCropEndX01, minDimensionX01, 1);

                    let newCropEndY01 = props.fileParams.cropEnd01.y + delta.y / viewportSize.height;
                    newCropEndY01 = Clamp(newCropEndY01, minDimensionY01, 1);

                    // make sure image always has a valid dimension by also adjusting other rect if needed.
                    let newCropBeginX01 = Clamp(props.fileParams.cropBegin01.x, 0, newCropEndX01 - minDimensionX01);

                    let newCropBeginY01 = Clamp(props.fileParams.cropBegin01.y, 0, newCropEndY01 - minDimensionY01);

                    props.onFileParamsChange({
                        ...props.fileParams,
                        cropBegin01: {
                            x: newCropBeginX01,
                            y: newCropBeginY01,
                        },
                        cropEnd01: {
                            x: newCropEndX01,
                            y: newCropEndY01,
                        }
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
                props.onGalleryParamsChange({ ...props.galleryParams, rotationDegrees: props.galleryParams.rotationDegrees + 0.1 * ((delta.x + delta.y) * .5) });
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
            Position: [{(props.galleryParams.position01.x).toFixed(2)},{(props.galleryParams.position01.y).toFixed(2)}]
        </div>
        <div>
            window size: [{(viewportSize.width).toFixed(0)},{viewportSize.height.toFixed(0)}], mask: [{viewportMaskSize.toFixed(0)}] px
        </div>
        <div className="ImageEditor editorMain">
            <div className="ImageEditor toolbar">
                <Button onClick={() => setSelectedTool("Scale")} className={`toolbutton ${selectedTool === "Scale" && "selected"}`}>Scale</Button>
                <Button onClick={() => setSelectedTool("Rotate")} className={`toolbutton ${selectedTool === "Rotate" && "selected"}`}>Rotate</Button>
                <Button onClick={() => setSelectedTool("Move")} className={`toolbutton ${selectedTool === "Move" && "selected"}`}>Move</Button>
                <Button onClick={() => setSelectedTool("CropBegin")} className={`toolbutton ${selectedTool === "CropBegin" && "selected"}`}>Crop TL</Button>
                <Button onClick={() => setSelectedTool("CropEnd")} className={`toolbutton ${selectedTool === "CropEnd" && "selected"}`}>Crop BR</Button>
            </div>
            <div className="ImageEditor toolbar">
                <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, scale: 1 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onGalleryParamsChange({ ...props.galleryParams, rotationDegrees: 0 });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onGalleryParamsChange({ ...props.galleryParams, position01: { x: 0, y: 0 } });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, cropBegin01: { x: 0, y: 0 } });
                }} className={`toolbutton resetIcon`}>⟲</Button>
                <Button onClick={() => {
                    props.onFileParamsChange({ ...props.fileParams, cropEnd01: { x: 1, y: 1 } });
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
                <Button onClick={props.onReset}>Reset</Button>
                <Tooltip title={"Fork the image in order to crop & resize it, optimizing it for presentation."}><Button onClick={handleFork}>Fork</Button></Tooltip>
            </div>
            <div>
                [{fileDimensions.width} x {fileDimensions.height}], [{formatFileSize(props.galleryItem.file.sizeBytes)}], new size:[{croppedSize.width.toFixed(0)} x {croppedSize.height.toFixed(0)}] ({(newArea * 100 / origArea).toFixed(0)}%)
            </div>
        </div>{/* editorMain */}
    </div >;
};


const correctGalleryParams = (gi: db3.FrontpageGalleryItemPayload, mutableGp: GalleryImageDisplayParams, fp: ServerImageFileEditParams) => {
    // assumes the file dimensions are pre-server-effects.
    const fileDimensions = getImageFileDimensions(gi.file)
    mutableGp.cropOffset01 = { ...fp.cropBegin01 };
    mutableGp.scaledSize = MulSize(fileDimensions, fp.scale);
};

// has a save button, keeps temporary state.
interface ImageEditControlProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
};

const ImageEditControl = (props: ImageEditControlProps) => {
    const [fileParams, setFileParams] = React.useState<ServerImageFileEditParams>(() => getCropParamsForFile(props.galleryItem.file));
    const [galleryParams, setGalleryParams] = React.useState<GalleryImageDisplayParams>(() => db3.getGalleryImageDisplayParams(props.galleryItem));

    const handleFileParamsChange = (newFileParams: ServerImageFileEditParams) => {
        const newGalleryParams: GalleryImageDisplayParams = { ...galleryParams };
        newGalleryParams.cropOffset01 = { ...fileParams.cropBegin01 };
        correctGalleryParams(props.galleryItem, newGalleryParams, newFileParams);
        setGalleryParams(newGalleryParams);
        setFileParams(newFileParams);
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
    </div>;

};























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
