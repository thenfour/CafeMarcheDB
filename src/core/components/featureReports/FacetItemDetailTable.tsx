import { smartTruncate } from "@/shared/utils";
import { useQuery } from "@blitzjs/rpc";
import { Tooltip as MuiTooltip } from "@mui/material";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip } from "../CMChip";
import { AttendanceChip, FileChip, InstrumentChip, SongChip, WikiPageChip } from "../CMCoreComponents";
import { AdminInspectObject, CMSmallButton } from "../CMCoreComponents2";
import { AgeRelativeToNow } from "../DateTime/RelativeTimeComponents";
//
import { TGetFeatureReportDetailResult } from "./activityReportTypes";
import { ActivityFeature } from "./activityTracking";
import { gClientFacetHandlers, FilterableChip } from "./ClientFacetHandlers";
import { AnonymizedUserChip, BrowserChip, ContextLabel, DeviceClassChip, FeatureLabel, OperatingSystemChip, PointerTypeChip } from "./FeatureReportBasics";
import getDetail from "./queries/getDetail";
import { FeatureReportFilterSpec } from "./server/facetProcessor";
import { EventChip } from "../event/EventChips";


interface FacetItemDetailTableRowProps {
    value: TGetFeatureReportDetailResult['rows'][0];
    index: number;
    filterSpec: FeatureReportFilterSpec;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
};

const FacetItemDetailTableRow = ({ value, index, ...props }: FacetItemDetailTableRowProps) => {
    const feature = value.feature as ActivityFeature;

    return <tr className="GeneralFeatureReportDetailItemRow">
        <td style={{ fontFamily: "var(--ff-mono)" }}>
            <AdminInspectObject src={value} />
            <span>#{index}</span>
        </td>
        <td>
            <MuiTooltip title={<AgeRelativeToNow value={value.createdAt} />} disableInteractive>
                <span>{value.createdAt.toLocaleString()}</span>
            </MuiTooltip>
        </td>
        <td>{value.userHash && <AnonymizedUserChip value={value.userHash} />}</td>
        <td>{value.context && <ContextLabel value={value.context} onClickPart={(part) => {
            props.setFilterSpec(gClientFacetHandlers.contexts.addFilter(props.filterSpec, {
                count: 0,
                context: part,
            }));
        }} />}</td>
        <td>
            <FilterableChip
                item={{ feature: feature, count: 0 }}
                handler={gClientFacetHandlers.features}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <FeatureLabel feature={feature} />
            </FilterableChip>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
            {value.queryText && <span className="queryText">"<span className="actualQueryText">{value.queryText}</span>"</span>}
        </td>
        <td>
            {value.song && <FilterableChip
                item={{ songId: value.song.id, name: value.song.name, count: 0 }}
                handler={gClientFacetHandlers.songs}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />
            </FilterableChip>}
            {value.event && <FilterableChip
                item={{ eventId: value.event.id, name: value.event.name, startsAt: value.event.startsAt, statusId: value.event.statusId, typeId: value.event.typeId, count: 0 }}
                handler={gClientFacetHandlers.events}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />
            </FilterableChip>}
            {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
            {value.wikiPage && <FilterableChip
                item={{ wikiPageId: value.wikiPage.id, slug: value.wikiPage.slug, count: 0 }}
                handler={gClientFacetHandlers.wikiPages}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />
            </FilterableChip>}

            {value.eventSegmentId && <CMChip>Segment #{value.eventSegmentId}</CMChip>}
            {value.customLinkId && <FilterableChip
                item={{ customLinkId: value.customLinkId, name: `#${value.customLinkId}`, count: 0 }}
                handler={gClientFacetHandlers.customLinks}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <CMChip>Custom link #{value.customLinkId}</CMChip>
            </FilterableChip>}
            {value.eventSongListId && <CMChip>Setlist #{value.eventSongListId}</CMChip>}
            {value.frontpageGalleryItemId && <CMChip>Gallery item #{value.frontpageGalleryItemId}</CMChip>}
            {value.menuLinkId && <FilterableChip
                item={{ menuLinkId: value.menuLinkId, name: `#${value.menuLinkId}`, count: 0 }}
                handler={gClientFacetHandlers.menuLinks}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <CMChip>Menu link #{value.menuLinkId}</CMChip>
            </FilterableChip>}
            {value.setlistPlanId && <CMChip>Setlist plan #{value.setlistPlanId}</CMChip>}
            {value.songCreditTypeId && <CMChip>Song credit #{value.songCreditTypeId}</CMChip>}

            {value.attendanceId && <AttendanceChip
                value={value.attendanceId}
                event={value.event || undefined}
                eventSegment={value.eventSegment || undefined}
            />}
            {value.instrumentId && <InstrumentChip value={value.instrumentId} />}
        </td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
        <td>
            {value.locale && <FilterableChip
                item={{ locale: value.locale, count: 0 }}
                handler={gClientFacetHandlers.locales}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <div className="adHocChipContainer">
                    <div className="adHocChip">{value.locale}</div>
                </div>
            </FilterableChip>}
        </td >
        <td>
            <div className="adHocChipContainer">
                {value.pointerType && <FilterableChip
                    item={{ pointerType: value.pointerType as any, count: 0 }}
                    handler={gClientFacetHandlers.pointerTypes}
                    filterSpec={props.filterSpec}
                    setFilterSpec={props.setFilterSpec}
                >
                    <PointerTypeChip value={value.pointerType} />
                </FilterableChip>}
                {value.deviceClass && <FilterableChip
                    item={{ deviceClass: value.deviceClass as any, count: 0 }}
                    handler={gClientFacetHandlers.deviceClasses}
                    filterSpec={props.filterSpec}
                    setFilterSpec={props.setFilterSpec}
                >
                    <DeviceClassChip value={value.deviceClass} />
                </FilterableChip>}
                {value.operatingSystem && <FilterableChip
                    item={{ operatingSystem: value.operatingSystem, count: 0 }}
                    handler={gClientFacetHandlers.operatingSystems}
                    filterSpec={props.filterSpec}
                    setFilterSpec={props.setFilterSpec}
                >
                    <OperatingSystemChip value={value.operatingSystem} />
                </FilterableChip>}
            </div>
        </td>
        <td>
            {value.browserName && <FilterableChip
                item={{ browserName: value.browserName, count: 0 }}
                handler={gClientFacetHandlers.browsers}
                filterSpec={props.filterSpec}
                setFilterSpec={props.setFilterSpec}
            >
                <BrowserChip value={value.browserName} />
            </FilterableChip>}
        </td>
    </tr >;
};

interface FacetItemDetailTableProps {
    filterSpec: FeatureReportFilterSpec;
    refreshTrigger: number;
    setFilterSpec: (spec: FeatureReportFilterSpec) => void;
};

export const FacetItemDetailTable = ({ filterSpec, refreshTrigger, ...props }: FacetItemDetailTableProps) => {

    const [items, { refetch }] = useQuery(getDetail, {
        filterSpec,
        refreshTrigger,
    });

    if (!items) {
        return <div>Loading...</div>;
    }

    return <><table className="FacetItemDetailTable">
        <thead>
            <tr>
                <th>#</th>
                <th>When</th>
                <th>User</th>
                <th>Context</th>
                <th>Feature</th>
                <th>Query</th>
                <th></th>
                <th>URI</th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {items.rows.map((item, index) => {
                //return <div>item....</div>;
                return <FacetItemDetailTableRow key={index} value={item} index={items.rows.length - index} filterSpec={filterSpec} setFilterSpec={props.setFilterSpec} />;
            })}
        </tbody>
    </table>
        <CMSmallButton>{items.metrics.queryTimeMs} ms</CMSmallButton>
    </>;
}
