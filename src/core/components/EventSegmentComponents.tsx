
// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useAuthenticatedSession } from "@blitzjs/auth";
import { useMutation } from "@blitzjs/rpc";
import { Button, Divider, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, toSorted } from "shared/utils";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { DB3EditObjectDialog } from '../db3/components/db3NewObjectDialog';
import clearEventSegmentResponses from "../db3/mutations/clearEventSegmentResponses";
import copyEventSegmentResponses from "../db3/mutations/copyEventSegmentResponses";
import { useConfirm } from "./ConfirmationDialog";
import { useDashboardContext } from "./DashboardContext";
import { EventStatusValue, EventTableClientColumns } from "./EventComponentsBase";
import { Markdown } from "./markdown/RichTextEditor";
import { SettingMarkdown } from "./SettingMarkdown";




export const EventSegmentClientColumns = {
    "id": new DB3Client.PKColumnClient({ columnName: "id" }),
    "name": new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
    "description": new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200, fieldCaption: "Description" }),
    "dateRange": new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay", fieldCaption: "Date/time range" }),
    "event": new DB3Client.ForeignSingleFieldClient({ columnName: "event", cellWidth: 120, visible: false }),
} as const;




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
    initialValue: db3.EventVerbose_EventSegment;
    //isNewObject: boolean,
    markdownSettingPrefix: string,
    onSave: (newValue: db3.EventVerbose_EventSegment, tableRenderClient: DB3Client.xTableRenderClient) => void;
    onCancel: () => void;
    onDelete?: (tableRenderClient: DB3Client.xTableRenderClient) => void;
};

export const EventSegmentEditDialog = (props: EventSegmentEditDialogProps) => {
    const currentUser = useCurrentUser()[0]!;
    const dashboardContext = useDashboardContext();
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventSegment,
        columns: [
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.name,
            EventTableClientColumns.status,
            EventSegmentClientColumns.dateRange,
            EventSegmentClientColumns.description,
            EventSegmentClientColumns.event,
        ],
    });

    return <DB3EditObjectDialog
        initialValue={{
            ...props.initialValue,
            // little hack: the payload doesn't contain a status (only statusId).
            // should probably be added on enriching
            status: dashboardContext.eventStatus.getById(props.initialValue.statusId),
        }}
        onDelete={props.onDelete}
        clientIntention={clientIntention}
        onCancel={props.onCancel}
        onOK={props.onSave}
        table={tableSpec}
        // title={<SettingMarkdown setting={props.isNewObject ? "NewEventSegmentDialogTitle" : "EditEventSegmentDialogTitle"} />}
        // description={<SettingMarkdown setting={props.isNewObject ? "NewEventSegmentDialogDescription" : "EditEventSegmentDialogDescription"} />}
        title={<SettingMarkdown setting={`${props.markdownSettingPrefix}DialogTitle` as any} />}
        description={<SettingMarkdown setting={`${props.markdownSettingPrefix}DialogDescription` as any} />}
    />;
};

////////////////////////////////////////////////////////////////
interface NewEventSegmentButtonProps {
    event: db3.EventPayloadMinimum;
    initialName: string;
    refetch: () => void;
};

const NewEventSegmentButton = ({ event, refetch, ...props }: NewEventSegmentButtonProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };
    const publicData = useAuthenticatedSession();
    const blankObject: db3.EventSegmentPayload = db3.xEventSegment.createNew(clientIntention) as any;
    blankObject.name = props.initialName;
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
            markdownSettingPrefix="NewEventSegment"
            onSave={handleSave}
            initialValue={blankObject}
        />
        }
    </>;
};


////////////////////////////////////////////////////////////////
export interface EventSegmentPanelProps {
    event: db3.EventVerbose_Event,
    segment: db3.EventVerbose_EventSegment,
    readonly: boolean;
    refetch: () => void;
};

export const EventSegmentPanel = ({ event, refetch, ...props }: EventSegmentPanelProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [editOpen, setEditOpen] = React.useState<boolean>(false);
    //const user = useCurrentUser()[0]!;
    const dashboardContext = useDashboardContext();
    const publicData = useAuthenticatedSession();
    //const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const handleDelete = (saveClient: DB3Client.xTableRenderClient) => {
        saveClient.doDeleteMutation(props.segment.id, 'softWhenPossible').then(e => {
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
        clientIntention: dashboardContext.userClientIntention,
        publicData,
        model: props.segment,
    });

    const status = dashboardContext.eventStatus.getById(props.segment.statusId);

    return <div className={`EventSegmentPanel segment statusSignificance_${status?.significance}`}>
        <div className="header">
            <div className="dateRange">{API.events.getEventSegmentFormattedDateRange(props.segment)}</div>
            <div style={{ display: "flex" }}>
                <EventStatusValue statusId={props.segment.statusId} size="small" />
                {!props.readonly && editAuthorized && <Button className="editButton" onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Edit</Button>}
            </div>
        </div>
        <div className="content">
            <div className='name'>
                {props.segment.name}
            </div>

            <Markdown markdown={props.segment.description} />

            {!props.readonly && editOpen && (<EventSegmentEditDialog
                initialValue={props.segment}
                markdownSettingPrefix="EditEventSegment"
                onDelete={handleDelete}
                onCancel={() => setEditOpen(false)}
                onSave={handleSave}
            />)}
        </div>
    </div>;

};


////////////////////////////////////////////////////////////////
interface SegmentListProps {
    event: db3.EventVerbose_Event;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
};

export const SegmentList = ({ event, tableClient, ...props }: SegmentListProps) => {

    const dashboardContext = useDashboardContext();
    const segments = toSorted(event.segments, (a, b) => db3.compareEventSegments(a, b, db3.getCancelledStatusIds(dashboardContext.eventStatus.items)));

    // if there is only 1 segment and there's no description for the segment, don't display at all.
    // the only time to show segment lists is when there's something that's not shown elsewhere.
    const enableList = (event.segments.length > 1) || !IsNullOrWhitespace(event.segments[0]?.description);

    return <div className='segmentListContainer'>
        {!props.readonly && <NewEventSegmentButton
            event={event}
            initialName={`Set ${event.segments.length + 1}`}
            refetch={tableClient.refetch}
        />}
        {enableList && <div className="segmentList">
            {segments.map(segment => {
                return <EventSegmentPanel
                    key={segment.id}
                    segment={segment}
                    readonly={props.readonly}
                    event={event}
                    refetch={tableClient.refetch}
                />;
            })}
        </div>}
    </div>;
};


export interface EditSingleSegmentDateButtonProps {
    event: db3.EventVerbose_Event,
    segment: db3.EventVerbose_EventSegment,
    readonly: boolean;
    refetch: () => void;
};

export const EditSingleSegmentDateButton = (props: EditSingleSegmentDateButtonProps) => {
    const [editOpen, setEditOpen] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const user = useCurrentUser()[0]!;
    const publicData = useAuthenticatedSession();
    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const handleSave = (updatedFields, saveClient: DB3Client.xTableRenderClient) => {
        const updateObj = {
            ...updatedFields,
        };
        saveClient.doUpdateMutation(updateObj).then(e => {
            showSnackbar({ severity: "success", children: "segment updated" });
            setEditOpen(false);
            props.refetch();
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
    if (!editAuthorized || props.readonly) return null;

    return <>
        <Button onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Change date</Button>
        {editOpen && (<EventSegmentEditDialog
            initialValue={props.segment}
            markdownSettingPrefix="EditSingleEventSegment"
            onCancel={() => setEditOpen(false)}
            onSave={handleSave}
        />)}

    </>;
};



interface EventSegmentDotMenuCopyUserResponsesFromMenuItemProps {
    event: db3.EventVerbose_Event,
    fromSegment: db3.EventVerbose_EventSegment,
    toSegment: db3.EventVerbose_EventSegment,
    readonly: boolean;
    refetch: () => void;
    onClose: () => void;
};

export const EventSegmentDotMenuCopyUserResponsesFromMenuItem = (props: EventSegmentDotMenuCopyUserResponsesFromMenuItemProps) => {
    const snackbar = useSnackbar();
    const confirm = useConfirm();
    const [copyEventSegmentResponsesMutation] = useMutation(copyEventSegmentResponses);

    const handleCopyEventSegmentResponses = async () => {
        await copyEventSegmentResponsesMutation({
            fromEventSegmentId: props.fromSegment.id,
            toEventSegmentId: props.toSegment.id,
        });
    };

    return <MenuItem onClick={async () => {
        props.onClose();
        if (await confirm({
            title: `Are you sure? Existing ${props.toSegment.responses.length} responses will be clobbered; ${props.fromSegment.responses.length} responses from ${props.fromSegment.name} will be copied to segment '${props.toSegment.name}'. This cannot be undone.`,
            description: null,
        })) {
            await snackbar.invokeAsync(handleCopyEventSegmentResponses);
            props.refetch();
        }
    }}>
        <ListItemIcon>{gIconMap.AutoAwesome()}</ListItemIcon>
        Copy responses from {props.fromSegment.name}
    </MenuItem>;
};

interface EventSegmentDotMenuProps {
    event: db3.EventVerbose_Event,
    segment: db3.EventVerbose_EventSegment,
    readonly: boolean;
    refetch: () => void;
    getAttendeeNames: (copyInstrumentNames: boolean) => string[];
};

export const EventSegmentDotMenu = (props: EventSegmentDotMenuProps) => {
    // TODO (#329)
    //return null;
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const snackbar = useSnackbar();
    const confirm = useConfirm();
    const [clearEventSegmentResponsesMutation] = useMutation(clearEventSegmentResponses);
    const dashboardContext = useDashboardContext();

    if (!dashboardContext.isAuthorized(Permission.admin_events)) return null;

    const handleClear = async () => {
        await clearEventSegmentResponsesMutation({
            eventSegmentId: props.segment.id,
        });
    };

    const handleCopyAttendeeNames = (copyInstrumentNames: boolean) => {
        const names = props.getAttendeeNames(copyInstrumentNames).join('\n');
        navigator.clipboard.writeText(names);
        snackbar.showMessage({ children: "Names copied to clipboard" });
        setAnchorEl(null);
    };

    return <>
        <div className="interactable freeButton dotMenuDots eventSegmentDotMenu" onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>
            <div>{gCharMap.VerticalEllipses()}</div>
        </div>
        <Menu
            //id="menu-searchResults"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            <MenuItem onClick={() => handleCopyAttendeeNames(false)}>
                <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                Copy names of attendees to clipboard
            </MenuItem>
            <MenuItem onClick={() => handleCopyAttendeeNames(true)}>
                <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                Copy names of attendees (with instrument) to clipboard
            </MenuItem>
            <Divider />
            <MenuItem onClick={async () => {
                setAnchorEl(null);
                if (await confirm({
                    title: `Sure you want to clear all responses for ${props.segment.name}? This cannot be undone. (${props.segment.responses.length} in total)`,
                    description: null,
                })) {
                    await snackbar.invokeAsync(handleClear);
                    props.refetch();
                }
            }}>
                <ListItemIcon>{gIconMap.Delete()}</ListItemIcon>
                Clear all user responses
            </MenuItem>
            <Divider />
            {props.event.segments
                .filter(seg => seg.id !== props.segment.id)
                .map(fromSegment => <EventSegmentDotMenuCopyUserResponsesFromMenuItem
                    key={fromSegment.id}
                    {...props}
                    fromSegment={fromSegment}
                    toSegment={props.segment}
                    onClose={() => setAnchorEl(null)}
                />)}
        </Menu>
    </>;
}