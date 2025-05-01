import { smartTruncate } from "@/shared/utils";
import { useQuery } from "@blitzjs/rpc";
import { Tooltip as MuiTooltip } from "@mui/material";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip } from "../CMChip";
import { AdminInspectObject, AttendanceChip, EventChip, FileChip, InstrumentChip, SongChip, WikiPageChip } from "../CMCoreComponents";
import { CMSmallButton } from "../CMCoreComponents2";
import { AgeRelativeToNow } from "../RelativeTimeComponents";
//
import { TGetFeatureReportDetailResult } from "./activityReportTypes";
import { ActivityFeature } from "./activityTracking";
import { gClientFacetHandlers } from "./ClientFacetHandlers";
import { AnonymizedUserChip, BrowserChip, ContextLabel, DeviceClassChip, FeatureLabel, OperatingSystemChip, PointerTypeChip } from "./FeatureReportBasics";
import getDetail from "./queries/getDetail";
import { FeatureReportFilterSpec } from "./server/facetProcessor";


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
        <td><FeatureLabel feature={feature} /></td>
        <td style={{ whiteSpace: "nowrap" }}>
            {value.queryText && <span className="queryText">"<span className="actualQueryText">{value.queryText}</span>"</span>}
        </td>
        <td>
            {value.song && <SongChip value={value.song} startAdornment={gIconMap.MusicNote()} useHashedColor={true} />}
            {value.event && <EventChip value={value.event} startAdornment={gIconMap.CalendarMonth()} useHashedColor={true} />}
            {value.file && <FileChip value={value.file} startAdornment={gIconMap.AttachFile()} useHashedColor={true} />}
            {value.wikiPage && <WikiPageChip slug={value.wikiPage.slug} startAdornment={gIconMap.Article()} useHashedColor={true} />}

            {value.eventSegmentId && <CMChip>Segment #{value.eventSegmentId}</CMChip>}
            {value.customLinkId && <CMChip>Custom link #{value.customLinkId}</CMChip>}
            {value.eventSongListId && <CMChip>Setlist #{value.eventSongListId}</CMChip>}
            {value.frontpageGalleryItemId && <CMChip>Gallery item #{value.frontpageGalleryItemId}</CMChip>}
            {value.menuLinkId && <CMChip>Menu link #{value.menuLinkId}</CMChip>}
            {value.setlistPlanId && <CMChip>Setlist plan #{value.setlistPlanId}</CMChip>}
            {value.songCreditTypeId && <CMChip>Song credit #{value.songCreditTypeId}</CMChip>}

            {value.attendanceId && <AttendanceChip value={value.attendanceId} />}
            {value.instrumentId && <InstrumentChip value={value.instrumentId} />}
        </td>
        <td>{value.uri && <a href={value.uri} target="_blank" rel="noreferrer" >{smartTruncate(value.uri, 60)}</a>}</td>
        <td>
            {value.locale && <div className="adHocChipContainer">
                <div className="adHocChip">{value.locale}</div>
            </div>}
        </td >
        <td>
            <div className="adHocChipContainer">
                <PointerTypeChip value={value.pointerType} />
                <DeviceClassChip value={value.deviceClass} />
                <OperatingSystemChip value={value.operatingSystem} />
            </div>
        </td>
        <td>
            <BrowserChip value={value.browserName} />
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

    return <><table>
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
