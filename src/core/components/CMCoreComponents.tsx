
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useSession } from "@blitzjs/auth";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Tooltip, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
//import dynamic from 'next/dynamic';
import React, { Suspense } from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { ColorPaletteEntry, ColorVariationSpec, StandardVariationSpec, gSwatchColors } from 'shared/color';
import { Coalesce, IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency
import { Timing } from "shared/time";
import { Coord2D, TAnyModel } from "../db3/shared/apiTypes";
import { CMDialogContentText } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { GetStyleVariablesForColor } from './Color';
import { DashboardContext } from "./DashboardContext";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";
import { Permission } from "shared/permissions";
import { CMChip, CMChipBorderOption, CMChipProps, CMChipShapeOptions, CMChipSizeOptions, CMStandardDBChip, CMStandardDBChipModel, CMStandardDBChipProps } from "./CMChip";

//const DynamicReactJson = dynamic(() => import('react-json-view'), { ssr: false });


// https://github.com/kutlugsahin/react-smooth-dnd/issues/88
export const ReactSmoothDndContainer = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Container {...props as any} />;
}
export const ReactSmoothDndDraggable = (props: React.PropsWithChildren<any>) => {
    return <ReactSmoothDnd.Draggable {...props as any} />;
}


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
        pk: -1,
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




////////////////////////////////////////////////////////////////

// a white surface elevated from the gray base background, allowing vertical content.
// meant to be the ONLY surface

// well tbh, it's hard to know whether to use this or what <EventDetail> uses...
// .contentSection seems more developed, with 
export const CMSinglePageSurfaceCard = (props: React.PropsWithChildren<{ className?: string }>) => {
    // return <Card className='singlePageSurface'>{props.children}</Card>;
    return <div className={`contentSection ${props.className}`}>{props.children}</div>;
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
            className={`ReactiveInputDialog ${props.className} ${fullScreen ? "smallScreen" : "bigScreen"}`}
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


export const AdminContainer = (props: React.PropsWithChildren<{}>) => {
    const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
    const show = sess.isSysAdmin && sess.showAdminControls;
    if (!show) return null;
    return <>{props.children}</>;
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const InspectObject = (props: { src: any, tooltip?: string, label?: string }) => {
    return <div className='debugInspectorOpen' onClick={() => {
        if (props.label || props.tooltip) {
            console.log(`Dumping object: ${props.label || props.tooltip}`);
        }
        console.log(props.src);
    }}>{gIconMap.Visibility()} {props.label}</div>
};


export const AdminInspectObject = (props: { src: any, tooltip?: string, label?: string }) => {
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
    value: db3.InstrumentPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
};

export const InstrumentChip = (props: InstrumentChipProps) => {
    const dashboardContext = React.useContext(DashboardContext);
    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={dashboardContext.instrumentFunctionalGroup.getById(props.value.functionalGroupId)?.color}
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
    const dashboardContext = React.useContext(DashboardContext);

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={dashboardContext.eventType.getById(props.value.typeId)?.color}
    >
        {db3.EventAPI.getLabel(props.value)}
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
    //shape?: CMChipShapeOptions;
};

export const AttendanceChip = (props: AttendanceChipProps) => {
    return <CMChip
        chipRef={props.chipRef}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={`${props.className} AttendanceChip`}
        color={props.value?.color || null}
        //shape={props.shape}
        shape="rectangle"
        tooltip={props.value?.description}
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface PermissionBoundaryProps {
    permission: Permission;
    fallback?: React.ReactNode;
};

export const PermissionBoundary = (props: React.PropsWithChildren<PermissionBoundaryProps>) => {
    const dashboardContext = React.useContext(DashboardContext);
    if (!dashboardContext.isAuthorized(props.permission)) {
        return <>{props.fallback}</>;
    }
    return <>{props.children}</>;
}

