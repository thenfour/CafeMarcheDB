import { EventDateRangeText } from "../DateTime/EventDateRangeText";
import { useDB3Authorization } from "src/core/db3/components/useDB3Authorization";

// drag reordering https://www.npmjs.com/package/react-smooth-dnd
// https://codesandbox.io/s/material-ui-sortable-list-with-react-smooth-dnd-swrqx?file=/src/index.js:113-129

import { useMutation } from "@blitzjs/rpc";
import { Divider, ListItemIcon, Menu, MenuItem } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace } from "shared/utils";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext, useSnackbar } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from "../../db3/components/IconMap";
import { DB3EditObjectDialog } from '../../db3/components/db3NewObjectDialog';
import clearEventSegmentResponses from "../../db3/mutations/clearEventSegmentResponses";
import copyEventSegmentResponses from "../../db3/mutations/copyEventSegmentResponses";
import { useConfirm } from "../ConfirmationDialog";
import { EventTableClientColumns } from "./EventComponentsBase";
import { Markdown } from "../markdown/Markdown";
import { SettingMarkdown } from "../SettingMarkdown";
import { toSorted } from "shared/arrayUtils";
import { Prisma } from "db";
import { EventStatusValue } from "../event/EventChips";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { CMButton } from "../CMCoreComponents2";



export const EventSegmentClientColumns = DB3Client.makeClientColumnSet({
    id: columnName => new DB3Client.PKColumnClient({ columnName }),
    name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 180 }),
    description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200, fieldCaption: "Description" }),
    startsAt: columnName => new DB3Client.EventDateRangeColumn({ startsAtColumnName: columnName, headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay", fieldCaption: "Date/time range" }),
    event: columnName => new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 120, visible: false }),
});




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
    onSave: (
        newValue: db3.EventVerbose_EventSegment,
        commands: DB3Client.CrudViewCommandClient,
        previousValue: db3.EventVerbose_EventSegment,
    ) => void;
    onCancel: () => void;
    onDelete?: (commands: DB3Client.CrudViewCommandClient) => void;
};

export const EventSegmentEditDialog = (props: EventSegmentEditDialogProps) => {
    //const currentUser = useCurrentUser()[0]!;
    const dashboardContext = useDashboardContext();

    const tableSpec = DB3Client.defineLegacyTableClientSpec({
        table: db3.xEventSegment,
        columns: DB3Client.makeClientColumnSelection(
            EventSegmentClientColumns.id,
            EventSegmentClientColumns.name,
            EventTableClientColumns.status,
            EventSegmentClientColumns.startsAt,
            EventSegmentClientColumns.description,
            EventSegmentClientColumns.event,
        ),
    });
    const tableRenderClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.None,
        tableSpec,
    });
    const commands = DB3Client.useCrudViewCommands({
        view: db3.eventSegmentEditorView,
        tableClient: tableRenderClient,
    });
    const initialValue = {
        ...props.initialValue,
        // The verbose event payload carries statusId, while the editor column
        // uses the semantic status object.
        status: dashboardContext.eventStatus.getById(props.initialValue.statusId),
    };

    return <DB3EditObjectDialog
        initialValue={initialValue}
        onDelete={props.onDelete ? () => props.onDelete!(commands) : undefined}

        onCancel={props.onCancel}
        onOK={value => props.onSave(value as db3.EventVerbose_EventSegment, commands, initialValue)}
        tableRenderClient={tableRenderClient}
        // title={<SettingMarkdown setting={props.isNewObject ? "NewEventSegmentDialogTitle" : "EditEventSegmentDialogTitle"} />}
        // description={<SettingMarkdown setting={props.isNewObject ? "NewEventSegmentDialogDescription" : "EditEventSegmentDialogDescription"} />}
        title={<SettingMarkdown setting={`${props.markdownSettingPrefix}DialogTitle` as any} />}
        description={<SettingMarkdown setting={`${props.markdownSettingPrefix}DialogDescription` as any} />}
    />;
};

////////////////////////////////////////////////////////////////
interface NewEventSegmentButtonProps {
    event: Prisma.EventGetPayload<{}>;
    initialName: string;
    refetch: () => void;
};

const NewEventSegmentButton = ({ event, refetch, ...props }: NewEventSegmentButtonProps) => {
    const [open, setOpen] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const currentUser = useCurrentUser()[0]!;

    const publicData = useDB3Authorization();
    const blankObject: db3.EventSegmentPayload = db3.xEventSegment.createNew(currentUser) as any;
    blankObject.name = props.initialName;
    blankObject.eventId = event.id;
    blankObject.event = event;

    const authorized = db3.xEventSegment.authorizeRowBeforeInsert({
        publicData,
    });

    const handleSave = (obj, commands: DB3Client.CrudViewCommandClient) => {
        commands.create(obj).then(() => {
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
        {authorized && <CMButton className="newSegmentButton" onClick={() => setOpen(true)}>{gIconMap.Add()} New segment</CMButton>}
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
    const publicData = useDB3Authorization();

    const handleDelete = (commands: DB3Client.CrudViewCommandClient) => {
        commands.delete(props.segment.id).then(() => {
            showSnackbar({ severity: "success", children: "segment deleted" });
            setEditOpen(false);
            refetch();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error deleting segment" });
        });
    };

    const handleSave = (
        updatedFields,
        commands: DB3Client.CrudViewCommandClient,
        previousValue: db3.EventVerbose_EventSegment,
    ) => {
        const updateObj = {
            ...updatedFields,
        };
        commands.update(updateObj, previousValue).then(() => {
            showSnackbar({ severity: "success", children: "segment updated" });
            setEditOpen(false);
            refetch();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating segment" });
        });
    };

    const editAuthorized = db3.xEventSegment.authorizeRowForEdit({
        publicData,
        model: props.segment,
    });

    const status = dashboardContext.eventStatus.getById(props.segment.statusId);

    return <div className={`EventSegmentPanel segment statusSignificance_${status?.significance}`}>
        <div className="header">
            <div className="dateRange">
                <EventDateRangeText range={db3.getEventSegmentDateTimeRange(props.segment)} />
            </div>
            <div style={{ display: "flex" }}>
                <EventStatusValue statusId={props.segment.statusId} size="small" />
                {!props.readonly && editAuthorized && <CMButton className="editButton" onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Edit</CMButton>}
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
    const publicData = useDB3Authorization();


    const handleSave = (
        updatedFields,
        commands: DB3Client.CrudViewCommandClient,
        previousValue: db3.EventVerbose_EventSegment,
    ) => {
        const updateObj = {
            ...updatedFields,
        };
        commands.update(updateObj, previousValue).then(() => {
            showSnackbar({ severity: "success", children: "segment updated" });
            setEditOpen(false);
            props.refetch();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating segment" });
        });
    };

    const editAuthorized = db3.xEventSegment.authorizeRowForEdit({
        publicData,
        model: props.segment,
    });
    if (!editAuthorized || props.readonly) return null;

    return <>
        <CMButton onClick={() => setEditOpen(true)}>{gIconMap.Edit()}Change date</CMButton>
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

    const handleCopyAttendeeNames = async (copyInstrumentNames: boolean) => {
        const names = props.getAttendeeNames(copyInstrumentNames).join('\n');
        await navigator.clipboard.writeText(names);
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
            <MenuItem onClick={async () => await handleCopyAttendeeNames(false)}>
                <ListItemIcon>{gIconMap.ContentCopy()}</ListItemIcon>
                Copy names of attendees to clipboard
            </MenuItem>
            <MenuItem onClick={async () => await handleCopyAttendeeNames(true)}>
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
