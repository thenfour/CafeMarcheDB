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
import { useAuthenticatedSession } from "@blitzjs/auth";
import { Markdown } from "./RichTextEditor";

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
    initialValue: db3.EventVerbose_EventSegmentPayload;
    onSave: (newValue: db3.EventVerbose_EventSegmentPayload, tableRenderClient: DB3Client.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableRenderClient: DB3Client.xTableRenderClient) => void;
};

export const EventSegmentEditDialog = (props: EventSegmentEditDialogProps) => {
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),

            new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),

            // this must specify all the columns which are required for insertion as well.
            new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120, clientIntention, visible: false }),
        ],
    });

    return <DB3EditObjectDialog
        initialValue={props.initialValue}
        onDelete={props.onDelete}
        clientIntention={clientIntention}
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
    const publicData = useAuthenticatedSession();
    const blankObject: db3.EventSegmentPayload = db3.xEventSegment.createNew(clientIntention) as any;
    blankObject.eventId = event.id;
    blankObject.event = event;

    const authorized = db3.xEventSegment.authorizeRowBeforeInsert({
        clientIntention,
        publicData,
    });

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
        {authorized && <Button className="newSegmentButton" onClick={() => setOpen(true)}>{gIconMap.Add()} New segment</Button>}
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
    //segmentInfo: db3.SegmentAndResponse,
    verbosity: EventDetailVerbosity;
    //myEventInfo: db3.EventInfoForUser,
    segment: db3.EventVerbose_EventSegmentPayload,
    readonly: boolean;
    refetch: () => void;
};

export const EventSegmentPanel = ({ event, refetch, ...props }: EventSegmentPanelProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [editOpen, setEditOpen] = React.useState<boolean>(false);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const handleDelete = (saveClient: DB3Client.xTableRenderClient) => {
        saveClient.doDeleteMutation(props.segment.id).then(e => {
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

    const editAuthorized = db3.xEventSegment.authorizeRowForEdit({
        clientIntention,
        publicData,
        model: props.segment,
    });

    return <div className={`EventSegmentPanel segment`}>
        <div className="header">
            <div className="dateRange">{API.events.getEventSegmentFormattedDateRange(props.segment)}</div>
            {!props.readonly && editAuthorized && <Button className="editButton" onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Edit</Button>}
        </div>
        <div className="content">
            <div className='name'>
                {props.segment.name}
            </div>

            {/*
        don't show attendance stuff quite yet because we want to refine the GUI first, then add these kind of things.
        for the moment it's too distracting and no good way to get rid of it.
        
        {(props.verbosity !== 'compact') && <div className="attendanceResponseInput">
            <div className="segmentList">
                <EventAttendanceFrame onRefetch={refetch} segmentInfo={props.segmentInfo} eventUserInfo={myEventInfo} event={event} />
            </div>
        </div>} */}

            <Markdown markdown={props.segment.description} />
            {!props.readonly && editOpen && (<EventSegmentEditDialog
                initialValue={props.segment}
                onDelete={handleDelete}
                onCancel={() => setEditOpen(false)}
                onSave={handleSave}
            />)}
        </div>
    </div>;

};


////////////////////////////////////////////////////////////////
interface SegmentListProps {
    event: db3.EventClientPayload_Verbose;
    //myEventInfo: db3.EventInfoForUser;
    tableClient: DB3Client.xTableRenderClient;
    verbosity: EventDetailVerbosity;
    readonly: boolean;
};

export const SegmentList = ({ event, tableClient, verbosity, ...props }: SegmentListProps) => {
    return <div className='segmentListContainer'>
        {!props.readonly && <NewEventSegmentButton event={event} refetch={tableClient.refetch} />}
        <div className="segmentList">
            {event.segments.map(segment => {
                //const segInfo = myEventInfo.getSegmentUserInfo(segment.id);
                return <EventSegmentPanel
                    key={segment.id}
                    segment={segment}
                    readonly={props.readonly}
                    //segmentInfo={segInfo}
                    //myEventInfo={myEventInfo}
                    event={event}
                    refetch={tableClient.refetch}
                    verbosity={verbosity}
                />;
            })}
        </div>
    </div>;
};
