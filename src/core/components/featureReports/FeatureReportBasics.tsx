import { clearArray, toSorted } from "@/shared/arrayUtils";
import { getHashedColor, IsNullOrWhitespace } from "@/shared/utils";
import { Tooltip as MuiTooltip } from "@mui/material";
import * as React from 'react';
import Identicon from 'react-identicons';
import { CMChip } from "../CMChip";
import { CMSmallButton } from "../CMCoreComponents2";
//
import { ActivityDetailTabId, FacetResultBase, GeneralActivityReportDetailPayload } from "./activityReportTypes";
import { ActivityFeature, BrowserIconMap, Browsers, DeviceClasses, DeviceClassIconMap, OperatingSystem, OSIconMap, PointerTypeIconMap, PointerTypes } from "./activityTracking";
import { FeatureReportFilterSpec } from "./server/facetProcessor";
import { ColorPaletteEntry, gGeneralPaletteList, gLightSwatchColors, gSwatchColors } from "../color/palette";

export const CMAdhocChipContainer = ({ children }: { children: React.ReactNode }) => {
    return <div className="adHocChipContainer">
        {children}
    </div>;
}

// Forward declaration to avoid circular imports
interface FacetHandler<Tpayload extends FacetResultBase, TKey> {
    supportsDrilldown: boolean;
    getFacetName: () => string;
    addFilter: (filterSpec: FeatureReportFilterSpec, item: Tpayload) => FeatureReportFilterSpec;
    includedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];
    excludedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];
    itemFromKey: (key: TKey) => Tpayload;
    getItemKey: (item: Tpayload) => TKey;
    getItemLabel: (item: Tpayload) => string;
    getItemColor: (item: Tpayload, alpha?: string) => string;
}

export interface CMAdhocChipProps {
    children: React.ReactNode;
    startIcon?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;

    // Enhanced tooltip configuration
    tooltip?: {
        content?: React.ReactNode;           // Custom tooltip content
        showDefault?: boolean;               // Show default tooltip (children content)
        layout?: 'stacked' | 'inline';      // How to arrange content + actions
    };

    // Enhanced filtering configuration  
    filtering?: {
        handler: FacetHandler<any, any>;
        item: any;
        filterSpec: FeatureReportFilterSpec;
        setFilterSpec: (fs: FeatureReportFilterSpec) => void;
        showActions?: boolean;               // Whether to show isolate/hide buttons
    };
};

// Local implementation of FacetItemActions to avoid circular imports
const FacetItemActions = ({ item, handler, filterSpec, setFilterSpec }: {
    item: any;
    handler: FacetHandler<any, any>;
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (fs: FeatureReportFilterSpec) => void;
}) => {
    if (!handler.supportsDrilldown) return null;

    const isolateButton = <CMSmallButton
        variant="technical"
        onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling to parent click handlers
            const newFilterSpec = { ...filterSpec };
            const includedItems = handler.includedItemsSelector(newFilterSpec);
            const excludedItems = handler.excludedItemsSelector(newFilterSpec);
            clearArray(includedItems);
            clearArray(excludedItems);
            includedItems.push(handler.getItemKey(item));
            setFilterSpec(newFilterSpec);
        }}
    >
        [+] isolate
    </CMSmallButton>;

    const hideButton = <CMSmallButton
        variant="technical"
        onClick={(e) => {
            e.stopPropagation(); // Prevent event bubbling to parent click handlers
            // add to exclude list
            const newFilterSpec = { ...filterSpec };
            const excludedItems = handler.excludedItemsSelector(newFilterSpec);

            // ensure excludedItems contains the item's filter key.
            const itemKey = handler.getItemKey(item);
            if (!excludedItems.includes(itemKey)) {
                excludedItems.push(itemKey);
            }

            setFilterSpec(newFilterSpec);
        }}
    >
        [-] hide
    </CMSmallButton>;

    return <CMAdhocChipContainer>
        {isolateButton}
        {hideButton}
    </CMAdhocChipContainer>;
};

// Standard tooltip configuration for consistent behavior
const standardTooltipProps = {
    arrow: true,
    placement: 'bottom' as const,
    enterDelay: 300,
    leaveDelay: 200,
    PopperProps: {
        modifiers: [{
            name: 'offset',
            options: { offset: [0, -8] }
        }]
    },
    componentsProps: {
        tooltip: {
            sx: {
                bgcolor: 'white',
                color: 'text.primary',
                border: '1px solid #ccc',
                boxShadow: 3,
                padding: '8px 12px',
                borderRadius: '6px',
                maxWidth: '300px',
                '& .MuiTooltip-arrow': {
                    color: 'white',
                    '&::before': {
                        border: '1px solid #ccc'
                    }
                }
            }
        }
    }
};

export const CMAdhocChip = React.forwardRef<HTMLDivElement, CMAdhocChipProps>((props, ref) => {
    // Build consolidated tooltip content
    const tooltipContent = React.useMemo(() => {
        const parts: React.ReactNode[] = [];

        // 1. Default information (children content)
        if (props.tooltip?.showDefault !== false) {
            parts.push(<div key="default">{props.children}</div>);
        }

        // 2. Custom tooltip content
        if (props.tooltip?.content) {
            parts.push(<div key="custom">{props.tooltip.content}</div>);
        }

        // 3. Filter actions (if filtering is enabled)
        if (props.filtering && props.filtering.handler.supportsDrilldown) {
            if (parts.length > 0) {
                parts.push(<div key="divider" style={{ borderTop: '1px solid #ddd', margin: '8px 0' }} />);
            }
            parts.push(
                <div key="actions">
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
                        Filter Actions:
                    </div>
                    <FacetItemActions {...props.filtering} />
                </div>
            );
        }

        return parts.length > 0 ? <div>{parts}</div> : null;
    }, [props.children, props.tooltip, props.filtering]);

    // The base chip element
    const chipElement = (
        <div
            ref={ref}
            className={`adHocChip ${props.className || ''} ${props.onClick ? 'interactable' : ''}`}
            onClick={props.onClick}
            style={props.style}
        >
            {props.startIcon && <div className="adHocChipStartIcon">{props.startIcon}</div>}
            <div className="adHocChipContent">{props.children}</div>
        </div>
    );

    // Wrap with tooltip if content exists
    if (!tooltipContent) return chipElement;

    return (
        <MuiTooltip title={tooltipContent} {...standardTooltipProps}>
            {chipElement}
        </MuiTooltip>
    );
});


export type ContextObjectDistinctItem = {
    key: string,
    headingIndicator: React.ReactNode;
    label: string;
    itemCount: number;
    totalCount: number;
    percentageOfTotal: string;
    items: GeneralActivityReportDetailPayload[];
};


export type ContextObjectTabData = {
    id: ActivityDetailTabId,
    tabHeader: React.ReactNode,
    items: ContextObjectDistinctItem[],
    onIsolateFeature: (feature: ActivityFeature) => void;
    onExcludeFeature: (feature: ActivityFeature) => void;
    onFilterContext: (context: string) => void;
};


export const getColorForFeature = (feature: ActivityFeature | string): ColorPaletteEntry => {
    const featureColorMap: Record<ActivityFeature, string> = {
        [ActivityFeature.global_ical_digest]: gLightSwatchColors.light_blue,

        [ActivityFeature.metronome_persistent]: gLightSwatchColors.light_gold,

        [ActivityFeature.link_follow_external]: gLightSwatchColors.light_green,
        [ActivityFeature.link_follow_internal]: gLightSwatchColors.light_green,

        [ActivityFeature.event_change_custom_field]: gLightSwatchColors.light_orange,

        [ActivityFeature.attendance_response]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_instrument]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_comment]: gLightSwatchColors.light_brown,
        [ActivityFeature.attendance_explicit_invite]: gLightSwatchColors.light_brown,
        [ActivityFeature.event_change_invite_tag]: gLightSwatchColors.light_brown,

        [ActivityFeature.menu_link_update]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_create]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_reorder]: gLightSwatchColors.light_olive,
        [ActivityFeature.menu_link_delete]: gLightSwatchColors.light_olive,

        [ActivityFeature.custom_link_create]: gLightSwatchColors.light_citron,
        [ActivityFeature.custom_link_update]: gLightSwatchColors.light_citron,
        [ActivityFeature.custom_link_delete]: gLightSwatchColors.light_citron,

        [ActivityFeature.event_segment_create]: gSwatchColors.blue,
        [ActivityFeature.event_segment_edit]: gSwatchColors.blue,
        [ActivityFeature.event_segment_delete]: gSwatchColors.blue,
        [ActivityFeature.event_segment_reorder]: gSwatchColors.blue,

        [ActivityFeature.event_view]: gLightSwatchColors.light_pink,
        [ActivityFeature.event_create]: gSwatchColors.teal,
        [ActivityFeature.event_edit]: gSwatchColors.teal,
        [ActivityFeature.event_frontpage_edit]: gSwatchColors.teal,
        [ActivityFeature.event_delete]: gSwatchColors.teal,
        [ActivityFeature.event_change_relevance_class]: gSwatchColors.teal,

        [ActivityFeature.qr_code_generate]: gSwatchColors.green,

        [ActivityFeature.profile_view]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_edit]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_change_instrument]: gSwatchColors.dark_gray,
        [ActivityFeature.profile_change_default_instrument]: gSwatchColors.dark_gray,

        [ActivityFeature.login_email]: gSwatchColors.pink,
        [ActivityFeature.login_google]: gSwatchColors.pink,
        [ActivityFeature.logout]: gSwatchColors.pink,
        [ActivityFeature.signup_email]: gSwatchColors.red,
        [ActivityFeature.signup_google]: gSwatchColors.red,
        [ActivityFeature.forgot_password]: gSwatchColors.red,

        [ActivityFeature.wiki_page_view]: gSwatchColors.light_gray,
        [ActivityFeature.wiki_edit]: gSwatchColors.light_gray,
        [ActivityFeature.wiki_change_visibility]: gSwatchColors.light_gray,
        [ActivityFeature.wiki_page_tag_update]: gSwatchColors.light_gray,

        [ActivityFeature.frontpagegallery_reorder]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_create]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_edit]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_delete]: gSwatchColors.citron,
        [ActivityFeature.frontpagegallery_item_change_visibility]: gSwatchColors.citron,

        [ActivityFeature.file_download]: gSwatchColors.maroon,
        [ActivityFeature.file_upload]: gSwatchColors.maroon,
        [ActivityFeature.file_upload_url]: gSwatchColors.maroon,
        [ActivityFeature.file_edit]: gSwatchColors.maroon,
        [ActivityFeature.file_delete]: gSwatchColors.maroon,
        [ActivityFeature.file_detail_view]: gSwatchColors.maroon,

        [ActivityFeature.song_view]: gSwatchColors.purple,
        [ActivityFeature.song_edit]: gSwatchColors.purple,
        [ActivityFeature.song_edit_description]: gSwatchColors.purple,
        [ActivityFeature.song_delete]: gSwatchColors.purple,
        [ActivityFeature.song_create]: gSwatchColors.purple,
        [ActivityFeature.song_credit_add]: gSwatchColors.purple,
        [ActivityFeature.song_credit_edit]: gSwatchColors.purple,
        [ActivityFeature.song_credit_delete]: gSwatchColors.purple,
        [ActivityFeature.song_pin_recording]: gSwatchColors.purple,
        [ActivityFeature.song_play]: gSwatchColors.purple,
        [ActivityFeature.song_pause]: gSwatchColors.purple,

        [ActivityFeature.setlist_plan_create]: gSwatchColors.black,
        [ActivityFeature.setlist_plan_save]: gSwatchColors.black,
        [ActivityFeature.setlist_plan_delete]: gSwatchColors.black,

        [ActivityFeature.setlist_create]: gSwatchColors.teal,
        [ActivityFeature.setlist_edit]: gSwatchColors.teal,
        [ActivityFeature.setlist_delete]: gSwatchColors.teal,
        [ActivityFeature.setlist_reorder]: gSwatchColors.teal,

        [ActivityFeature.media_player_bar_close]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_next]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_previous]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_pull_playlist]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_play]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_pause]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_play_vis_segment]: gSwatchColors.olive,
        [ActivityFeature.media_player_bar_seek_vis_segment]: gSwatchColors.olive,
    };

    //return featureColorMap[feature] || gGeneralPaletteList.defaultEntry.strong.foregroundColor;
    return gGeneralPaletteList.findEntry(featureColorMap[feature]) || gGeneralPaletteList.defaultEntry;
}

export const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
    return <MuiTooltip title={value.substring(0, 6)} disableInteractive>
        <div style={{ display: "flex", alignItems: "center", padding: "0px", margin: "2px", backgroundColor: "white", borderRadius: "4px" }}>
            <Identicon string={value} size={size} />
        </div>
    </MuiTooltip>;
}

interface FeatureLabelProps {
    feature: ActivityFeature | string;
    onClickIsolate?: () => void;
    onClickExclude?: () => void;
}

export const FeatureLabel = (props: FeatureLabelProps) => {
    //const featureColor = getHashedColor(props.feature);
    const color = getColorForFeature(props.feature);

    return <>
        <div
            style={{ display: "flex", alignItems: "center" }}
        >
            {/* <span>{props.feature}</span> */}
            <CMChip
                color={color}
                size="small"
                shape="rectangle"
            //onClick={props.onClickIsolate ? (() => props.onClickIsolate!()) : undefined}
            //tooltip={`Isolate ${props.feature}`}
            >{props.feature}</CMChip>
            {/* <span className="flex-spacer"></span> */}
            {/* <span>
                <MuiTooltip title={`Hide / exclude ${props.feature}`} disableInteractive>
                    <span>
                        <CMSmallButton onClick={props.onClickExclude}>hide</CMSmallButton>
                    </span>
                </MuiTooltip>
            </span> */}
        </div>
    </>;
};

interface ContextLabelProps {
    value: string;
    // if the user clicks on a path part, this will be called with rooted path part (e.g. "foo/bar")
    onClickPart?: (rootedPart: string) => void;
};


export const ContextLabel = ({ value, onClickPart }: ContextLabelProps) => {
    // Split on slash and filter out any empty segments
    const parts = value.split("/").filter((x) => x.length > 0)

    return (
        <span className="contextLabelContainer">
            {parts.map((part, index) => {
                const color = getHashedColor(part)
                const bgcolor = getHashedColor(part, { alpha: "0.1" })
                const rooted = "/" + parts.slice(0, index + 1).join("/");

                // construct the sub-path from the start up to this index
                const handlePartClick = () => {
                    if (!onClickPart) return
                    onClickPart(rooted)
                }

                return (
                    <React.Fragment key={index}>
                        <MuiTooltip title={onClickPart ? `Show only ${rooted}` : `Context: ${rooted}`} disableInteractive>
                            <span
                                className={`contextLabelPart ${onClickPart && "interactable"}`}
                                style={{ color, backgroundColor: bgcolor, cursor: onClickPart ? "pointer" : undefined }}
                                onClick={onClickPart ? handlePartClick : undefined}
                            >
                                {part}
                            </span>
                        </MuiTooltip>
                        {index < parts.length - 1 && <span className="contextLabelSeparator">/</span>}
                    </React.Fragment>
                )
            })}
        </span>
    )
}

export const CMBar = ({ value01, color }: { value01: number, color?: string }) => {
    return <div style={{ width: "150px", height: "13px", backgroundColor: "#eee", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ width: `${value01 * 100}%`, height: "100%", backgroundColor: color }}></div>
    </div>;
};


export function getContextObjectTabData(
    items: GeneralActivityReportDetailPayload[] | null | undefined,
    getKey: (item: GeneralActivityReportDetailPayload) => string,
    getLabel: (item: GeneralActivityReportDetailPayload) => string,
    getHeadingIndicator: (item: GeneralActivityReportDetailPayload) => React.ReactNode,
): ContextObjectDistinctItem[] {
    if (!items) {
        //console.log(`no items; short circuit`);
        return [];
    }
    const distinctItems = [...new Set(items.map(getKey))];
    const itemCount = items.length;
    const contextObjects = distinctItems.map((distinctItem) => {
        const filteredItems = items.filter((item) => getKey(item) === distinctItem);
        return {
            key: distinctItem,
            headingIndicator: getHeadingIndicator(filteredItems[0]!),
            label: getLabel(filteredItems[0]!),
            itemCount: filteredItems.length,
            totalCount: itemCount,
            percentageOfTotal: `${(filteredItems.length * 100 / itemCount).toFixed()}%`,
            items: filteredItems,
        };
    });
    return toSorted(contextObjects, (a, b) => b.itemCount - a.itemCount);
}

export const BrowserChip = ({
    value,
    tooltip,
    filtering,
    ...props
}: {
    value: string | null | undefined;
    tooltip?: CMAdhocChipProps['tooltip'];
    filtering?: CMAdhocChipProps['filtering'];
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
}) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = BrowserIconMap[value as Browsers];
    if (!relUri) return <div className="adHocChip">{value}</div>;

    return (
        <CMAdhocChip
            startIcon={<img src={relUri} width={24} height={24} />}
            tooltip={{
                showDefault: true,  // Show browser name by default
                ...tooltip          // Allow overrides
            }}
            filtering={filtering}
            {...props}
        >
            {value}
        </CMAdhocChip>
    );
}

export const OperatingSystemChip = ({
    value,
    tooltip,
    filtering,
    ...props
}: {
    value: string | null | undefined;
    tooltip?: CMAdhocChipProps['tooltip'];
    filtering?: CMAdhocChipProps['filtering'];
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
}) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = OSIconMap[value as OperatingSystem];
    if (!relUri) return <div className="adHocChip">{value}</div>;

    return (
        <CMAdhocChip
            startIcon={<img src={relUri} width={24} height={24} />}
            tooltip={{
                showDefault: true,
                ...tooltip
            }}
            filtering={filtering}
            {...props}
        >
            {value}
        </CMAdhocChip>
    );
}

export const PointerTypeChip = ({
    value,
    tooltip,
    filtering,
    ...props
}: {
    value: string | null | undefined;
    tooltip?: CMAdhocChipProps['tooltip'];
    filtering?: CMAdhocChipProps['filtering'];
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
}) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = PointerTypeIconMap[value as PointerTypes];
    if (!relUri) return <div className="adHocChip">{value}</div>;

    return (
        <CMAdhocChip
            startIcon={<img src={relUri} width={24} height={24} />}
            tooltip={{
                showDefault: true,
                ...tooltip
            }}
            filtering={filtering}
            {...props}
        >
            {value}
        </CMAdhocChip>
    );
}

export const DeviceClassChip = ({
    value,
    tooltip,
    filtering,
    ...props
}: {
    value: string | null | undefined;
    tooltip?: CMAdhocChipProps['tooltip'];
    filtering?: CMAdhocChipProps['filtering'];
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
}) => {
    if (IsNullOrWhitespace(value)) return null;
    const relUri = DeviceClassIconMap[value as DeviceClasses];
    if (!relUri) return <div className="adHocChip">{value}</div>;

    return (
        <CMAdhocChip
            startIcon={<img src={relUri} width={24} height={24} />}
            tooltip={{
                showDefault: true,
                ...tooltip
            }}
            filtering={filtering}
            {...props}
        >
            {value}
        </CMAdhocChip>
    );
}
