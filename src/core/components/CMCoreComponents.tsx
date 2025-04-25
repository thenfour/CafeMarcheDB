
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useSession } from "@blitzjs/auth";
//import dynamic from 'next/dynamic';
import { Prisma } from "db";
import React, { Suspense } from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { ColorVariationSpec, StandardVariationSpec, gSwatchColors } from 'shared/color';
import { Coalesce, getHashedColor } from "shared/utils";
import * as db3 from "src/core/db3/db3";
//import { API } from '../db3/clientAPI'; // <-- NO; circular dependency
import { Icon, Tooltip } from "@mui/material";
import { Permission } from "shared/permissions";
import { Timing } from "shared/time";
import { getURIForEvent, getURIForFile, getURIForSong } from "../db3/clientAPILL";
import { RenderMuiIcon, gIconMap } from "../db3/components/IconMap";
import { Coord2D, TAnyModel } from "../db3/shared/apiTypes";
import { CMChip, CMChipBorderOption, CMChipProps, CMChipShapeOptions, CMChipSizeOptions, CMStandardDBChip, CMStandardDBChipModel, CMStandardDBChipProps } from "./CMChip";
import { simulateLinkClickTargetBlank } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { DashboardContext, useDashboardContext } from "./DashboardContext";
import { wikiParseCanonicalWikiPath } from "../wiki/shared/wikiUtils";
import { CMLink } from "./CMLink";
import { ActivityFeature } from "./featureReports/activityTracking";

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
        autoFocus={false} // see #408
        onChange={(e, value) => { props.onChange(value) }}
        validationError={validationResult.errorMessage || null}
        value={props.value}
    />;
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


export interface InstrumentChipProps {
    value: number | db3.InstrumentPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    shape?: CMChipShapeOptions;
    border?: CMChipBorderOption;
};

export const InstrumentChip = (props: InstrumentChipProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    let instrument = typeof (props.value) === "number" ? dashboardContext.instrument.getById(props.value) : props.value;
    const functionalGroup = dashboardContext.instrumentFunctionalGroup.getById(instrument?.functionalGroupId || -1);

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={props.className}
        color={functionalGroup?.color}
        shape={props.shape}
        border={props.border}
    >
        {instrument?.name || "<null>"}
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
    value: Prisma.EventGetPayload<{
        select: {
            id: true,
            name: true,
            startsAt: true,
            statusId: true,
            typeId: true
        }
    }>;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const EventChip = (props: EventChipProps) => {
    const dashboardContext = React.useContext(DashboardContext);

    const clickHandler = props.onClick || (() => {
        simulateLinkClickTargetBlank(getURIForEvent(props.value));
    });

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        className={props.className}
        color={props.useHashedColor ? undefined : dashboardContext.eventType.getById(props.value.typeId)?.color}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {db3.EventAPI.getLabel(props.value)}
        </span>
        {props.endAdornment}
    </CMChip>
}


export interface SongChipProps {
    value: db3.SongPayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const SongChip = (props: SongChipProps) => {
    const clickHandler = props.onClick || (() => {
        simulateLinkClickTargetBlank(getURIForSong(props.value));
    });

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {props.value.name}
        </span>
        {props.endAdornment}
    </CMChip>
}



export interface FileChipProps {
    value: Prisma.FileGetPayload<{ select: { id: true, storedLeafName: true, fileLeafName: true, externalURI: true } }> | db3.FilePayloadMinimum;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const FileChip = (props: FileChipProps) => {
    const clickHandler = props.onClick || (() => {
        simulateLinkClickTargetBlank(getURIForFile(props.value));
    });

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.value.id.toString()) : undefined }}>
            {props.value.fileLeafName}
        </span>
        {props.endAdornment}
    </CMChip>
}


export interface WikiPageChipProps {
    slug: string;
    // todo: use actual wiki page name
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
    useHashedColor?: boolean;
};

export const WikiPageChip = (props: WikiPageChipProps) => {
    const wikiPath = wikiParseCanonicalWikiPath(props.slug);
    const clickHandler = props.onClick || (() => {
        simulateLinkClickTargetBlank(wikiPath.uriRelativeToHost);
    });

    return <CMChip
        variation={props.variation}
        size={props.size}
        onClick={clickHandler}
        className={props.className}
    >
        {props.startAdornment}
        <span style={{ color: props.useHashedColor ? getHashedColor(props.slug) : undefined }}>
            {props.slug}
        </span>
        {props.endAdornment}
    </CMChip>
}


export interface AttendanceChipProps {
    chipRef?: React.ForwardedRef<HTMLDivElement>;
    showLabel?: boolean | undefined;
    fadeNoResponse?: boolean | undefined;
    value: number | db3.EventAttendanceBasePayload | null;
    variation?: ColorVariationSpec;
    size?: CMChipSizeOptions;
    onClick?: () => void;
    className?: string;
    tooltipOverride?: string | undefined;
    //shape?: CMChipShapeOptions;
};

export const AttendanceChip = ({ fadeNoResponse = false, showLabel = true, ...props }: AttendanceChipProps) => {
    let value = props.value;
    const dashboardContext = useDashboardContext();
    if (typeof value === "number") {
        value = dashboardContext.eventAttendance.getById(value);
    }
    let label: React.ReactNode = showLabel && (value?.text || "No response");
    if (!label && !value?.iconName) {
        label = <Icon />;
    }

    const style: React.CSSProperties = {};
    if (fadeNoResponse && !value) {
        style.opacity = "40%";
    }

    return <CMChip
        chipRef={props.chipRef}
        variation={props.variation}
        size={props.size}
        onClick={props.onClick}
        className={`${props.className} AttendanceChip`}
        color={value?.color || null}
        //shape={props.shape}
        shape="rectangle"
        tooltip={props.tooltipOverride || value?.description}
        style={style}
    >
        {RenderMuiIcon(value?.iconName)}
        {label}
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventTextLink = (props: {
    event: Prisma.EventGetPayload<{ select: { id: true, name: true, startsAt: true, statusId: true, typeId: true } }>,
    className?: string | undefined,
}) => {
    const dashboardContext = useDashboardContext();
    const type = dashboardContext.eventType.getById(props.event.typeId);
    const status = dashboardContext.eventStatus.getById(props.event.statusId);
    const label = db3.EventAPI.getLabel(props.event);

    const firstLetter = (s: string | null | undefined) => s ? s.substring(0, 1) : "";
    const style: React.CSSProperties = {
        height: "16px",
        width: "16px",
    };

    return <CMLink rel="noreferrer" target="_blank" className={`${props.className} EventTextLink`} style={{ display: "block", whiteSpace: "nowrap", maxWidth: "150px" }} href={getURIForEvent(props.event)} trackingFeature={ActivityFeature.link_follow_internal}>
        <CMChip
            color={type?.color}
            size="small"
        >
            <CMChip
                color={status?.color}
                tooltip={status?.label || ""}
                className="attendanceResponseColorBarSegment"
                style={style}
                shape="rectangle"
            >
                {firstLetter(status?.label)}
            </CMChip>
            <Tooltip title={label} disableInteractive><span>
                {label}</span></Tooltip>
        </CMChip>
    </CMLink>;
};

