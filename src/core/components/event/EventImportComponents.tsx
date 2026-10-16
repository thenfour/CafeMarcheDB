import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { useQuery } from "@blitzjs/rpc";
import React from "react";
import { Permission } from "shared/permissions";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import getImportEventData from "src/core/db3/queries/getImportEventData";
import { ZinsertEventArgs, type TGetImportEventDataArgs, type TGetImportEventDataRet } from "src/core/db3/shared/apiTypes";
import { useLocale } from "src/locale/components/useLocale";
import { CMButton, EventDateField, NameValuePair } from "../CMCoreComponents2";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { useSnackbar } from "../SnackbarContext";
import { VisibilityControl } from "../VisibilityControl";
import { AttendanceChipTooltipContent, AttendanceChipView } from "./AttendanceChipView";
import { EventTableClientColumns } from "./EventComponentsBase";
import { EventSegmentClientColumns } from "./EventSegmentComponents";

type SavedImport = Awaited<ReturnType<typeof API.events.newEventMutation.invoke>>;
// Creation drafts have no persisted identity; their selected references use the dashboard display contract.
type EventDraft = Omit<TGetImportEventDataRet["event"], "tags"> & {
    tags: Array<db3.EventTagAssignmentClientPayload & { eventTag: db3.EventTagDashboardClient }>;
    type: db3.EventTypeDashboardClient | null;
    status: db3.EventStatusDashboardClient | null;
    expectedAttendanceUserTag: db3.UserTagDashboardClient | null;
    visiblePermission: db3.PermissionDashboardClient | null;
};
type SegmentDraft = Omit<TGetImportEventDataRet["segment"], "durationMillis"> & { durationMillis: bigint };

function savedImportDate(saved: SavedImport) {
    const { startsAt, durationMillis, isAllDay } = saved.segment;
    if (startsAt === undefined || durationMillis === undefined || isAllDay === undefined) {
        return null;
    }
    return <EventDateField dateRange={db3.getEventSegmentDateTimeRange({ startsAt, durationMillis, isAllDay })} />;
}

export function EventImportForm({ preview, onSave }: { preview: TGetImportEventDataRet; onSave: (saved: SavedImport) => void }) {
    const dashboard = useDashboardContext();
    const locale = useLocale();
    const snackbar = useSnackbar();
    const mutation = API.events.newEventMutation.useToken();
    const [saving, setSaving] = React.useState(false);
    const [event, setEvent] = React.useState<EventDraft>(() => ({
        ...preview.event, tags: [],
        type: dashboard.eventType.getById(preview.event.typeId),
        status: dashboard.eventStatus.getById(preview.event.statusId),
        expectedAttendanceUserTag: dashboard.userTag.getById(preview.event.expectedAttendanceUserTagId),
        visiblePermission: dashboard.permission.getById(preview.event.visiblePermissionId),
    }));
    const [segment, setSegment] = React.useState<SegmentDraft>(() => ({ ...preview.segment, durationMillis: BigInt(preview.segment.durationMillis) }));
    const eventSpec = DB3Client.defineTableClientSpec({
        view: db3.eventEditorView, columns: DB3Client.makeClientColumnSelection(
            EventTableClientColumns.name, EventTableClientColumns.type, EventTableClientColumns.status,
            EventTableClientColumns.tags, EventTableClientColumns.expectedAttendanceUserTag, EventTableClientColumns.visiblePermission,
        )
    });
    const segmentSpec = DB3Client.defineTableClientSpec({
        view: db3.eventSegmentEditorView,
        columns: DB3Client.makeClientColumnSelection(EventSegmentClientColumns.startsAt)
    });
    DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: eventSpec, referenceProvider: dashboard.referenceStore
    });
    DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: segmentSpec, referenceProvider: dashboard.referenceStore
    });
    const eventValidation = eventSpec.args.table.ValidateAndComputeDiff(event, event, "new");
    const segmentValidation = segmentSpec.args.table.ValidateAndComputeDiff(segment, segment, "new");
    const canSave = dashboard.isAuthorized(Permission.manage_events)
        && ["revision", "frontpageVisible"].every(columnName => db3.xEvent.authorizeColumnForInsert({
            auth: dashboard.authorization, model: null, columnName,
        })) && (preview.responses.length === 0 || dashboard.isAuthorized(Permission.change_others_event_responses));

    async function save() {
        if (saving) {
            return;
        }
        setSaving(true);
        try {
            const payload = ZinsertEventArgs.parse({
                bandPublicId: dashboard.requireBandPublicId(), routeLocale: dashboard.localePreferences.routeLocale,
                browserLanguages: [...dashboard.localePreferences.browserLanguages],
                event: {
                    name: event.name, locationDescription: event.locationDescription, typeId: event.type?.publicId ?? null,
                    statusId: event.status?.publicId ?? null, tags: event.tags.map(tag => tag.eventTag.publicId),
                    expectedAttendanceUserTagId: event.expectedAttendanceUserTag?.publicId ?? null,
                    visiblePermissionId: event.visiblePermission?.publicId ?? null
                },
                segment: { ...segment, durationMillis: Number(segment.durationMillis) },
                responses: preview.responses, songList: preview.songList,
            });
            const saved = await mutation.invoke(payload);
            snackbar.showMessage({ children: "insert successful", severity: "success" });
            onSave(saved);
        } catch {
            snackbar.showMessage({ children: locale.getPlainString("eventImport.saveFailed"), severity: "error" });
        } finally {
            setSaving(false);
        }
    }

    return <div className="NameValuePairList">
        <VisibilityControl value={event.visiblePermission ?? null} onChange={permission =>
            setEvent({ ...event, visiblePermission: permission, visiblePermissionId: permission?.publicId ?? null })} />
        {eventSpec.renderEditor("name", event, eventValidation, setEvent, true)}
        {segmentSpec.renderEditor("startsAt", segment, segmentValidation, setSegment, false)}
        {eventSpec.renderEditor("type", event, eventValidation, setEvent, false)}
        <NameValuePair name="Attendance" value={<ul className="attendanceList">
            {preview.responses.map(response => <li key={response.userId}>
                {`${response.userName ?? "?"} (${response.userId})`} : <AttendanceChipView
                    value={dashboard.eventAttendance.getById(response.attendanceId)}
                    tooltip={<AttendanceChipTooltipContent value={dashboard.eventAttendance.getById(response.attendanceId)} />} />
            </li>)}
        </ul>} />
        <NameValuePair name={`Set list (${preview.songList.length})`} value={<ol className="setlist">
            {preview.songList.map((song, index) => <li key={index}>{`${song.songName ?? "?"} (${song.songId})`} {song.comment}</li>)}
        </ol>} />
        {eventSpec.renderEditor("tags", event, eventValidation, setEvent, false)}
        {eventSpec.renderEditor("expectedAttendanceUserTag", event, eventValidation, setEvent, false)}
        {eventSpec.renderEditor("status", event, eventValidation, setEvent, false)}
        <CMButton disabled={saving || !canSave} onClick={() => { void save(); }}>{locale.getPlainString("eventImport.save")}</CMButton>
    </div>;
}

export function EventImportPreview({ args, onSave }: { args: TGetImportEventDataArgs; onSave: (saved: SavedImport) => void }) {
    const locale = useLocale();
    const [preview, info] = useQuery(getImportEventData, args, {
        suspense: false, useErrorBoundary: false, keepPreviousData: false, staleTime: 0, cacheTime: 0,
    });
    if (info.error) {
        return <div role="alert">{locale.getPlainString("eventImport.previewFailed")}</div>;
    }
    if (!preview || info.isFetching) {
        return <div className="querier suspended">{locale.getPlainString("eventImport.loading")}</div>;
    }
    return <>
        <EventImportForm preview={preview} onSave={onSave} />
        <pre className="log">{preview.log.join("\n")}</pre>
    </>;
}

export function ImportEventsPageContent() {
    const dashboard = useDashboardContext();
    const router = useCmdbRouter();
    const locale = useLocale();
    const [config, setConfig] = React.useState("y2023");
    const [text, setText] = React.useState(`26 October Rehearsal\npeter + guido + carl\nsmoke and mirrors\nt is proper dat\nzomeravond\nall you need is love\nten dans\npaper spaceships(feat.Pieter maes on e - hangdrum)\nrecordings`);
    const [history, setHistory] = React.useState<SavedImport[]>([]);
    const args: TGetImportEventDataArgs = {
        bandPublicId: dashboard.requireBandPublicId(),
        routeLocale: dashboard.localePreferences.routeLocale, browserLanguages: [...dashboard.localePreferences.browserLanguages], text, config
    };
    // A new input/context owns a fresh draft; an older preview can never remain saveable.
    const requestKey = JSON.stringify(args);
    return <div className="ImportEventsPageContent"><div className="twocolumns">
        <div className="leftColumn">
            <textarea className="configTxt" aria-label={locale.getPlainString("eventImport.config")} value={config} onChange={event => setConfig(event.target.value)} />
            <textarea className="eventTxt" aria-label={locale.getPlainString("eventImport.text")} value={text} onChange={event => setText(event.target.value)} />
            <ul className="history">{history.map(saved => <li key={saved.event.publicId}>
                <a href={router.getURIForEvent(saved.event)} target="_blank" rel="noreferrer">
                    {saved.event.publicId} / {savedImportDate(saved)} / {saved.event.name}
                </a>
            </li>)}</ul>
        </div>
        <div><EventImportPreview key={requestKey} args={args} onSave={saved => setHistory(previous => [saved, ...previous])} /></div>
    </div></div>;
}
