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
