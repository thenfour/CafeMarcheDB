import { Button, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { TAnyModel } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { ReactiveInputDialog } from "src/core/components/CMCoreComponents";
import { EventTableClientColumns } from "src/core/components/EventComponents";
import { EventSegmentClientColumns } from "src/core/components/EventSegmentComponents";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl } from "src/core/components/VisibilityControl";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import { TinsertEventArgs } from "src/core/db3/shared/apiTypes";

interface NewEventDialogProps {
    onCancel: () => void;
    onOK: () => void;
};

const NewEventDialogWrapper = (props: NewEventDialogProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const router = useRouter();
    const mut = API.events.newEventMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: "primary", currentUser };

    // EVENT table bindings
    const eventTableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEvent,
        columns: [
            EventTableClientColumns.id,
            EventTableClientColumns.name,
            EventTableClientColumns.slug,
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
        clientIntention,
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec: eventTableSpec,
    });

    const [eventValue, setEventValue] = React.useState<db3.EventPayload>(db3.xEvent.createNew(clientIntention));

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

    const [segmentValue, setSegmentValue] = React.useState<db3.EventSegmentPayload>(db3.xEventSegment.createNew(clientIntention));

    const segmentAPI: DB3Client.NewDialogAPI = {
        setFieldValues: (fieldValues: TAnyModel) => {
            const newValue = { ...segmentValue, ...fieldValues };
            setSegmentValue(newValue);
        },
    };

    const segmentValidationResult = segmentTableSpec.args.table.ValidateAndComputeDiff(segmentValue, segmentValue, "new", clientIntention);

    const handleSaveClick = () => {
        const payload: TinsertEventArgs = {
            event: eventTableClient.prepareInsertMutation(eventValue),
            segment: segmentTableClient.prepareInsertMutation(segmentValue),
        };
        mut.invoke(payload).then((ret) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            props.onOK();

            void router.push(API.events.getURIForEvent(ret.event.id, ret.event.slug));

        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
        });
    };

    const renderColumn = (table: DB3Client.xTableClientSpec, colName: string, row: TAnyModel, validationResult: db3.ValidateAndComputeDiffResult, api: DB3Client.NewDialogAPI) => {
        return table.getColumn(colName).renderForNewDialog!({ key: colName, row, validationResult, api, value: row[colName], clientIntention });
    };

    return <ReactiveInputDialog onCancel={props.onCancel} className="EventSongListValueEditor">

        <DialogTitle>
            Create a new event
        </DialogTitle>
        <DialogContent dividers>
            <SettingMarkdown setting="NewEventDialogDescription" />

            <div className="EventSongListValue">
                <VisibilityControl value={eventValue.visiblePermission} onChange={(newVisiblePermission) => {
                    const newValue: db3.EventPayload = { ...eventValue, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
                    setEventValue(newValue);
                }} />

                {renderColumn(eventTableSpec, "name", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "slug", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "type", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "status", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "tags", eventValue, eventValidationResult, eventAPI)}
                {renderColumn(eventTableSpec, "expectedAttendanceUserTag", eventValue, eventValidationResult, eventAPI)}

                {renderColumn(segmentTableSpec, "startsAt", segmentValue, segmentValidationResult, segmentAPI)}

            </div>
        </DialogContent>
        <DialogActions>
            <Button onClick={props.onCancel} startIcon={gIconMap.Cancel()}>Cancel</Button>
            <Button onClick={handleSaveClick} startIcon={gIconMap.Save()}>OK</Button>
        </DialogActions>

    </ReactiveInputDialog>;
};

export const NewEventButton = (props: { onOK: () => void }) => {
    const [open, setOpen] = React.useState<boolean>(false);
    return <>
        <Button onClick={() => setOpen(true)}>{gIconMap.Add()} Create a new event</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <NewEventDialogWrapper
                onCancel={
                    () => {
                        setOpen(false);
                    }}
                onOK={() => {
                    setOpen(false);
                    props.onOK();
                }} />
        </ReactiveInputDialog>}
    </>;
};
