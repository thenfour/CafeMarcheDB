import React from "react";
import { Tooltip } from "@mui/material";
import Identicon from "react-identicons";
import { formatZonedDate } from "shared/dateTimePresentation";
import { getHashedColor } from "shared/utils";
import { useLocale } from "src/locale/components/useLocale";
import { CMChip } from "../CMChip";
import { CMButton, CMButtonGroup } from "../CMCoreComponents2";
import { EventChip } from "../event/EventChips";
import { SongChip } from "../song/SongChip";
import { WikiPageChip } from "../wiki/WikiPageChip";
import { FileReferenceChip } from "../file/FileChip";
import { gIconMap, RenderMuiIcon } from "../../db3/components/IconMap";
import type { ActivityDetailRow, ActivityEventReference, ActivityFacetItem, ActivityFacetKey, ActivityReportReferences } from "./activityReportTypes";
import { changeActivityFacetFilter, type ActivityReportFilters } from "./ClientFacetHandlers";
import { activityContextBreadcrumbs } from "./activityContext";

export function AnonymizedUserChip({ value }: { readonly value: string | null }) {
    const locale = useLocale();
    if (value === null) {
        return <span className="smallText">{locale.getPlainString("activityReports.anonymous")}</span>;
    }
    return <Tooltip title={value.slice(0, 8)} disableInteractive>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} data-activity-person={value}>
            <Identicon string={value} size={25} /><span>{value.slice(0, 8)}</span>
        </span>
    </Tooltip>;
}

function FilterableReference({ children, facet, referenceKey, filters, onChangeFilters }: React.PropsWithChildren<{
    readonly facet: ActivityFacetKey; readonly referenceKey: string; readonly filters: ActivityReportFilters;
    readonly onChangeFilters: (filters: ActivityReportFilters) => void;
}>) {
    const locale = useLocale();
    return <div data-activity-reference={facet} style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {children}
        <CMButtonGroup>{(["isolate", "hide"] as const).map(operation => <CMButton key={operation}
            aria-label={`${locale.getPlainString(`activityReports.${operation}`)}: ${locale.getPlainString(`activityReports.facet.${facet}`)}`}
            tooltip={`${locale.getPlainString(`activityReports.${operation}`)}: ${locale.getPlainString(`activityReports.facet.${facet}`)}`}
            style={{ padding: "2px 4px" }}
            onClick={() => onChangeFilters(changeActivityFacetFilter(filters, facet, operation, referenceKey))}>
            {operation === "isolate" ? gIconMap.Search() : gIconMap.VisibilityOff()}
        </CMButton>)}</CMButtonGroup>
    </div>;
}

export function ActivityScalarFilter({ facet, value, filters, onChangeFilters }: {
    readonly facet: "features" | "locales" | "languages" | "timezones" | "pointerTypes" | "deviceClasses" | "operatingSystems" | "browsers";
    readonly value: string; readonly filters: ActivityReportFilters; readonly onChangeFilters: (filters: ActivityReportFilters) => void;
}) {
    const locale = useLocale();
    const hideLabel = `${locale.getPlainString("activityReports.hide")}: ${locale.getPlainString(`activityReports.facet.${facet}`)}: ${value}`;
    return <CMButtonGroup>
        <CMButton tooltip={`${locale.getPlainString("activityReports.isolate")}: ${locale.getPlainString(`activityReports.facet.${facet}`)}`}
            onClick={() => onChangeFilters(changeActivityFacetFilter(filters, facet, "isolate", value))}>{value}</CMButton>
        <CMButton aria-label={hideLabel} tooltip={hideLabel} style={{ padding: "2px 4px" }}
            onClick={() => onChangeFilters(changeActivityFacetFilter(filters, facet, "hide", value))}>{gIconMap.VisibilityOff()}</CMButton>
    </CMButtonGroup>;
}

export function ContextLabel({ value, onClickPart }: { readonly value: string; readonly onClickPart: (prefix: string) => void }) {
    const locale = useLocale();
    return <span className="contextLabelContainer" data-activity-context={value} style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center" }}>
        {activityContextBreadcrumbs(value).map(part => <React.Fragment key={part.prefix}>
            {part.leadingSeparators}<CMButton
                aria-label={`${locale.getPlainString("activityReports.isolate")}: ${part.prefix}`}
                tooltip={`${locale.getPlainString("activityReports.isolate")}: ${part.prefix}`}
                style={{ color: getHashedColor(part.label), padding: "2px 4px", whiteSpace: "nowrap", flexShrink: 0 }}
                onClick={() => onClickPart(part.prefix)}>{part.label}</CMButton>{part.trailingSeparators}
        </React.Fragment>)}
    </span>;
}

function ActivityEventChip({ value, timeZone }: { readonly value: ActivityEventReference; readonly timeZone: string }) {
    const locale = useLocale();
    return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
        <EventChip value={value} showDate={false} useHashedColor />
        {value.startsAt && <time dateTime={value.startsAt.toISOString()} title={timeZone} style={{ whiteSpace: "nowrap" }}>
            {formatZonedDate({ value: value.startsAt, timeZone }, locale.formattingLocale ?? "en", { year: "numeric", month: "2-digit", day: "2-digit" })}
        </time>}
    </div>;
}

export function ActivityReferenceChips({ row, timeZone, ...filters }: {
    readonly row: ActivityDetailRow; readonly filters: ActivityReportFilters; readonly onChangeFilters: (filters: ActivityReportFilters) => void;
    readonly timeZone: string;
}) {
    const locale = useLocale();
    return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {row.song && <FilterableReference facet="songs" referenceKey={row.song.publicId} {...filters}><SongChip value={row.song} useHashedColor /></FilterableReference>}
        {row.event && <FilterableReference facet="events" referenceKey={row.event.publicId} {...filters}><ActivityEventChip value={row.event} timeZone={timeZone} /></FilterableReference>}
        {row.wikiPage && <FilterableReference facet="wikiPages" referenceKey={row.wikiPage.publicId} {...filters}><WikiPageChip slug={row.wikiPage.slug} useHashedColor /></FilterableReference>}
        {row.menuLink && <FilterableReference facet="menuLinks" referenceKey={row.menuLink.publicId} {...filters}><CMChip>{row.menuLink.caption}</CMChip></FilterableReference>}
        {row.customLink && <FilterableReference facet="customLinks" referenceKey={row.customLink.publicId} {...filters}><CMChip>{row.customLink.name}</CMChip></FilterableReference>}
        {row.file && <div data-activity-reference="files"><FileReferenceChip value={row.file} /></div>}
        {row.eventSegment && <CMChip>{locale.getPlainString("activityReports.reference.segment")}: {row.eventSegment.name}</CMChip>}
        {row.eventSongList && <CMChip>{locale.getPlainString("activityReports.reference.setlist")}: {row.eventSongList.name}</CMChip>}
        {row.frontpageGalleryItem && <CMChip>{locale.getPlainString("activityReports.reference.gallery")}: {row.frontpageGalleryItem.publicId}</CMChip>}
        {row.setlistPlan && <CMChip>{locale.getPlainString("activityReports.reference.plan")}: {row.setlistPlan.name}</CMChip>}
        {row.songCreditType && <CMChip color={row.songCreditType.color}>{locale.getPlainString("activityReports.reference.creditType")}: {row.songCreditType.name}</CMChip>}
        {row.attendance && <CMChip color={row.attendance.color} shape="rectangle" tooltip={row.attendance.description}>
            {row.attendance.iconName && RenderMuiIcon(row.attendance.iconName)}{row.attendance.buttonCaption}
        </CMChip>}
        {row.instrument && <CMChip color={row.instrument.color}>{locale.getPlainString("activityReports.reference.instrument")}: {row.instrument.name}</CMChip>}
    </div>;
}

export function ActivityFacetLabel({ facet, item, references, timeZone }: {
    readonly facet: ActivityFacetKey; readonly item: ActivityFacetItem; readonly references: ActivityReportReferences;
    readonly timeZone: string;
}) {
    switch (facet) {
        case "users":
            return <AnonymizedUserChip value={item.key} />;
        case "songs": {
            const row = references.songs.find(row => row.publicId === item.key);
            return row ? <SongChip value={row} useHashedColor /> : <>{item.label}</>;
        }
        case "events": {
            const row = references.events.find(row => row.publicId === item.key);
            return row ? <ActivityEventChip value={row} timeZone={timeZone} /> : <>{item.label}</>;
        }
        case "wikiPages": {
            const row = references.wikiPages.find(row => row.publicId === item.key);
            return row ? <WikiPageChip slug={row.slug} useHashedColor /> : <>{item.label}</>;
        }
        default:
            return <CMChip>{item.label}</CMChip>;
    }
}

// MIGRATION_RESTORE: activity-reports
// Source: 9306d02db399b172ad5e9957c64e5930054faae8:src/core/components/featureReports/FeatureReportBasics.tsx:1-569
// Reason: Legacy activity readers lack selected-band ownership and localized reference contracts, blocking application recovery.
// Restore: Restore activity timelines, facets, filters, drill-down details and CSV export with fresh authorization, explicit band ownership, localized references and public identities; preserve anonymization and redaction.
// Verification: Reactivate the preserved projection/filter specifications; test two bands, platform policy, grant revocation, anonymization, private references, CSV and browser report navigation/context switches.
// SHA256: c7129f63f3d8a529e71e06d8b739003d4e6d88661122fbdebe9ddd8d749a34e3
// MIGRATION_REFERENCE_BEGIN
// import { clearArray, toSorted } from "@/shared/arrayUtils";
// import { getHashedColor, IsNullOrWhitespace } from "@/shared/utils";
// import { Tooltip as MuiTooltip } from "@mui/material";
// import * as React from 'react';
// import Identicon from 'react-identicons';
// import { CMChip } from "../CMChip";
// import { CMSmallButton } from "../CMCoreComponents2";
// //
// import { ActivityDetailTabId, FacetResultBase, GeneralActivityReportDetailPayload } from "./activityReportTypes";
// import { ActivityFeature, BrowserIconMap, Browsers, DeviceClasses, DeviceClassIconMap, OperatingSystem, OSIconMap, PointerTypeIconMap, PointerTypes } from "./activityTracking";
// import { FeatureReportFilterSpec } from "./server/facetProcessor";
// import { ColorPaletteEntry, gGeneralPaletteList, gLightSwatchColors, gSwatchColors } from "../color/palette";
//
// export const CMAdhocChipContainer = ({ children }: { children: React.ReactNode }) => {
//     return <div className="adHocChipContainer">
//         {children}
//     </div>;
// }
//
// // Forward declaration to avoid circular imports
// interface FacetHandler<Tpayload extends FacetResultBase, TKey> {
//     supportsDrilldown: boolean;
//     getFacetName: () => string;
//     addFilter: (filterSpec: FeatureReportFilterSpec, item: Tpayload) => FeatureReportFilterSpec;
//     includedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];
//     excludedItemsSelector: (filterSpec: FeatureReportFilterSpec) => TKey[];
//     itemFromKey: (key: TKey) => Tpayload;
//     getItemKey: (item: Tpayload) => TKey;
//     getItemLabel: (item: Tpayload) => string;
//     getItemColor: (item: Tpayload, alpha?: string) => string;
// }
//
// export interface CMAdhocChipProps {
//     children: React.ReactNode;
//     startIcon?: React.ReactNode;
//     style?: React.CSSProperties;
//     className?: string;
//     onClick?: () => void;
//
//     // Enhanced tooltip configuration
//     tooltip?: {
//         content?: React.ReactNode;           // Custom tooltip content
//         showDefault?: boolean;               // Show default tooltip (children content)
//         layout?: 'stacked' | 'inline';      // How to arrange content + actions
//     };
//
//     // Enhanced filtering configuration
//     filtering?: {
//         handler: FacetHandler<any, any>;
//         item: any;
//         filterSpec: FeatureReportFilterSpec;
//         setFilterSpec: (fs: FeatureReportFilterSpec) => void;
//         showActions?: boolean;               // Whether to show isolate/hide buttons
//     };
// };
//
// // Local implementation of FacetItemActions to avoid circular imports
// const FacetItemActions = ({ item, handler, filterSpec, setFilterSpec }: {
//     item: any;
//     handler: FacetHandler<any, any>;
//     filterSpec: FeatureReportFilterSpec;
//     setFilterSpec: (fs: FeatureReportFilterSpec) => void;
// }) => {
//     if (!handler.supportsDrilldown) return null;
//
//     const isolateButton = <CMSmallButton
//         variant="technical"
//         onClick={(e) => {
//             e.stopPropagation(); // Prevent event bubbling to parent click handlers
//             const newFilterSpec = { ...filterSpec };
//             const includedItems = handler.includedItemsSelector(newFilterSpec);
//             const excludedItems = handler.excludedItemsSelector(newFilterSpec);
//             clearArray(includedItems);
//             clearArray(excludedItems);
//             includedItems.push(handler.getItemKey(item));
//             setFilterSpec(newFilterSpec);
//         }}
//     >
//         [+] isolate
//     </CMSmallButton>;
//
//     const hideButton = <CMSmallButton
//         variant="technical"
//         onClick={(e) => {
//             e.stopPropagation(); // Prevent event bubbling to parent click handlers
//             // add to exclude list
//             const newFilterSpec = { ...filterSpec };
//             const excludedItems = handler.excludedItemsSelector(newFilterSpec);
//
//             // ensure excludedItems contains the item's filter key.
//             const itemKey = handler.getItemKey(item);
//             if (!excludedItems.includes(itemKey)) {
//                 excludedItems.push(itemKey);
//             }
//
//             setFilterSpec(newFilterSpec);
//         }}
//     >
//         [-] hide
//     </CMSmallButton>;
//
//     return <CMAdhocChipContainer>
//         {isolateButton}
//         {hideButton}
//     </CMAdhocChipContainer>;
// };
//
// // Standard tooltip configuration for consistent behavior
// const standardTooltipProps = {
//     arrow: true,
//     placement: 'bottom' as const,
//     enterDelay: 300,
//     leaveDelay: 200,
//     PopperProps: {
//         modifiers: [{
//             name: 'offset',
//             options: { offset: [0, -8] }
//         }]
//     },
//     componentsProps: {
//         tooltip: {
//             sx: {
//                 bgcolor: 'white',
//                 color: 'text.primary',
//                 border: '1px solid #ccc',
//                 boxShadow: 3,
//                 padding: '8px 12px',
//                 borderRadius: '6px',
//                 maxWidth: '300px',
//                 '& .MuiTooltip-arrow': {
//                     color: 'white',
//                     '&::before': {
//                         border: '1px solid #ccc'
//                     }
//                 }
//             }
//         }
//     }
// };
//
// export const CMAdhocChip = React.forwardRef<HTMLDivElement, CMAdhocChipProps>((props, ref) => {
//     // Build consolidated tooltip content
//     const tooltipContent = React.useMemo(() => {
//         const parts: React.ReactNode[] = [];
//
//         // 1. Default information (children content)
//         if (props.tooltip?.showDefault !== false) {
//             parts.push(<div key="default">{props.children}</div>);
//         }
//
//         // 2. Custom tooltip content
//         if (props.tooltip?.content) {
//             parts.push(<div key="custom">{props.tooltip.content}</div>);
//         }
//
//         // 3. Filter actions (if filtering is enabled)
//         if (props.filtering && props.filtering.handler.supportsDrilldown) {
//             if (parts.length > 0) {
//                 parts.push(<div key="divider" style={{ borderTop: '1px solid #ddd', margin: '8px 0' }} />);
//             }
//             parts.push(
//                 <div key="actions">
//                     <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
//                         Filter Actions:
//                     </div>
//                     <FacetItemActions {...props.filtering} />
//                 </div>
//             );
//         }
//
//         return parts.length > 0 ? <div>{parts}</div> : null;
//     }, [props.children, props.tooltip, props.filtering]);
//
//     // The base chip element
//     const chipElement = (
//         <div
//             ref={ref}
//             className={`adHocChip ${props.className || ''} ${props.onClick ? 'interactable' : ''}`}
//             onClick={props.onClick}
//             style={props.style}
//         >
//             {props.startIcon && <div className="adHocChipStartIcon">{props.startIcon}</div>}
//             <div className="adHocChipContent">{props.children}</div>
//         </div>
//     );
//
//     // Wrap with tooltip if content exists
//     if (!tooltipContent) return chipElement;
//
//     return (
//         <MuiTooltip title={tooltipContent} {...standardTooltipProps}>
//             {chipElement}
//         </MuiTooltip>
//     );
// });
//
//
// export type ContextObjectDistinctItem = {
//     key: string,
//     headingIndicator: React.ReactNode;
//     label: string;
//     itemCount: number;
//     totalCount: number;
//     percentageOfTotal: string;
//     items: GeneralActivityReportDetailPayload[];
// };
//
//
// export type ContextObjectTabData = {
//     id: ActivityDetailTabId,
//     tabHeader: React.ReactNode,
//     items: ContextObjectDistinctItem[],
//     onIsolateFeature: (feature: ActivityFeature) => void;
//     onExcludeFeature: (feature: ActivityFeature) => void;
//     onFilterContext: (context: string) => void;
// };
//
//
// export const getColorForFeature = (feature: ActivityFeature | string): ColorPaletteEntry => {
//     const featureColorMap: Record<ActivityFeature, string> = {
//         [ActivityFeature.global_ical_digest]: gLightSwatchColors.light_blue,
//
//         [ActivityFeature.metronome_persistent]: gLightSwatchColors.light_gold,
//
//         [ActivityFeature.link_follow_external]: gLightSwatchColors.light_green,
//         [ActivityFeature.link_follow_internal]: gLightSwatchColors.light_green,
//
//         [ActivityFeature.event_change_custom_field]: gLightSwatchColors.light_orange,
//
//         [ActivityFeature.attendance_response]: gLightSwatchColors.light_brown,
//         [ActivityFeature.attendance_instrument]: gLightSwatchColors.light_brown,
//         [ActivityFeature.attendance_comment]: gLightSwatchColors.light_brown,
//         [ActivityFeature.attendance_explicit_invite]: gLightSwatchColors.light_brown,
//         [ActivityFeature.event_change_invite_tag]: gLightSwatchColors.light_brown,
//
//         [ActivityFeature.menu_link_update]: gLightSwatchColors.light_olive,
//         [ActivityFeature.menu_link_create]: gLightSwatchColors.light_olive,
//         [ActivityFeature.menu_link_reorder]: gLightSwatchColors.light_olive,
//         [ActivityFeature.menu_link_delete]: gLightSwatchColors.light_olive,
//
//         [ActivityFeature.custom_link_create]: gLightSwatchColors.light_citron,
//         [ActivityFeature.custom_link_update]: gLightSwatchColors.light_citron,
//         [ActivityFeature.custom_link_delete]: gLightSwatchColors.light_citron,
//
//         [ActivityFeature.event_segment_create]: gSwatchColors.blue,
//         [ActivityFeature.event_segment_edit]: gSwatchColors.blue,
//         [ActivityFeature.event_segment_delete]: gSwatchColors.blue,
//         [ActivityFeature.event_segment_reorder]: gSwatchColors.blue,
//
//         [ActivityFeature.event_view]: gLightSwatchColors.light_pink,
//         [ActivityFeature.event_create]: gSwatchColors.teal,
//         [ActivityFeature.event_edit]: gSwatchColors.teal,
//         [ActivityFeature.event_frontpage_edit]: gSwatchColors.teal,
//         [ActivityFeature.event_delete]: gSwatchColors.teal,
//         [ActivityFeature.event_change_relevance_class]: gSwatchColors.teal,
//
//         [ActivityFeature.qr_code_generate]: gSwatchColors.green,
//
//         [ActivityFeature.profile_view]: gSwatchColors.dark_gray,
//         [ActivityFeature.profile_edit]: gSwatchColors.dark_gray,
//         [ActivityFeature.profile_change_instrument]: gSwatchColors.dark_gray,
//         [ActivityFeature.profile_change_default_instrument]: gSwatchColors.dark_gray,
//
//         [ActivityFeature.login_email]: gSwatchColors.pink,
//         [ActivityFeature.login_google]: gSwatchColors.pink,
//         [ActivityFeature.logout]: gSwatchColors.pink,
//         [ActivityFeature.signup_email]: gSwatchColors.red,
//         [ActivityFeature.signup_google]: gSwatchColors.red,
//         [ActivityFeature.forgot_password]: gSwatchColors.red,
//
//         [ActivityFeature.wiki_page_view]: gSwatchColors.light_gray,
//         [ActivityFeature.wiki_edit]: gSwatchColors.light_gray,
//         [ActivityFeature.wiki_change_visibility]: gSwatchColors.light_gray,
//         [ActivityFeature.wiki_page_tag_update]: gSwatchColors.light_gray,
//
//         [ActivityFeature.frontpagegallery_reorder]: gSwatchColors.citron,
//         [ActivityFeature.frontpagegallery_item_create]: gSwatchColors.citron,
//         [ActivityFeature.frontpagegallery_item_edit]: gSwatchColors.citron,
//         [ActivityFeature.frontpagegallery_item_delete]: gSwatchColors.citron,
//         [ActivityFeature.frontpagegallery_item_change_visibility]: gSwatchColors.citron,
//
//         [ActivityFeature.file_download]: gSwatchColors.maroon,
//         [ActivityFeature.file_upload]: gSwatchColors.maroon,
//         [ActivityFeature.file_upload_url]: gSwatchColors.maroon,
//         [ActivityFeature.file_edit]: gSwatchColors.maroon,
//         [ActivityFeature.file_delete]: gSwatchColors.maroon,
//         [ActivityFeature.file_detail_view]: gSwatchColors.maroon,
//
//         [ActivityFeature.song_view]: gSwatchColors.purple,
//         [ActivityFeature.song_edit]: gSwatchColors.purple,
//         [ActivityFeature.song_edit_description]: gSwatchColors.purple,
//         [ActivityFeature.song_delete]: gSwatchColors.purple,
//         [ActivityFeature.song_create]: gSwatchColors.purple,
//         [ActivityFeature.song_credit_add]: gSwatchColors.purple,
//         [ActivityFeature.song_credit_edit]: gSwatchColors.purple,
//         [ActivityFeature.song_credit_delete]: gSwatchColors.purple,
//         [ActivityFeature.song_pin_recording]: gSwatchColors.purple,
//         [ActivityFeature.song_play]: gSwatchColors.purple,
//         [ActivityFeature.song_pause]: gSwatchColors.purple,
//
//         [ActivityFeature.setlist_plan_create]: gSwatchColors.black,
//         [ActivityFeature.setlist_plan_save]: gSwatchColors.black,
//         [ActivityFeature.setlist_plan_delete]: gSwatchColors.black,
//
//         [ActivityFeature.setlist_create]: gSwatchColors.teal,
//         [ActivityFeature.setlist_edit]: gSwatchColors.teal,
//         [ActivityFeature.setlist_delete]: gSwatchColors.teal,
//         [ActivityFeature.setlist_reorder]: gSwatchColors.teal,
//
//         [ActivityFeature.media_player_bar_close]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_next]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_previous]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_pull_playlist]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_play]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_pause]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_play_vis_segment]: gSwatchColors.olive,
//         [ActivityFeature.media_player_bar_seek_vis_segment]: gSwatchColors.olive,
//     };
//
//     //return featureColorMap[feature] || gGeneralPaletteList.defaultEntry.strong.foregroundColor;
//     return gGeneralPaletteList.findEntry(featureColorMap[feature]) || gGeneralPaletteList.defaultEntry;
// }
//
// export const AnonymizedUserChip = ({ value, size = 25 }: { value: string, size?: number }) => {
//     return <MuiTooltip title={value.substring(0, 6)} disableInteractive>
//         <div style={{ display: "flex", alignItems: "center", padding: "0px", margin: "2px", backgroundColor: "white", borderRadius: "4px" }}>
//             <Identicon string={value} size={size} />
//         </div>
//     </MuiTooltip>;
// }
//
// interface FeatureLabelProps {
//     feature: ActivityFeature | string;
//     onClickIsolate?: () => void;
//     onClickExclude?: () => void;
// }
//
// export const FeatureLabel = (props: FeatureLabelProps) => {
//     //const featureColor = getHashedColor(props.feature);
//     const color = getColorForFeature(props.feature);
//
//     return <>
//         <div
//             style={{ display: "flex", alignItems: "center" }}
//         >
//             {/* <span>{props.feature}</span> */}
//             <CMChip
//                 color={color}
//                 size="small"
//                 shape="rectangle"
//             //onClick={props.onClickIsolate ? (() => props.onClickIsolate!()) : undefined}
//             //tooltip={`Isolate ${props.feature}`}
//             >{props.feature}</CMChip>
//             {/* <span className="flex-spacer"></span> */}
//             {/* <span>
//                 <MuiTooltip title={`Hide / exclude ${props.feature}`} disableInteractive>
//                     <span>
//                         <CMSmallButton onClick={props.onClickExclude}>hide</CMSmallButton>
//                     </span>
//                 </MuiTooltip>
//             </span> */}
//         </div>
//     </>;
// };
//
// interface ContextLabelProps {
//     value: string;
//     // if the user clicks on a path part, this will be called with rooted path part (e.g. "foo/bar")
//     onClickPart?: (rootedPart: string) => void;
// };
//
//
// export const ContextLabel = ({ value, onClickPart }: ContextLabelProps) => {
//     // Split on slash and filter out any empty segments
//     const parts = value.split("/").filter((x) => x.length > 0)
//
//     return (
//         <span className="contextLabelContainer">
//             {parts.map((part, index) => {
//                 const color = getHashedColor(part)
//                 const bgcolor = getHashedColor(part, { alpha: "0.1" })
//                 const rooted = "/" + parts.slice(0, index + 1).join("/");
//
//                 // construct the sub-path from the start up to this index
//                 const handlePartClick = () => {
//                     if (!onClickPart) return
//                     onClickPart(rooted)
//                 }
//
//                 return (
//                     <React.Fragment key={index}>
//                         <MuiTooltip title={onClickPart ? `Show only ${rooted}` : `Context: ${rooted}`} disableInteractive>
//                             <span
//                                 className={`contextLabelPart ${onClickPart && "interactable"}`}
//                                 style={{ color, backgroundColor: bgcolor, cursor: onClickPart ? "pointer" : undefined }}
//                                 onClick={onClickPart ? handlePartClick : undefined}
//                             >
//                                 {part}
//                             </span>
//                         </MuiTooltip>
//                         {index < parts.length - 1 && <span className="contextLabelSeparator">/</span>}
//                     </React.Fragment>
//                 )
//             })}
//         </span>
//     )
// }
//
// export const CMBar = ({ value01, color }: { value01: number, color?: string }) => {
//     return <div style={{ width: "150px", height: "13px", backgroundColor: "#eee", borderRadius: "2px", overflow: "hidden" }}>
//         <div style={{ width: `${value01 * 100}%`, height: "100%", backgroundColor: color }}></div>
//     </div>;
// };
//
//
// export function getContextObjectTabData(
//     items: GeneralActivityReportDetailPayload[] | null | undefined,
//     getKey: (item: GeneralActivityReportDetailPayload) => string,
//     getLabel: (item: GeneralActivityReportDetailPayload) => string,
//     getHeadingIndicator: (item: GeneralActivityReportDetailPayload) => React.ReactNode,
// ): ContextObjectDistinctItem[] {
//     if (!items) {
//         //console.log(`no items; short circuit`);
//         return [];
//     }
//     const distinctItems = [...new Set(items.map(getKey))];
//     const itemCount = items.length;
//     const contextObjects = distinctItems.map((distinctItem) => {
//         const filteredItems = items.filter((item) => getKey(item) === distinctItem);
//         return {
//             key: distinctItem,
//             headingIndicator: getHeadingIndicator(filteredItems[0]!),
//             label: getLabel(filteredItems[0]!),
//             itemCount: filteredItems.length,
//             totalCount: itemCount,
//             percentageOfTotal: `${(filteredItems.length * 100 / itemCount).toFixed()}%`,
//             items: filteredItems,
//         };
//     });
//     return toSorted(contextObjects, (a, b) => b.itemCount - a.itemCount);
// }
//
// export const BrowserChip = ({
//     value,
//     tooltip,
//     filtering,
//     ...props
// }: {
//     value: string | null | undefined;
//     tooltip?: CMAdhocChipProps['tooltip'];
//     filtering?: CMAdhocChipProps['filtering'];
//     style?: React.CSSProperties;
//     className?: string;
//     onClick?: () => void;
// }) => {
//     if (IsNullOrWhitespace(value)) return null;
//     const relUri = BrowserIconMap[value as Browsers];
//     if (!relUri) return <div className="adHocChip">{value}</div>;
//
//     return (
//         <CMAdhocChip
//             startIcon={<img src={relUri} width={24} height={24} />}
//             tooltip={{
//                 showDefault: true,  // Show browser name by default
//                 ...tooltip          // Allow overrides
//             }}
//             filtering={filtering}
//             {...props}
//         >
//             {value}
//         </CMAdhocChip>
//     );
// }
//
// export const OperatingSystemChip = ({
//     value,
//     tooltip,
//     filtering,
//     ...props
// }: {
//     value: string | null | undefined;
//     tooltip?: CMAdhocChipProps['tooltip'];
//     filtering?: CMAdhocChipProps['filtering'];
//     style?: React.CSSProperties;
//     className?: string;
//     onClick?: () => void;
// }) => {
//     if (IsNullOrWhitespace(value)) return null;
//     const relUri = OSIconMap[value as OperatingSystem];
//     if (!relUri) return <div className="adHocChip">{value}</div>;
//
//     return (
//         <CMAdhocChip
//             startIcon={<img src={relUri} width={24} height={24} />}
//             tooltip={{
//                 showDefault: true,
//                 ...tooltip
//             }}
//             filtering={filtering}
//             {...props}
//         >
//             {value}
//         </CMAdhocChip>
//     );
// }
//
// export const PointerTypeChip = ({
//     value,
//     tooltip,
//     filtering,
//     ...props
// }: {
//     value: string | null | undefined;
//     tooltip?: CMAdhocChipProps['tooltip'];
//     filtering?: CMAdhocChipProps['filtering'];
//     style?: React.CSSProperties;
//     className?: string;
//     onClick?: () => void;
// }) => {
//     if (IsNullOrWhitespace(value)) return null;
//     const relUri = PointerTypeIconMap[value as PointerTypes];
//     if (!relUri) return <div className="adHocChip">{value}</div>;
//
//     return (
//         <CMAdhocChip
//             startIcon={<img src={relUri} width={24} height={24} />}
//             tooltip={{
//                 showDefault: true,
//                 ...tooltip
//             }}
//             filtering={filtering}
//             {...props}
//         >
//             {value}
//         </CMAdhocChip>
//     );
// }
//
// export const DeviceClassChip = ({
//     value,
//     tooltip,
//     filtering,
//     ...props
// }: {
//     value: string | null | undefined;
//     tooltip?: CMAdhocChipProps['tooltip'];
//     filtering?: CMAdhocChipProps['filtering'];
//     style?: React.CSSProperties;
//     className?: string;
//     onClick?: () => void;
// }) => {
//     if (IsNullOrWhitespace(value)) return null;
//     const relUri = DeviceClassIconMap[value as DeviceClasses];
//     if (!relUri) return <div className="adHocChip">{value}</div>;
//
//     return (
//         <CMAdhocChip
//             startIcon={<img src={relUri} width={24} height={24} />}
//             tooltip={{
//                 showDefault: true,
//                 ...tooltip
//             }}
//             filtering={filtering}
//             {...props}
//         >
//             {value}
//         </CMAdhocChip>
//     );
// }
// MIGRATION_REFERENCE_END
