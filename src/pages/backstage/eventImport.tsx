import db, { Prisma } from "db";
import { BlitzPage } from "@blitzjs/next";
import { Button, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import React, { Suspense, useRef, useState } from "react";
import { Permission } from "shared/permissions";
import { CalcRelativeTiming, DateTimeRange, gMillisecondsPerDay } from "shared/time";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMStandardDBChip, ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { EventDateField, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { DashboardContext } from "src/core/components/DashboardContext";
import { EventTableClientColumns } from "src/core/components/EventComponents";
import { EventSegmentClientColumns } from "src/core/components/EventSegmentComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl } from "src/core/components/VisibilityControl";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { TAnyModel, TGetImportEventDataRet, TinsertEventArgs } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { bigint } from "zod";
import { useQuery } from "@blitzjs/rpc";
import getImportEventData from "src/core/db3/queries/getImportEventData";
import { getURIForEvent } from "src/core/db3/clientAPILL";
import { Markdown } from "src/core/components/RichTextEditor";
import { useDebounce } from "shared/useDebounce";
import { DateTimeRangeControl } from "src/core/components/DateTimeRangeControl";

interface InsertResult {
    event: {
        id: number;
        name: string;
    },
    segment: {
        startsAt: Date | null,
    }
};

interface NewEventDialogProps {
    serverData: TGetImportEventDataRet | null;
    onSave: (x: InsertResult) => void;
};

const NewEventForm = (props: NewEventDialogProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const mut = API.events.newEventMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };
    const dashboardContext = React.useContext(DashboardContext);
    const [eventValue, setEventValue] = React.useState<db3.EventPayload>(() => {
        const ret = db3.xEvent.createNew(clientIntention) as Partial<db3.EventPayload>;
        return ret as any;
    });
    const [segmentValue, setSegmentValue] = React.useState<db3.EventSegmentPayload>(() => {
        const ret = db3.xEventSegment.createNew(clientIntention) as Partial<db3.EventSegmentPayload>;
        ret.isAllDay = true;
        ret.startsAt = new Date();
        ret.durationMillis = BigInt(gMillisecondsPerDay);
        return ret as any;
    });

    React.useEffect(() => {
        setSegmentValue({
            ...segmentValue,
            startsAt: props.serverData?.segment.startsAt || new Date(),
            durationMillis: BigInt(props.serverData?.segment.durationMillis || gMillisecondsPerDay),
        });
        setEventValue({
            ...eventValue,
            name: props.serverData?.event.name || "",
            description: props.serverData?.event.description || "",
            type: dashboardContext.eventType.getById(props.serverData?.event.typeId),
            typeId: props.serverData?.event.typeId || 1,
            status: dashboardContext.eventStatus.getById(props.serverData?.event.statusId),
            statusId: props.serverData?.event.statusId || null,
            expectedAttendanceUserTag: dashboardContext.userTag.getById(props.serverData?.event.expectedAttendanceUserTagId),
            expectedAttendanceUserTagId: props.serverData?.event.expectedAttendanceUserTagId || null,
            visiblePermission: dashboardContext.permission.getById(props.serverData?.event.visiblePermissionId) as any,
            visiblePermissionId: props.serverData?.event.visiblePermissionId || null,
        });
    }, [props.serverData]);


    // EVENT table bindings
    const eventTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            EventTableClientColumns.id,
            EventTableClientColumns.name,
            EventTableClientColumns.description,
            EventTableClientColumns.slug,
            EventTableClientColumns.type,
            EventTableClientColumns.status,
            EventTableClientColumns.tags,
            EventTableClientColumns.expectedAttendanceUserTag,
            EventTableClientColumns.visiblePermission,
        ],
    });

    // necessary to connect all the columns in the spec.
    const eventTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: eventTableSpec,
    });

    const eventAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...eventValue, ...fieldValues };
            setEventValue(newValue);
        },
    };

    const eventValidationResult = eventTableSpec.args.table.ValidateAndComputeDiff(eventValue, eventValue, "new", clientIntention);


    // EVENT SEGMENT BINDINGS
    const segmentTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.dateRange,
        ],
    });

    // necessary to connect all the columns in the spec.
    const segmentTableClient = DB3Client.useTableRenderContext({
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: segmentTableSpec,
    });

    const segmentAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...segmentValue, ...fieldValues };
            setSegmentValue(newValue);
        },
    };

    const segmentValidationResult = segmentTableSpec.args.table.ValidateAndComputeDiff(segmentValue, segmentValue, "new", clientIntention);

    const handleSaveClick = async () => {
        const payload: TinsertEventArgs = {
            event: eventTableClient.prepareInsertMutation(eventValue),
            segment: segmentTableClient.prepareInsertMutation(segmentValue),
            responses: props.serverData?.responses,
            songList: props.serverData?.songList,
        };
        mut.invoke(payload).then(async (ret) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            props.onSave(ret);
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
        });
    };

    const renderColumn = (table: DB3Client.xTableClientSpec, colName: string, row: TAnyModel, validationResult: db3.ValidateAndComputeDiffResult, api: DB3Client.NewDialogAPI, autoFocus: boolean) => {
        return table.getColumn(colName).renderForNewDialog!({ key: colName, row, validationResult, api, value: row[colName], clientIntention, autoFocus });
    };

    const range: DateTimeRange = new DateTimeRange({
        durationMillis: props.serverData?.segment.durationMillis || gMillisecondsPerDay,
        isAllDay: true,
        startsAtDateTime: props.serverData?.segment.startsAt || null,
    });

    return <div className="EventSongListValue">
        <VisibilityControl value={eventValue.visiblePermission} onChange={(newVisiblePermission) => {
            const newValue: db3.EventPayload = { ...eventValue, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
            setEventValue(newValue);
        }} />

        {renderColumn(eventTableSpec, "name", eventValue, eventValidationResult, eventAPI, true)}


        {/* {renderColumn(segmentTableSpec, "startsAt", segmentValue, segmentValidationResult, segmentAPI, false)} */}

        <NameValuePair
            name="Date"
            value={
                <div>
                    <EventDateField dateRange={range} />
                    <DateTimeRangeControl
                        items={[]}
                        onChange={(newValue) => {
                            const spec = newValue.getSpec();
                            setSegmentValue({
                                ...segmentValue,
                                startsAt: spec.startsAtDateTime,
                                durationMillis: BigInt(spec.durationMillis),
                                isAllDay: spec.isAllDay,
                            });
                        }}
                        value={db3.getEventSegmentDateTimeRange(segmentValue)}
                    />
                </div>
            }
        />


        {renderColumn(eventTableSpec, "type", eventValue, eventValidationResult, eventAPI, false)}

        <NameValuePair
            name="Attendance"
            value={<ul className="attendanceList">
                {props.serverData?.responses.map((r, i) => <li key={i}>{`${r.userName || "?"} (${r.userId})`} : {<CMStandardDBChip model={dashboardContext.eventAttendance.getById(r.attendanceId)} />}</li>)}
            </ul>}
        />

        <NameValuePair
            name={`Set list (${props.serverData?.songList.length})`}
            value={<ol className="setlist">
                {props.serverData?.songList.map((r, i) => <li key={i}>{`${r.songName || "?"} (${r.songId})`} {r.comment}</li>)}
            </ol>}
        />

        {renderColumn(eventTableSpec, "tags", eventValue, eventValidationResult, eventAPI, false)}
        {renderColumn(eventTableSpec, "expectedAttendanceUserTag", eventValue, eventValidationResult, eventAPI, false)}
        {renderColumn(eventTableSpec, "status", eventValue, eventValidationResult, eventAPI, false)}
        {renderColumn(eventTableSpec, "description", eventValue, eventValidationResult, eventAPI, false)}

        <Button onClick={handleSaveClick}>Save</Button>

    </div>
};



interface QuerierProps {
    text: string;
    config: string;
    onReceive: (v: TGetImportEventDataRet) => void;
};
const Querier = (props: QuerierProps) => {
    const [searchParams, setSearchParams] = useDebounce([props.text, props.config], 200);
    const [serverData, dataInfo] = useQuery(getImportEventData, { text: searchParams[0]!, config: searchParams[1]! });

    React.useEffect(() => {
        console.log(serverData);
        props.onReceive(serverData);
    }, [serverData]);

    return <div className="querier"></div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
const ImportEventsPageContent = () => {
    const [configTxt, setConfigTxt] = React.useState<string>(`y2023`);
    const [eventTxt, setEventTxt] = React.useState<string>(`26 October Rehearsal
    peter + guido + carl
    smoke and mirrors
    t is proper dat
    zomeravond
    all you need is love
    ten dans
    paper spaceships(feat.Pieter maes on e - hangdrum)
    recordings`);

    const [eventSaveLog, setEventSaveLog] = React.useState<InsertResult[]>([]);

    const [serverData, setServerData] = React.useState<TGetImportEventDataRet | null>(null);

    return <div className="ImportEventsPageContent">
        {/* <MechanicalSelector minValue={30} maxValue={280} value={value} onChange={setValue} /> */}
        <Suspense fallback={<div className="querier suspended"></div>}>
            <Querier text={eventTxt} config={configTxt} onReceive={setServerData} />
        </Suspense>
        <div className="twocolumns">
            <div className="leftColumn">
                <textarea className="configTxt" value={configTxt} onChange={(e) => setConfigTxt(e.target.value)} />
                <textarea className="eventTxt" value={eventTxt} onChange={(e) => setEventTxt(e.target.value)} />
                <ul className="history">
                    {eventSaveLog.map((e, i) => <li key={i}><a href={getURIForEvent(e.event.id)} target="_blank" rel="noreferrer">{e.event.id} / {e.segment.startsAt?.toDateString()} / {e.event.name}</a></li>)}
                </ul>
            </div>
            <div>
                <NewEventForm
                    serverData={serverData}
                    onSave={(x) => {
                        console.log(x);
                        setEventSaveLog([x, ...eventSaveLog]);
                    }}
                />
            </div>
        </div>
        <pre className="log">{serverData && serverData.log.join("\n")}</pre>
    </div>;
};

const ImportEventsPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Import Events" basePermission={Permission.admin_events}>
            <ImportEventsPageContent />
        </DashboardLayout>
    )
}

export default ImportEventsPage;
