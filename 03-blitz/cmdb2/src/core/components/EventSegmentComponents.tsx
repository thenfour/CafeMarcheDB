// 


// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { Button } from "@mui/material";
import React from "react";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import { EventDetailVerbosity } from './CMCoreComponents';
import { EventAttendanceFrame } from './EventAttendanceComponents';

/*

<SegmentList> - list of segments for Event default/verbose display
    <NewEventSegmentButton> - button which opens the dialog
        <NewEventSegmentDialogWrapper> - handles setup & db mutation for segment editor
            <EventSegmentEditDialog> - a dialog for editing detached segments. does no db integration.
    <EventSegmentPanel> - one element of segmentlist; shows the event segment details. has edit button
        <EventSegmentEditDialog>
*/

////////////////////////////////////////////////////////////////
interface EventSegmentEditDialogProps {
    initialValue: db3.EventSegmentPayloadFromEvent;
    onSave: (newValue: db3.EventSegmentPayloadFromEvent, tableRenderClient: DB3Client.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableRenderClient: DB3Client.xTableRenderClient) => void;
};

export const EventSegmentEditDialog = (props: EventSegmentEditDialogProps) => {
    const currentUser = useCurrentUser()[0]!;

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.DateTimeColumn({ columnName: "startsAt", cellWidth: 180 }),
            new DB3Client.DateTimeColumn({ columnName: "endsAt", cellWidth: 180 }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
        ],
    });

    return <DB3EditObjectDialog
        initialValue={props.initialValue}
        onDelete={props.onDelete}
        clientIntention={{ intention: "user", mode: 'primary', currentUser }}
        onCancel={props.onCancel}
        onOK={props.onSave}
        table={tableSpec}
    />;
};

////////////////////////////////////////////////////////////////
interface NewEventSegmentButtonProps {
    event: db3.EventPayloadMinimum;
    refetch: () => void;
};

const NewEventSegmentButton = ({ event, refetch, ...props }: NewEventSegmentButtonProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };
    const blankObject: db3.EventSegmentPayload = db3.xEventSegment.createNew(clientIntention) as any;
    blankObject.eventId = event.id;
    blankObject.event = event;

    const handleSave = (obj, tableClient) => {
        tableClient.doInsertMutation(obj).then((newRow) => {
            showSnackbar({ children: "insert successful", severity: 'success' });
            setOpen(false);
            refetch();
        }).catch(err => {
            console.log(err);
            showSnackbar({ children: "insert error", severity: 'error' });
            throw err;
        });
    };

    return <>
        <Button onClick={() => setOpen(true)}>{gIconMap.Add()} New segment</Button>
        {open && <EventSegmentEditDialog
            onCancel={() => setOpen(false)}
            onSave={handleSave}
            initialValue={blankObject}
        />
        }
    </>;
};


////////////////////////////////////////////////////////////////
export interface EventSegmentPanelProps {
    event: db3.EventPayloadClient,
    segmentInfo: db3.SegmentAndResponse,
    verbosity: EventDetailVerbosity;
    myEventInfo: db3.EventInfoForUser,
    refetch: () => void;
};

export const EventSegmentPanel = ({ event, myEventInfo, refetch, ...props }: EventSegmentPanelProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [editOpen, setEditOpen] = React.useState<boolean>(false);

    const handleDelete = (saveClient: DB3Client.xTableRenderClient) => {
        saveClient.doDeleteMutation(props.segmentInfo.segment.id).then(e => {
            showSnackbar({ severity: "success", children: "segment deleted" });
            setEditOpen(false);
            refetch();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error deleting segment" });
        });
    };

    const handleSave = (updatedFields, saveClient: DB3Client.xTableRenderClient) => {
        const updateObj = {
            id: event.id,
            ...updatedFields,
        };
        saveClient.doUpdateMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "segment updated" });
            setEditOpen(false);
            refetch();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating segment" });
        });
    };

    return <div className={`segment`}>
        <Button onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Edit</Button>

        <div className='name'>name: {props.segmentInfo.segment.name}</div>
        <div className="dateRange">{API.events.getEventSegmentFormattedDateRange(props.segmentInfo.segment)}</div>

        {(props.verbosity !== 'compact') && <div className="attendanceResponseInput">
            <div className="segmentList">
                <EventAttendanceFrame onRefetch={refetch} segmentInfo={props.segmentInfo} eventUserInfo={myEventInfo} event={event} />
            </div>
        </div>}

        {/* <div className='description'>description: {props.segmentInfo.segment.description}</div> */}
        {editOpen && (<EventSegmentEditDialog
            initialValue={props.segmentInfo.segment}
            onDelete={handleDelete}
            onCancel={() => setEditOpen(false)}
            onSave={handleSave}
        />)}
    </div>;

};


////////////////////////////////////////////////////////////////
interface SegmentListProps {
    event: db3.EventClientPayload_Verbose;
    myEventInfo: db3.EventInfoForUser;
    tableClient: DB3Client.xTableRenderClient;
    verbosity: EventDetailVerbosity;
};

export const SegmentList = ({ event, myEventInfo, tableClient, verbosity, ...props }: SegmentListProps) => {
    return <div className='segmentListContainer'>
        <div className="segmentList">
            {event.segments.map(segment => {
                const segInfo = myEventInfo.getSegmentUserInfo(segment.id);
                return <EventSegmentPanel key={segment.id} segmentInfo={segInfo} myEventInfo={myEventInfo} event={event} refetch={tableClient.refetch} verbosity={verbosity} />;
            })}
        </div>
        <NewEventSegmentButton event={event} refetch={tableClient.refetch} />
    </div>;
};
