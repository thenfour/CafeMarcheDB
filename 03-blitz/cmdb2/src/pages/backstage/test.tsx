/*

- whole image should be centered by default.
- rotate origin should be around viewport center (will help with above)
- when adjusting scale, center should be fixed.
- when adjusting crop, compensate position


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
import { Coord2D, FileCustomData, ForkImageParams, GalleryImageDisplayParams, MakeDefaultForkImageParams, MakeDefaultGalleryImageDisplayParams, MakeDefaultServerImageFileEditParams, ServerImageFileEditParams, Size, getFileCustomData } from "src/core/db3/shared/apiTypes";
import { API } from "src/core/db3/clientAPI"; // this line causes an exception . uh oh some circular reference.
import * as db3 from "src/core/db3/db3";
import { Button } from "@mui/material";
import { Clamp, Coalesce, formatFileSize } from "shared/utils";
import { JoystickDiv, JoystickDivDragState } from "src/core/components/CMCoreComponents";

const getImageDimensions = (url: string): Promise<Size> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({
            width: img.width,
            height: img.height,
        });
        img.onerror = (error) => reject(error);
        img.src = url;
    });
};

// returns a valid ForkImageParams
const getCropParamsForFile = (f: db3.FilePayloadMinimum): ServerImageFileEditParams => {
    const customData = getFileCustomData(f);
    return customData.forkedImage?.editParams || MakeDefaultServerImageFileEditParams();
};

const getImageFileDimensions = (file: db3.FilePayloadMinimum): Promise<Size> => {
    const uri = API.files.getURIForFile(file);
    const customData = getFileCustomData(file);
    if (customData.imageMetadata?.height != null && customData.imageMetadata?.width != null) {
        return new Promise((resolve, reject) => {
            resolve({
                width: customData.imageMetadata!.width!,
                height: customData.imageMetadata!.height!,
            });
        });
    }
    return getImageDimensions(uri);
};



// represents the image as it's coming from the server. therefore does not apply final rotate/positioning.
interface GalleryImageProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
};

const GalleryImage = (props: GalleryImageProps) => {
    const uri = API.files.getURIForFile(props.galleryItem.file);


    const origSize: Size = {
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
    };
    const scaledSize: Size = {
        width: origSize.width * props.fileParams.scale,
        height: origSize.height * props.fileParams.scale,
    };
    // const croppedSize: Size = {
    //     width: scaledSize.width * (props.fileParams.cropEnd01.x - props.fileParams.cropBegin01.y),
    //     height: scaledSize.height * (props.fileParams.cropEnd01.y - props.fileParams.cropBegin01.y),
    // };

    React.useEffect(() => {
        getImageFileDimensions(props.galleryItem.file).then((size) => {
            setDimensions(size);
        });
    }, []);

    const handleDragStateChange = (newState: JoystickDivDragState, oldState: JoystickDivDragState) => {
        setIsDragging(newState === "dragging");
    };
    const handleDragMove = (delta: Coord2D) => {
        props.onGalleryParamsChange({
            ...props.galleryParams,
            // position01: {
            //     x: props.galleryParams.position01.x + 0.05 * delta.x,// / croppedSize.width,
            //     y: props.galleryParams.position01.y + 0.05 * delta.y,// / croppedSize.height,
            // },
            position01: {
                x: props.galleryParams.position01.x + delta.x / scaledSize.width,
                y: props.galleryParams.position01.y + delta.y / scaledSize.height,
            },
        });
    };
    const handleReset = () => {
        props.onGalleryParamsChange(MakeDefaultGalleryImageDisplayParams());
        props.onFileParamsChange(MakeDefaultServerImageFileEditParams());
    };

    const containerWrapperStyle: React.CSSProperties & Record<string, any> = {
        width: `${viewportSize.width + viewportMaskSize * 2}px`,
        height: `${viewportSize.height + viewportMaskSize * 2}px`,

        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.

        margin: `40px`,
        position: "relative",
        overflow: "hidden",

        border: "1px dashed blue",

        "--crop-mask-color": `#f00c`,
        "--frame-mask-color": `#000c`,
        "--frame-mask-border-size": `15px`,
        boxSizing: "content-box", // we're setting width & height; let the border not interfere with the dimensions.
    };

    const containerStyle: React.CSSProperties & Record<string, any> = {
        position: "absolute",
        top: `${viewportMaskSize}px`,
        left: `${viewportMaskSize}px`,
        width: `${viewportSize.width}px`,
        height: `${viewportSize.height}px`,
    };

    const foregroundMaskStyle: React.CSSProperties & Record<string, any> = {
        position: "absolute",
        top: 0,
        left: 0,
        width: `100%`,
        height: `100%`,
        border: `${viewportMaskSize}px solid var(--frame-mask-color)`,
        boxSizing: "border-box",
        zIndex: 5,
        touchAction: "none",
        pointerEvents: "none",
    };

    // to simulate a scaled & cropped image, just use css transform to scale & shift the image to where it would be if it were scaled & cropped. crop bottom-right therefore is not used.
    const serverScale = `scale(${props.fileParams.scale})`;
    //const serverCrop = `translate(${scaledSize.width * -props.fileParams.cropBegin01.x}px, ${scaledSize.height * -props.fileParams.cropBegin01.y}px)`;

    //const cropCompensation = `translate(${props.fileParams.cropBegin01.x * -scaledSize.width}px, ${props.fileParams.cropBegin01.y * -scaledSize.height}px)`;

    const serverTransform: React.CSSProperties = {
        width: `${origSize.width}px`, // css transform works AFTER width/height, so this should be the original dimensions.
        height: `${origSize.height}px`,
        //transformOrigin: `${origSize.width * props.fileParams.scaleOrigin01.x}px ${origSize.height * props.fileParams.scaleOrigin01.y}px`,
        transformOrigin: `0 0`, // because the resulting image should be like an image file from 0,0, the scale origin should be about 0,0
        transform: `${serverScale}`,
        //border: "2px solid blue",
    }

    const galleryRotate = `rotate(${props.galleryParams.rotationDegrees}deg)`;
    const galleryTranslatePos = `translate(${props.galleryParams.position01.x * scaledSize.width}px, ${props.galleryParams.position01.y * scaledSize.height}px)`;

    //const negHalfViewport = `translate(${viewportSize.width * -.5}px, ${viewportSize.height * -.5}px)`;
    //const halfViewport = `translate(${viewportSize.width * .5}px, ${viewportSize.height * .5}px)`;

    const centerToUL = `translate(${(viewportSize.width - scaledSize.width) * .5}px, ${(viewportSize.height - scaledSize.height) * .5}px)`;
    //const ULtoCenter = `translate(${(viewportSize.width - croppedSize.width) * .5}px, ${(viewportSize.height - croppedSize.height) * .5}px)`;

    /*
        1. center the image over viewport.
        2. rotate about viewport center
    */

    const galleryTransform: React.CSSProperties = {
        transformOrigin: `${viewportSize.width * 0.5}px ${viewportSize.height * 0.5}px`,
        transform: `${galleryTranslatePos} ${galleryRotate} ${centerToUL}`,
    }

    const cropMockupContainerStyle: React.CSSProperties = {
        zIndex: 4,
        position: "absolute",
        left: 0,
        top: 0,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        // apply gallery params
        ...galleryTransform,
    }

    const cropMockupMaskStyle: React.CSSProperties = {
        zIndex: 3,
        position: "absolute",
        //opacity: `40%`,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        //border: "2px solid #00f",
        left: 0,//`${origSize.width * -props.fileParams.cropBeginX01}px`,
        top: 0,//`${origSize.height * -props.fileParams.cropBeginY01}px`,
        backgroundColor: "transparent",
        // transform is *applied to the border* so these need to be original dimensions not scaled.
        borderLeft: `${origSize.width * props.fileParams.cropBegin01.x}px solid var(--crop-mask-color)`,
        borderTop: `${origSize.height * props.fileParams.cropBegin01.y}px solid var(--crop-mask-color)`,
        borderRight: `${origSize.width * (1 - props.fileParams.cropEnd01.x)}px solid var(--crop-mask-color)`,
        borderBottom: `${origSize.height * (1 - props.fileParams.cropEnd01.y)}px solid var(--crop-mask-color)`,
        //width: `${origSize.width}px`,//"calc(var(--pre-crop-image-width) * (var(--cropEndX01) - var(--cropBeginX01)))",
        //height: `${origSize.height}px`,//"calc(var(--pre-crop-image-height) * (var(--cropEndY01) - var(--cropBeginY01)))",
        //transformOrigin: `${origSize.width * .5}px ${origSize.height * .5}px`,
        //transformOrigin: `${viewportSize.width * .5}px ${viewportSize.height * .5}px`,
        //transform: `${cropTranslate} ${scale} `,
        boxSizing: "border-box",
        ...serverTransform,
    }

    const cropMockupImageStyle: React.CSSProperties = {
        zIndex: 2,
        position: "absolute",
        //opacity: `40%`,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        //border: "2px solid #f00",
        backgroundImage: `url(${uri})`,
        //transition: isDragging ? "none" : `transform ${trans}`,
        left: 0,//`${origSize.width * -props.fileParams.cropBeginX01}px`,
        top: 0,//`${origSize.height * -props.fileParams.cropBeginY01}px`,

        ...serverTransform,
    }

    const joystickStyle: React.CSSProperties = {
        borderRadius: "4px",
        backgroundColor: "#ccc",
        margin: "4px",
        //marginLeft: "20px",
        marginTop: "50px",
        padding: "6px",
        width: "100px",
        height: "70px",
        userSelect: "none",
        display: "flex",
        justifyContent: "center",
        fontWeight: "bold",
        alignItems: "center",
    };

    return <div className="ImageEditor cropMockupContainer"
        style={cropMockupContainerStyle}
    >
        <div className="ImageEditor cropMockup Image" style={cropMockupImageStyle}></div>
        <div className="ImageEditor cropMockup Mask" style={cropMockupMaskStyle}></div>
    </div>;
}


interface GalleryImageFrameProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
    viewportSize: Size;
    viewportMaskSize: number;
};

const GalleryImageFrame = (props: GalleryImageFrameProps) => {
    const uri = API.files.getURIForFile(props.galleryItem.file);

}



// take an existing file record, allow editing and forking.
// a parent control should also account for re-editing. So if you choose to "EDIT" a file that has a parent, better to traverse
// up and edit from the original. its crop params are specified in its customData field so it can be re-processed.

interface ImageEditorProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
    fileParams: ServerImageFileEditParams;
    galleryParams: GalleryImageDisplayParams;
    onFileParamsChange: (params: ServerImageFileEditParams) => void;
    onGalleryParamsChange: (params: GalleryImageDisplayParams) => void;
};

const ImageEditor = (props: ImageEditorProps) => {
    const uri = API.files.getURIForFile(props.galleryItem.file);
    const [dimensions, setDimensions] = React.useState<Size | null>(null);
    const [viewportSize, setViewportSize] = React.useState<Size>({ width: 600, height: 500 });
    const [viewportMaskSize, setViewportMaskSize] = React.useState<number>(40);
    const [isDragging, setIsDragging] = React.useState<boolean>(false);
    const draggingEnabled = (!!dimensions) && (dimensions.height >= 1) && (dimensions.width >= 1);

    const origSize: Size = {
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
    };
    const scaledSize: Size = {
        width: origSize.width * props.fileParams.scale,
        height: origSize.height * props.fileParams.scale,
    };
    // const croppedSize: Size = {
    //     width: scaledSize.width * (props.fileParams.cropEnd01.x - props.fileParams.cropBegin01.y),
    //     height: scaledSize.height * (props.fileParams.cropEnd01.y - props.fileParams.cropBegin01.y),
    // };

    React.useEffect(() => {
        getImageFileDimensions(props.galleryItem.file).then((size) => {
            setDimensions(size);
        });
    }, []);

    const handleDragStateChange = (newState: JoystickDivDragState, oldState: JoystickDivDragState) => {
        setIsDragging(newState === "dragging");
    };
    const handleDragMove = (delta: Coord2D) => {
        props.onGalleryParamsChange({
            ...props.galleryParams,
            // position01: {
            //     x: props.galleryParams.position01.x + 0.05 * delta.x,// / croppedSize.width,
            //     y: props.galleryParams.position01.y + 0.05 * delta.y,// / croppedSize.height,
            // },
            position01: {
                x: props.galleryParams.position01.x + delta.x / scaledSize.width,
                y: props.galleryParams.position01.y + delta.y / scaledSize.height,
            },
        });
    };
    const handleReset = () => {
        props.onGalleryParamsChange(MakeDefaultGalleryImageDisplayParams());
        props.onFileParamsChange(MakeDefaultServerImageFileEditParams());
    };

    const containerWrapperStyle: React.CSSProperties & Record<string, any> = {
        width: `${viewportSize.width + viewportMaskSize * 2}px`,
        height: `${viewportSize.height + viewportMaskSize * 2}px`,

        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.

        margin: `40px`,
        position: "relative",
        overflow: "hidden",

        border: "1px dashed blue",

        "--crop-mask-color": `#f00c`,
        "--frame-mask-color": `#000c`,
        "--frame-mask-border-size": `15px`,
        boxSizing: "content-box", // we're setting width & height; let the border not interfere with the dimensions.
    };

    const containerStyle: React.CSSProperties & Record<string, any> = {
        position: "absolute",
        top: `${viewportMaskSize}px`,
        left: `${viewportMaskSize}px`,
        width: `${viewportSize.width}px`,
        height: `${viewportSize.height}px`,
    };

    const foregroundMaskStyle: React.CSSProperties & Record<string, any> = {
        position: "absolute",
        top: 0,
        left: 0,
        width: `100%`,
        height: `100%`,
        border: `${viewportMaskSize}px solid var(--frame-mask-color)`,
        boxSizing: "border-box",
        zIndex: 5,
        touchAction: "none",
        pointerEvents: "none",
    };

    // to simulate a scaled & cropped image, just use css transform to scale & shift the image to where it would be if it were scaled & cropped. crop bottom-right therefore is not used.
    const serverScale = `scale(${props.fileParams.scale})`;
    //const serverCrop = `translate(${scaledSize.width * -props.fileParams.cropBegin01.x}px, ${scaledSize.height * -props.fileParams.cropBegin01.y}px)`;

    //const cropCompensation = `translate(${props.fileParams.cropBegin01.x * -scaledSize.width}px, ${props.fileParams.cropBegin01.y * -scaledSize.height}px)`;

    const serverTransform: React.CSSProperties = {
        width: `${origSize.width}px`, // css transform works AFTER width/height, so this should be the original dimensions.
        height: `${origSize.height}px`,
        //transformOrigin: `${origSize.width * props.fileParams.scaleOrigin01.x}px ${origSize.height * props.fileParams.scaleOrigin01.y}px`,
        transformOrigin: `0 0`, // because the resulting image should be like an image file from 0,0, the scale origin should be about 0,0
        transform: `${serverScale}`,
        //border: "2px solid blue",
    }

    const galleryRotate = `rotate(${props.galleryParams.rotationDegrees}deg)`;
    const galleryTranslatePos = `translate(${props.galleryParams.position01.x * scaledSize.width}px, ${props.galleryParams.position01.y * scaledSize.height}px)`;

    //const negHalfViewport = `translate(${viewportSize.width * -.5}px, ${viewportSize.height * -.5}px)`;
    //const halfViewport = `translate(${viewportSize.width * .5}px, ${viewportSize.height * .5}px)`;

    const centerToUL = `translate(${(viewportSize.width - scaledSize.width) * .5}px, ${(viewportSize.height - scaledSize.height) * .5}px)`;
    //const ULtoCenter = `translate(${(viewportSize.width - croppedSize.width) * .5}px, ${(viewportSize.height - croppedSize.height) * .5}px)`;

    /*
        1. center the image over viewport.
        2. rotate about viewport center
    */

    const galleryTransform: React.CSSProperties = {
        transformOrigin: `${viewportSize.width * 0.5}px ${viewportSize.height * 0.5}px`,
        transform: `${galleryTranslatePos} ${galleryRotate} ${centerToUL}`,
    }

    const cropMockupContainerStyle: React.CSSProperties = {
        zIndex: 4,
        position: "absolute",
        left: 0,
        top: 0,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        // apply gallery params
        ...galleryTransform,
    }

    const cropMockupMaskStyle: React.CSSProperties = {
        zIndex: 3,
        position: "absolute",
        //opacity: `40%`,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        //border: "2px solid #00f",
        left: 0,//`${origSize.width * -props.fileParams.cropBeginX01}px`,
        top: 0,//`${origSize.height * -props.fileParams.cropBeginY01}px`,
        backgroundColor: "transparent",
        // transform is *applied to the border* so these need to be original dimensions not scaled.
        borderLeft: `${origSize.width * props.fileParams.cropBegin01.x}px solid var(--crop-mask-color)`,
        borderTop: `${origSize.height * props.fileParams.cropBegin01.y}px solid var(--crop-mask-color)`,
        borderRight: `${origSize.width * (1 - props.fileParams.cropEnd01.x)}px solid var(--crop-mask-color)`,
        borderBottom: `${origSize.height * (1 - props.fileParams.cropEnd01.y)}px solid var(--crop-mask-color)`,
        //width: `${origSize.width}px`,//"calc(var(--pre-crop-image-width) * (var(--cropEndX01) - var(--cropBeginX01)))",
        //height: `${origSize.height}px`,//"calc(var(--pre-crop-image-height) * (var(--cropEndY01) - var(--cropBeginY01)))",
        //transformOrigin: `${origSize.width * .5}px ${origSize.height * .5}px`,
        //transformOrigin: `${viewportSize.width * .5}px ${viewportSize.height * .5}px`,
        //transform: `${cropTranslate} ${scale} `,
        boxSizing: "border-box",
        ...serverTransform,
    }

    const cropMockupImageStyle: React.CSSProperties = {
        zIndex: 2,
        position: "absolute",
        //opacity: `40%`,
        touchAction: "none", // important so dragging touch doesn't use gesture behavior like scrolling the page.
        pointerEvents: "none", // important for overflow behavior (which i'll probably hide eventually)
        //border: "2px solid #f00",
        backgroundImage: `url(${uri})`,
        //transition: isDragging ? "none" : `transform ${trans}`,
        left: 0,//`${origSize.width * -props.fileParams.cropBeginX01}px`,
        top: 0,//`${origSize.height * -props.fileParams.cropBeginY01}px`,

        ...serverTransform,
    }

    const joystickStyle: React.CSSProperties = {
        borderRadius: "4px",
        backgroundColor: "#ccc",
        margin: "4px",
        //marginLeft: "20px",
        marginTop: "50px",
        padding: "6px",
        width: "100px",
        height: "70px",
        userSelect: "none",
        display: "flex",
        justifyContent: "center",
        fontWeight: "bold",
        alignItems: "center",
    };

    return <div>
        {/* <pre>{JSON.stringify(props.fileParams, undefined, 2)}</pre>
        <pre>{JSON.stringify(props.galleryParams, undefined, 2)}</pre> */}
        <div>
            original size: [{origSize.width}, {origSize.height}]
        </div>
        <div>
            size: [{formatFileSize(props.galleryItem.file.sizeBytes)}]
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>

            <JoystickDiv style={joystickStyle} className="joystickContainer serverParam ImageEditor scale" onDragMove={(d) => {
                let newSizeFactor = props.fileParams.scale + 0.01 * d.x;
                newSizeFactor = Clamp(newSizeFactor, 0.1, 10);
                let sizeFactorFactor = props.fileParams.scale / newSizeFactor;

                props.onFileParamsChange({ ...props.fileParams, scale: newSizeFactor });

                // it's a much nicer UX when you make big scale changes after drastic position changes, to keep your position changes in proportion to the scale.
                // otherwise the image will likely fly out of view.
                // props.onGalleryParamsChange({
                //     ...props.galleryParams,
                //     position: {
                //         x: props.galleryParams.position.x * sizeFactorFactor,
                //         y: props.galleryParams.position.y * sizeFactorFactor,
                //     }
                // });
            }}>
                <div className="label">{props.fileParams.scale.toFixed(2)} x</div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

            <JoystickDiv style={joystickStyle} className="joystickContainer serverParam ImageEditor crop cropBegin" onDragMove={(d) => {
                const minDimensionX01 = 10 / origSize.width; // min 10 pixels ok?
                const minDimensionY01 = 10 / origSize.height; // min 10 pixels ok?

                let newCropBeginX01 = props.fileParams.cropBegin01.x + d.x / origSize.width;
                newCropBeginX01 = Clamp(newCropBeginX01, 0, 1 - minDimensionX01);

                let newCropBeginY01 = props.fileParams.cropBegin01.y + d.y / origSize.height;
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

                // now translate-compensate for the change in origin.
                // newCrop01 vars are 01 of scaled size.
                // but we output 01 of CROPPED size. so if you for example crop to 0.9 (leaving only 10% of the image), then we should shift right 10x (1/1-x).
                // if you crop to 0.1 (leaving 90% of the image), then shift by 10% of the image.
                // props.onGalleryParamsChange({
                //     ...props.galleryParams,
                //     translate01: {
                //         //x: 1 / (1 - newCropBeginX01),// props.galleryParams.translate01.x * sizeFactorFactor,
                //         //y: 1 / (1 - newCropBeginY01),//props.galleryParams.translate01.y * sizeFactorFactor,
                //         x: newCropBeginX01,// props.galleryParams.translate01.x * sizeFactorFactor,
                //         y: newCropBeginY01,//props.galleryParams.translate01.y * sizeFactorFactor,
                //     }
                // });
            }}>
                <div className="label">
                    &#x230F;
                    [{(props.fileParams.cropBegin01.x).toFixed(2)},{(props.fileParams.cropBegin01.y).toFixed(2)}]
                </div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>
            <JoystickDiv style={joystickStyle} className="joystickContainer serverParam ImageEditor crop cropEnd" onDragMove={(d) => {

                const minDimensionX01 = 10 / origSize.width; // min 10 pixels ok?
                const minDimensionY01 = 10 / origSize.height; // min 10 pixels ok?

                let newCropEndX01 = props.fileParams.cropEnd01.x + d.x / origSize.width;
                newCropEndX01 = Clamp(newCropEndX01, minDimensionX01, 1);

                let newCropEndY01 = props.fileParams.cropEnd01.y + d.y / origSize.height;
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
            }}>
                <div className="label">
                    &#x230C;
                    [{(props.fileParams.cropEnd01.x).toFixed(2)},{(props.fileParams.cropEnd01.y).toFixed(2)}]
                </div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

            <JoystickDiv style={joystickStyle} className="joystickContainer clientParam ImageEditor rotate" onDragMove={(d) => {
                props.onGalleryParamsChange({ ...props.galleryParams, rotationDegrees: props.galleryParams.rotationDegrees - 0.05 * d.x });
            }}>
                <div className="label">{props.galleryParams.rotationDegrees.toFixed(2)} deg</div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

            <JoystickDiv style={joystickStyle} className="joystickContainer clientParam ImageEditor position" onDragMove={handleDragMove}>
                <div className="label">
                    POS
                    [{(props.galleryParams.position01.x).toFixed(2)},{(props.galleryParams.position01.y).toFixed(2)}]
                </div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

            <Button onClick={handleReset}>Reset</Button>


            <JoystickDiv style={joystickStyle} className="joystickContainer editorParam ImageEditor viewportSize" onDragMove={(d) => {
                setViewportSize({ width: Clamp(viewportSize.width + d.x, 10, 1000), height: Clamp(viewportSize.height + d.y, 10, 1000) });
            }}>
                <div className="label">
                    Window size
                    [{(viewportSize.width).toFixed(0)},{viewportSize.height.toFixed(0)}]
                </div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

            <JoystickDiv style={joystickStyle} className="joystickContainer editorParam ImageEditor viewportMaskSize" onDragMove={(d) => {
                setViewportMaskSize(Clamp(viewportMaskSize + d.x, 0, 300));
            }}>
                <div className="label">
                    Mask size
                    [{viewportMaskSize.toFixed(0)}]
                </div>
                <div className="crop ghostPreview"></div>
            </JoystickDiv>

        </div>

        <div className="ImageEditor containerWrapper" style={containerWrapperStyle}>
            <div className="ImageEditor foregroundMask" style={foregroundMaskStyle}></div>
            <JoystickDiv className="ImageEditor container" style={containerStyle} onDragMove={handleDragMove} onDragStateChange={handleDragStateChange} enabled={draggingEnabled}>
                {dimensions !== null && (
                    <div className="ImageEditor cropMockupContainer"
                        style={cropMockupContainerStyle}
                    >
                        <div className="ImageEditor cropMockup Image" style={cropMockupImageStyle}></div>
                        <div className="ImageEditor cropMockup Mask" style={cropMockupMaskStyle}></div>
                    </div>
                )}
            </JoystickDiv>
        </div>
    </div >;
};


// has a save button, keeps temporary state.
interface ImageEditControlProps {
    galleryItem: db3.FrontpageGalleryItemPayload;
};

const ImageEditControl = (props: ImageEditControlProps) => {
    const [fileParams, setFileParams] = React.useState<ServerImageFileEditParams>(() => getCropParamsForFile(props.galleryItem.file));
    const [galleryParams, setGalleryParams] = React.useState<GalleryImageDisplayParams>(() => db3.getGalleryImageDisplayParams(props.galleryItem));

    return <div>
        <ImageEditor galleryItem={props.galleryItem} fileParams={fileParams} galleryParams={galleryParams} onFileParamsChange={setFileParams} onGalleryParamsChange={setGalleryParams} />
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
