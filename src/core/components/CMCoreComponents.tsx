
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { getAntiCSRFToken, useSession } from "@blitzjs/auth";
import { Box, Button, CircularProgress, CircularProgressProps, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
//import dynamic from 'next/dynamic';
import React, { Suspense } from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec, gSwatchColors } from 'shared/color';
import { Coalesce, IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency
import { Timing } from "shared/time";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconSelectDialog";
import { Coord2D, MakeErrorUploadResponsePayload, TAnyModel, TClientUploadFileArgs, UploadResponsePayload } from "../db3/shared/apiTypes";
import { CMDialogContentText } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { GetStyleVariablesForColor } from './Color';

//const DynamicReactJson = dynamic(() => import('react-json-view'), { ssr: false });


// https://github.com/kutlugsahin/react-smooth-dnd/issues/88
export const ReactSmoothDndContainer = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Container {...props as any} />;
}
export const ReactSmoothDndDraggable = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Draggable {...props as any} />;
}




////////////////////////////////////////////////////////////////

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface

// well tbh, it's hard to know whether to use this or what <EventDetail> uses...
// .contentSection seems more developed, with 
export const CMSinglePageSurfaceCard = (props: React.PropsWithChildren<{ className?: string }>) => {
    // return <Card className='singlePageSurface'>{props.children}</Card>;
    return <div className={`contentSection ${props.className}`}>{props.children}</div>;
};

////////////////////////////////////////////////////////////////
// rethinking "variant"... for component coloring variations, there are
// strong / weak
// selected / notselected
// disabled / enabled
// (hover)
// (focus)

// but it means having a lot of color variations:
// - main / contrast
// - faded main / contrast, for disabled/enabled
// - for selected, something else? maybe we're OK as is

export type CMChipShapeOptions = "rounded" | "rectangle";

export type CMChipSizeOptions = "small" | "big";

export type CMChipBorderOption = "default" | "border" | "noBorder";

export interface CMChipProps {
    chipRef?: React.Ref<HTMLDivElement>;
    color?: ColorPaletteEntry | string | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    className?: string;
    tooltip?: string | null;

    onDelete?: () => void;
    onClick?: () => void;
};


export const CMChip = (props: React.PropsWithChildren<CMChipProps>) => {
    const variant = props.variation || StandardVariationSpec.Strong;
    const shape: CMChipShapeOptions = props.shape || "rounded";
    const style = GetStyleVariablesForColor({ color: props.color, ...variant });
    const size = props.size || "big";

    const wrapperClasses: string[] = [
        "CMChip",
        size,
        shape,
        variant.enabled ? "enabled" : "disabled",
        variant.selected ? "selected" : "notselected",
        (props.onClick || props.onDelete) ? "interactable" : "noninteractable",
    ];
    if (props.className) {
        wrapperClasses.push(props.className);
    }

    const chipClasses: string[] = [
        "chipMain applyColor",
        props.border === "border" ? "colorForceBorder" : (props.border === "noBorder" ? "colorForceNoBorder" : "colorForceDefaultBorder"),
        style.cssClass,
        size,
        variant.enabled ? "enabled" : "disabled",
        variant.selected ? "selected" : "notselected",
    ];

    const chipNode = <div className={wrapperClasses.join(" ")} style={style.style} onClick={props.onClick} ref={props.chipRef}>
        <div className={chipClasses.join(" ")}>
            <div className='content'>
                {props.children}
            </div>
        </div>
    </div>;

    if (IsNullOrWhitespace(props.tooltip)) return chipNode;

    return <Tooltip title={props.tooltip}>{chipNode}</Tooltip>;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CMChipContainer = (props: React.PropsWithChildren<{ className?: string, orientation?: "vertical" | "horizontal" }>) => {
    return <div className={`CMChipContainer ${props.className || ""} ${props.orientation}`}>{props.children}</div>
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface CMStandardDBChipModel {
    color?: null | string | ColorPaletteEntry;
    iconName?: string | null;

    text?: string | null;
    label?: string | null;

    description?: string | null;
}

export interface CMStandardDBChipProps<T> {
    model: T | null;
    getText?: (value: T | null, coalescedValue: string | null) => string; // override the text getter
    getTooltip?: (value: T | null, coalescedValue: string | null) => string | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
    onClick?: () => void;
    className?: string;
};

export const CMStandardDBChip = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    const dbText = props.model?.label || props.model?.text || null;
    const tooltip: string | null | undefined = props.getTooltip ? props.getTooltip(props.model, dbText) : (props.model?.description);
    return <CMChip
        color={props.model?.color}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        tooltip={tooltip}
        shape={props.shape}
        border={props.border}
    >
        {RenderMuiIcon(props.model?.iconName)}{props.getText ? props.getText(props.model, dbText) : dbText || "--"}
    </CMChip>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface RowInfoChipProps {
    tableSpec: db3.xTable;
    item: TAnyModel | null;
    overrideRowInfo?: (value: any, rowInfo: db3.RowInfo) => db3.RowInfo;

    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
};
export const RowInfoChip = (props: RowInfoChipProps) => {
    const rowInfo1: db3.RowInfo = props.item ? props.tableSpec.getRowInfo(props.item) : {
        name: "--",
        ownerUserId: null,
    };
    const rowInfo = props.overrideRowInfo ? props.overrideRowInfo(props.item, rowInfo1) : rowInfo1;
    return <CMChip
        color={rowInfo.color}
        onClick={props.onClick}
        className={props.className}
        tooltip={rowInfo.description}
        shape={props.shape}
        border={props.border}
    >
        {RenderMuiIcon(rowInfo.iconName)}{rowInfo.name}
    </CMChip>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const CMStatusIndicator = <T extends CMStandardDBChipModel,>(props: CMStandardDBChipProps<T>) => {
    return <CMStandardDBChip {...props} className="CMStatusIndicator" />;
};



////////////////////////////////////////////////////////////////
// wraps <Dialog> except with mobile responsiveness
export interface ReactiveInputDialogProps {
    onCancel: () => void;
    className?: string;
};
export const ReactiveInputDialog = (props: React.PropsWithChildren<ReactiveInputDialogProps>) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    return (
        <Dialog
            className={`ReactiveInputDialog ${props.className}`}
            open={true}
            onClose={props.onCancel}
            scroll="paper"
            fullScreen={fullScreen}
            disableRestoreFocus={true} // this is required to allow the autofocus work on buttons. https://stackoverflow.com/questions/75644447/autofocus-not-working-on-open-form-dialog-with-button-component-in-material-ui-v
        >
            <Suspense>
                {props.children}
            </Suspense>
        </Dialog>
    );
};



////////////////////////////////////////////////////////////////
export interface EditTextFieldProps {
    value: string;
    onChange: (value: string) => void;
    columnSpec: db3.FieldBase<string>;
    clientIntention: db3.xTableClientUsageContext;
};
export const EditTextField = (props: EditTextFieldProps) => {
    const validationResult = props.columnSpec.ValidateAndParse({
        mode: "update",
        clientIntention: props.clientIntention,
        row: { [props.columnSpec.member]: props.value }
    });
    return <CMTextField
        autoFocus={true}
        onChange={(e, value) => { props.onChange(value) }}
        validationError={validationResult.errorMessage || null}
        value={props.value}
    />;
};


////////////////////////////////////////////////////////////////
// similar to ChooseItemDialog, we want little text fields to be editable
// on profile.tsx, values are editable inline.
// this one pops up a dialog, the point is
// 1. debouncing not necessary
// 2. on a very busy screen (edit details), a popup is more focused.
//
// this is just the dialog
export interface EditTextDialogProps {
    value: string;
    columnSpec: db3.FieldBase<string>;
    title: string;
    onOK: (value: string) => void;
    onCancel: () => void;
    description: React.ReactNode;
    clientIntention: db3.xTableClientUsageContext
};
export const EditTextDialog = (props: EditTextDialogProps) => {
    const [value, setValue] = React.useState<string>(props.value);
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title}
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {props.description}
            </CMDialogContentText>
            <EditTextField
                columnSpec={props.columnSpec}
                clientIntention={props.clientIntention}
                onChange={(newValue) => { setValue(newValue) }}
                value={value}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>Cancel</Button>
            <Button onClick={() => { props.onOK(value) }}>OK</Button>
        </DialogActions>
    </ReactiveInputDialog>;
};



////////////////////////////////////////////////////////////////
// this control is a button which pops up a dialog.
// by default JUST displays the button (not the text)
export interface EditTextDialogButtonProps {
    value: string;
    readOnly: boolean;
    columnSpec: db3.FieldBase<string>;
    selectButtonLabel: string;
    onChange: (value: string) => void;
    dialogTitle: string;
    dialogDescription: React.ReactNode;
    clientIntention: db3.xTableClientUsageContext
};
export const EditTextDialogButton = (props: EditTextDialogButtonProps) => {
    const [isOpen, setIsOpen] = React.useState<boolean>(false);

    return <>
        <Button disabled={props.readOnly} onClick={() => { setIsOpen(!isOpen) }} disableRipple>{props.selectButtonLabel}</Button>
        {isOpen && !props.readOnly && <EditTextDialog
            value={props.value}
            columnSpec={props.columnSpec}
            clientIntention={props.clientIntention}
            title={props.dialogTitle}
            description={props.dialogDescription}
            onOK={(newValue: string) => {
                props.onChange(newValue);
                setIsOpen(false);
            }}
            onCancel={() => {
                setIsOpen(false);
            }}
        />
        }
    </>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface ConfirmationDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    title?: () => React.ReactElement | string;
    description?: () => React.ReactElement | string;
};
export const ConfirmationDialog = (props: ConfirmationDialogProps) => {
    return <ReactiveInputDialog
        onCancel={props.onCancel}
    >
        <DialogTitle>
            {props.title === undefined ? "Confirm?" : ((typeof props.title === 'string' ? props.title : props.title()))}
        </DialogTitle>
        <DialogContent dividers>
            <CMDialogContentText>
                {(props.description !== undefined) && ((typeof props.description === 'string' ? props.description : props.description()))}
            </CMDialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel}>{props.cancelLabel || "Cancel"}</Button>
            <Button onClick={props.onConfirm}>{props.confirmLabel || "OK"}</Button>
        </DialogActions>
    </ReactiveInputDialog>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// export const InspectObject = (props: { src: any, tooltip?: string }) => {
//     const [open, setOpen] = React.useState<boolean>(false);
//     return <>
//         <Tooltip title={props.tooltip || "Open object inspector"}>
//             <div className='debugInspectorOpen' onClick={() => setOpen(true)}>{gIconMap.Visibility()}</div>
//         </Tooltip>
//         {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
//             todo{/* <DynamicReactJson src={props.src} /> */}
//         </ReactiveInputDialog>}
//     </>;
// };


// export const AdminInspectObject = (props: { src: any, tooltip?: string }) => {
//     const [open, setOpen] = React.useState<boolean>(false);
//     const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
//     const show = sess.isSysAdmin && sess.showAdminControls;
//     if (!show) return null;

//     return <>
//         <Tooltip title={props.tooltip || "Open object inspector"}>
//             <div className='debugInspectorOpen' onClick={() => setOpen(true)}>{gIconMap.Visibility()}</div>
//         </Tooltip>
//         {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
//             todo{/* <DynamicReactJson src={props.src} /> */}
//         </ReactiveInputDialog>}
//     </>;
// };

export const InspectObject = (props: { src: any, tooltip?: string, label?: string }) => {
    return <div className='debugInspectorOpen' onClick={() => console.log(props.src)}>{gIconMap.Visibility()} {props.label}</div>
};


export const AdminInspectObject = (props: { src: any, tooltip?: string }) => {
    const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
    const show = sess.isSysAdmin && sess.showAdminControls;
    if (!show) return null;
    return <InspectObject {...props} />;
};




////////////////////////////////////////////////////////////////
interface TabPanelProps {
    children?: React.ReactNode;
    tabPanelID: string;
    index: number;
    value: number;
}

export function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, tabPanelID, ...other } = props;

    return (<Suspense>
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`${tabPanelID}-tabpanel-${index}`}
            aria-labelledby={`${tabPanelID}-tab-${index}`}
            {...other}
        >
            {value === index && (
                <>
                    {children}
                </>
            )}
        </div>
    </Suspense>
    );
}

export function TabA11yProps(tabPanelID: string, index: number) {
    return {
        id: `${tabPanelID}-tab-${index}`,
        'aria-controls': `${tabPanelID}-tabpanel-${index}`,
    };
}


////////////////////////////////////////////////////////////////
// do not create separate components for the various verbosities.
// it's tempting, because it would have advantages:
// - can optimize queries easier for more compact variations
// - can have simpler control over big gui variations instead of trying to make everything unified
//
// however, that has drawbacks:
// - the init code is a lot, and it would either need to be duplicated or pass a huge amount of data around. neither is nice
// - will allow a smoother transition between verbosities
//export type EventDetailVerbosity = "compact" | "default" | "verbose";



////////////////////////////////////////////////////////////////
export interface CMDBUploadFilesArgs {
    files: FileList | null;
    fields: TClientUploadFileArgs;
    onProgress: (progress01: number, uploaded: number, total: number) => void;
};

export async function CMDBUploadFile(args: CMDBUploadFilesArgs): Promise<UploadResponsePayload> {
    const formData = new FormData();
    if (args.files) {
        for (let i = 0; i < args.files.length; ++i) {
            formData.append(`file_${i}`, args.files[i]!);
        }
    }
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
                args.onProgress(event.loaded / event.total, event.loaded, event.total);
            }
        });
        // for download progress which we don't want...
        //   xhr.addEventListener("progress", (event) => {
        xhr.addEventListener("loadend", () => {
            if (xhr.readyState === 4 && xhr.status === 200) {
                // success
                const resp = JSON.parse(xhr.responseText) as UploadResponsePayload;
                resolve(resp);
            } else {
                reject(MakeErrorUploadResponsePayload(`loadend state error ${xhr.responseText}`));
            }
        });
        xhr.upload.addEventListener("error", (e) => {
            //reject(`upload error`);
            reject(MakeErrorUploadResponsePayload(`upload error event`));
        });
        xhr.addEventListener("error", (e) => {
            reject(MakeErrorUploadResponsePayload(`read response error ${xhr.responseText}`));
        });

        // add form fields
        Object.entries(args.fields).forEach(([key, value]) => {
            formData.append(key, value);
        });

        xhr.open("POST", "/api/files/upload", true);

        // see blitz docs for manually invoking APIs / https://blitzjs.com/docs/session-management#manual-api-requests
        const antiCSRFToken = getAntiCSRFToken();
        if (antiCSRFToken) {
            xhr.setRequestHeader("anti-csrf", antiCSRFToken);
        }

        xhr.send(formData);
    });
}



////////////////////////////////////////////////////////////////
export function CircularProgressWithLabel(props: CircularProgressProps & { value: number, size?: number, textCssClass?: string }) {
    //props.size = props.size || 70;
    //props.thickness = props.thickness || 7;
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress variant="determinate" {...props} style={{ color: "#0a0" }} size={props.size} thickness={7} />
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                    className={props.textCssClass}
                >{`${Math.round(props.value)}%`}</Typography>
            </Box>
        </Box>
    );
}



export interface UserChipProps {
    value: db3.UserPayload_Name | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const UserChip = (props: UserChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    >
        {props.value?.name || "--"}
    </CMChip>
}


export interface InstrumentChipProps {
    value: db3.InstrumentPayload;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
};

export const InstrumentChip = (props: InstrumentChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={props.value.functionalGroup.color}
        shape={props.shape}
        border={props.border}
    >
        {props.value.name}
    </CMChip>
}

export interface InstrumentFunctionalGroupChipProps {
    value: db3.InstrumentFunctionalGroupPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
};

export const InstrumentFunctionalGroupChip = (props: InstrumentFunctionalGroupChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={props.value.color}
        shape={props.shape}
        border={props.border}
    >
        {props.value.name}
    </CMChip>
}


export interface EventChipProps {
    value: db3.EventPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const EventChip = (props: EventChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    //color={props.value.functionalGroup.color}
    >
        {props.value.name}
    </CMChip>
}


export interface SongChipProps {
    value: db3.SongPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
};

export const SongChip = (props: SongChipProps) => {
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
    //color={props.value.functionalGroup.color}
    >
        {props.value.name}
    </CMChip>
}



export interface AttendanceChipProps {
    chipRef?: React.ForwardedRef<HTMLDivElement>;
    value: db3.EventAttendanceBasePayload | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
};

export const AttendanceChip = (props: AttendanceChipProps) => {
    return <CMChip
        chipRef={props.chipRef}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={`${props.className} AttendanceChip`}
        color={props.value?.color || null}
        shape={props.shape}
        tooltip={props.value?.text}
    >
        {RenderMuiIcon(props.value?.iconName)}
        {props.value?.text || "No response"}
    </CMChip>
}

export const AttendanceChipWithRef = React.forwardRef<HTMLDivElement, AttendanceChipProps>((props, ref) => <AttendanceChip {...props} chipRef={ref} />);

//////////////////////////////////////////////////////////////////////////////////////
export type JoystickDivDragState = "idle" | "dragging";
export interface JoystickDivProps {
    enabled?: boolean;
    className?: string;
    style?: React.CSSProperties & Record<string, any>;
    onDragStateChange?: (newState: JoystickDivDragState, oldState: JoystickDivDragState) => void;
    onDragMove?: (delta: Coord2D) => void;
};

export const JoystickDiv = ({ enabled, children, className, ...props }: React.PropsWithChildren<JoystickDivProps>) => {
    const [containerRef, setContainerRef] = React.useState<HTMLDivElement | null>(null);
    const [touchIdentifier, setTouchIdentifier] = React.useState<number | null>(null);
    const [prevPagePos, setPrevPagePos] = React.useState<Coord2D | null>(null);
    const isDragging = !!prevPagePos;
    enabled = Coalesce(enabled, true);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!enabled) return;
        if (!containerRef) return;
        setPrevPagePos({
            x: e.pageX,
            y: e.pageY,
        });

        containerRef.setPointerCapture(e.pointerId);
        props.onDragStateChange && props.onDragStateChange("dragging", "idle");
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!containerRef) return;
        containerRef.releasePointerCapture(e.pointerId);
        setTouchIdentifier(null);
        setPrevPagePos(null);
        props.onDragStateChange && props.onDragStateChange("idle", "dragging");
    };

    const handleTouchUp = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!containerRef) return;
        setTouchIdentifier(null);
        setPrevPagePos(null);
        props.onDragStateChange && props.onDragStateChange("idle", "dragging");
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        if (!enabled) return;
        if (touchIdentifier) return; // if touch-dragging, stick with touch behavior. don't double-process.

        const dx = e.pageX - prevPagePos.x;
        const dy = e.pageY - prevPagePos.y;

        setPrevPagePos({
            x: e.pageX,
            y: e.pageY,
        });
        props.onDragMove && props.onDragMove({ x: dx, y: dy });
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!enabled) return;
        if (!containerRef) return;
        if (e.touches?.length !== 1) return;

        const touch = e.touches[0]!;
        setTouchIdentifier(touch.identifier);

        setPrevPagePos({
            x: touch.pageX,
            y: touch.pageY,
        });

        props.onDragStateChange && props.onDragStateChange("dragging", "idle");
    }

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        if (!enabled) return;
        if (e.touches?.length !== 1) return;
        const touch = e.touches[0]!;
        if (touch.identifier !== touchIdentifier) return;

        const dx = touch.pageX - prevPagePos.x;
        const dy = touch.pageY - prevPagePos.y;

        setPrevPagePos({
            x: touch.pageX,
            y: touch.pageY,
        });

        props.onDragMove && props.onDragMove({ x: dx, y: dy });
    };

    const containerStyle: React.CSSProperties & Record<string, any> = {
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        ...props.style,
    };

    return <div className={className} style={containerStyle}
        ref={(r) => setContainerRef(r)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchUp}
    >
        {children}
    </div>;

};

export const OpenCloseIcon = ({ isOpen }: { isOpen: boolean }) => {
    // https://www.compart.com/en/unicode/U+23F5
    // 
    return isOpen ? <>&#9207;</> : <>&#9205;</>;
};


export const TimingChip = ({ value, tooltip, children }: React.PropsWithChildren<{ value: Timing, tooltip: string }>) => {
    const configMap: { [key in Timing]: CMChipProps } = {
        [Timing.Past]: { color: gSwatchColors.light_gray, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
        [Timing.Present]: { color: gSwatchColors.orange, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
        [Timing.Future]: { color: gSwatchColors.purple, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
    };
    return <CMChip {...configMap[value]} tooltip={tooltip}>{children}</CMChip>;
}

