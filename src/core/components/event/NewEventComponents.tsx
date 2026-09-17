import { Button, DialogContent, DialogTitle } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { Permission } from "shared/permissions";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl, VisibilityControlValue } from "src/core/components/VisibilityControl";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import * as db3 from "src/core/db3/db3";
import { TinsertEventArgs } from "src/core/db3/shared/apiTypes";
import { gIconMap } from "../../db3/components/IconMap";
import { AppContextMarker } from "../AppContext";
import { DialogActionsCM } from "../CMCoreComponents2";
import { EventTableClientColumns } from "./EventComponentsBase";
import { ReactiveInputDialog } from "../ReactiveInputDialog";
import { ActivityFeature } from "../featureReports/activityTracking";
import { EventSegmentClientColumns } from "./EventSegmentComponents";
import { TAnyModel } from "@/shared/rootroot";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";

interface NewEventDialogProps {
    onCancel: () => void;
    onOK: () => void;
};

const NewEventDialogWrapper = (props: NewEventDialogProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [grayed, setGrayed] = React.useState<boolean>(false);
    const mut = API.events.newEventMutation.useToken();
    const currentUser = useCurrentUser()[0]!;

    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();
    const router = useRouter();

    // EVENT table bindings
    const eventTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            EventTableClientColumns.id,
            EventTableClientColumns.name,
            //EventTableClientColumns.slug,
            EventTableClientColumns.locationDescription,
            EventTableClientColumns.type,
            EventTableClientColumns.status,
            EventTableClientColumns.tags,
            //EventTableClientColumns.segmentBehavior,
            EventTableClientColumns.expectedAttendanceUserTag,
            EventTableClientColumns.visiblePermission,
        ],
    });

    // necessary to connect all the columns in the spec.
    const eventTableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: eventTableSpec,
    });

    const [eventValue, setEventValue] = React.useState<Omit<db3.EventPayload, "visiblePermission"> & { visiblePermission: VisibilityControlValue }>(() => {
        const ret = db3.xEvent.createNew(currentUser) as db3.EventPayload;
        // default to members visibility.
        // note: you cannot use API....defaultVisibility because that uses a hook and this is a callback.
        //ret.visiblePermission = API.users.getDefaultVisibilityPermission();//
        ret.visiblePermission = dashboardContext.getDefaultVisibilityPermission() as any;
        return ret;
    });

    const eventAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...eventValue, ...fieldValues };
            setEventValue(newValue);
        },
    };

    const eventValidationResult = eventTableSpec.args.table.ValidateAndComputeDiff(eventValue, eventValue, "new");


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
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: segmentTableSpec,
    });

    const [segmentValue, setSegmentValue] = React.useState<db3.EventSegmentPayload>(db3.xEventSegment.createNew(currentUser));

    const segmentAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...segmentValue, ...fieldValues };
            setSegmentValue(newValue);
        },
    };

    const segmentValidationResult = segmentTableSpec.args.table.ValidateAndComputeDiff(segmentValue, segmentValue, "new");

    const handleSaveClick = async () => {
        void recordFeature({
            feature: ActivityFeature.event_create,
        });
        const payload: TinsertEventArgs = {
            event: eventTableClient.prepareInsertMutation(eventValue),
            segment: segmentTableClient.prepareInsertMutation(segmentValue),
        }; setGrayed(true);
        mut.invoke(payload).then(async (ret) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            props.onOK();

            void router.push(dashboardContext.routingApi.getURIForEvent(ret.event));

        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
        });
    };

    const renderColumn = (table: DB3Client.xTableClientSpec, colName: string, row: TAnyModel, validationResult: db3.ValidateAndComputeDiffResult, api: DB3Client.NewDialogAPI, autoFocus: boolean) => {
        return table.getColumn(colName).renderForNewDialog!({ key: colName, row, validationResult, api, value: row[colName], autoFocus });
    };

    return <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

        <DialogTitle>
            Create a new event
        </DialogTitle>
        <DialogContent dividers>
            <SettingMarkdown setting="NewEventDialogDescription" />

            <div className="EventSongListValue">
                <VisibilityControl value={eventValue.visiblePermission} onChange={(newVisiblePermission) => {
                    const newValue = { ...eventValue, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                    setEventValue(newValue);
                }} />

                {renderColumn(eventTableSpec, "name", eventValue, eventValidationResult, eventAPI, true)}
                {renderColumn(eventTableSpec, "locationDescription", eventValue, eventValidationResult, eventAPI, false)}
                {/* {renderColumn(eventTableSpec, "slug", eventValue, eventValidationResult, eventAPI, false)} */}
                {renderColumn(eventTableSpec, "type", eventValue, eventValidationResult, eventAPI, false)}
                {renderColumn(eventTableSpec, "status", eventValue, eventValidationResult, eventAPI, false)}
                {renderColumn(eventTableSpec, "tags", eventValue, eventValidationResult, eventAPI, false)}
                {renderColumn(eventTableSpec, "expectedAttendanceUserTag", eventValue, eventValidationResult, eventAPI, false)}

                {renderColumn(segmentTableSpec, "startsAt", segmentValue, segmentValidationResult, segmentAPI, false)}

            </div>
            <DialogActionsCM>
                <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()} disabled={grayed}>Cancel</Button>
                <Button onClick={handleSaveClick} startIcon={gIconMap.Save()} disabled={grayed}>OK</Button>
            </DialogActionsCM>
        </DialogContent>

    </ReactiveInputDialog>;
};

export const NewEventButton = (props: {}) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.manage_events)) {
        return null;
    }

    return <>
        <Button onClick={() => setOpen(true)}>{gIconMap.Add()} Create a new event</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <AppContextMarker name="new event dialog">
                <NewEventDialogWrapper
                    onCancel={
                        () => {
                            setOpen(false);
                        }}
                    onOK={() => {
                        setOpen(false);
                    }} />
            </AppContextMarker>
        </ReactiveInputDialog>}
    </>;
};
