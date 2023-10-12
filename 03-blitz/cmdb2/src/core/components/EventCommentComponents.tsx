import { Button } from "@mui/material";
import React from "react";
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { gIconMap } from '../db3/components/IconSelectDialog';
import { Markdown, MarkdownEditor } from "./RichTextEditor";
import { VisibilityControl, VisibilityValue } from "./CMCoreComponents";

/*


<EventCommentTabContent>
    <EventCommentNewEditor> - add comment function
        <EventCommentValueEditor> - for editing floating comment payloads
    <EventCommentList> - list of comments, with edit functionality
        <EventCommentControl> [list] - which has a view / edit mode, either resolving to:
            <EventCommentValueEditor>
            <EventCommentValueViewer> - has an edit button to switch modes



*/

////////////////////////////////////////////////////////////////
// model EventComment {
//     id        Int      @id @default(autoincrement())
//     eventId   Int
//     event     Event    @relation(fields: [eventId], references: [id], onDelete: Restrict) // cascade delete association
//     userId    Int
//     createdAt DateTime
//     updatedAt DateTime
//     text      String
//     user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)

//     visiblePermissionId Int? // which permission determines visibility, when NULL, only visible by admins + creator
//     visiblePermission   Permission? @relation(fields: [visiblePermissionId], references: [id], onDelete: SetDefault)
//   }

// editor for the comment value, but doesn't perform saving or db ops. parent component should handle that.
interface EventCommentValueViewerProps {
    value: db3.EventCommentPayload;
    onEnterEditMode?: () => void; // if undefined, don't allow editing.
};

export const EventCommentValueViewer = (props: EventCommentValueViewerProps) => {
    const [currentUser] = useCurrentUser();
    const canEnterEditMode = props.value.userId === currentUser?.id;
    return <div className="comment eventComment viewer">
        <VisibilityValue permission={props.value.visiblePermission} />
        <Markdown markdown={props.value.text} />
        <div className="date">{props.value.createdAt.toISOString()}</div>
        <div className="author">{props.value.user.name}</div>
        {canEnterEditMode && <Button onClick={props.onEnterEditMode}>{gIconMap.Edit()}Edit</Button>}
    </div>;
};





////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// editor for the comment value, but doesn't perform saving or db ops. parent component should handle that.
interface EventCommentValueEditorProps {
    initialValue: db3.EventCommentPayload;
    onSave: (newValue: db3.EventCommentPayload) => void;
    onCancel: () => void;
    onDelete?: () => void;
};

// state managed internally.
export const EventCommentValueEditor = (props: EventCommentValueEditorProps) => {
    const [value, setValue] = React.useState<db3.EventCommentPayload>(props.initialValue);
    return <div className="comment eventComment editor">
        <VisibilityControl value={value.visiblePermission} onChange={(newVisiblePermission) => {
            const newValue: db3.EventCommentPayload = { ...value, visiblePermission: newVisiblePermission, visiblePermissionId: newVisiblePermission?.id || null };
            setValue(newValue);
        }} />

        <MarkdownEditor value={value.text} onValueChanged={(newText) => {
            const newValue: db3.EventCommentPayload = { ...value, text: newText };
            setValue(newValue);
        }}></MarkdownEditor>

        <Markdown markdown={value.text} />
        {props.onDelete && <Button onClick={props.onDelete}>{gIconMap.Delete()}Delete</Button>}
        <Button onClick={() => props.onSave(value)}>{gIconMap.Save()}Save</Button>
        <Button onClick={() => props.onCancel()}>{gIconMap.Cancel()}Cancel</Button>
    </div >;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// editor for existing event comments, handles db mutations & parent refetching; rendering delegated to either EventCommentValueEditor or VIewer.
//         <EventCommentControl>
//             <EventCommentValueViewer> - has an edit button to switch modes
//             <EventCommentValueEditor>
interface EventCommentControlProps {
    value: db3.EventCommentPayload;
    readonly: boolean;
    refetch: () => void;
};

export const EventCommentControl = (props: EventCommentControlProps) => {

    const [editMode, setEditMode] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const deleteMutation = API.events.deleteEventCommentMutation.useToken();
    const updateMutation = API.events.updateEventCommentMutation.useToken();

    const handleSave = (newValue: db3.EventCommentPayload) => {
        updateMutation.invoke({
            id: newValue.id,
            text: newValue.text,
            visiblePermissionId: newValue.visiblePermissionId,
        }).then(() => {
            showSnackbar({ severity: "success", children: "comment edit successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    const handleDelete = () => {
        deleteMutation.invoke({
            id: props.value.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "comment delete successful" });
            props.refetch();
            setEditMode(false);
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return editMode ? (
        <EventCommentValueEditor initialValue={props.value} onSave={handleSave} onDelete={handleDelete} onCancel={() => setEditMode(false)} />
    ) : (
        <EventCommentValueViewer value={props.value} onEnterEditMode={() => setEditMode(true)} />
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// for new event comments. different from the other editor because this doesn't save automatically, it only saves after you click "save"
interface EventCommentNewEditorProps {
    event: db3.EventClientPayload_Verbose;
    tableClient: DB3Client.xTableRenderClient;
    onCancel: () => void;
    onSuccess: () => void;
};

export const EventCommentNewEditor = (props: EventCommentNewEditorProps) => {

    const insertMutation = API.events.insertEventCommentMutation.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [currentUser] = useCurrentUser();
    const clientIntention: db3.xTableClientUsageContext = {
        intention: 'user',
        mode: 'primary',
        currentUser: currentUser!,
    };
    const initialValue = db3.xEventComment.createNew(clientIntention) as db3.EventCommentPayload;

    const handleSave = (value: db3.EventCommentPayload) => {
        insertMutation.invoke({
            eventId: props.event.id,
            text: value.text,
            visiblePermissionId: value.visiblePermissionId,
        }).then(() => {
            showSnackbar({ severity: "success", children: "added new comment" });
            props.onSuccess();
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <div className='commentEditor commentNewEditor'>
        <EventCommentValueEditor onSave={handleSave} initialValue={initialValue} onCancel={props.onCancel} />
    </div>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventCommentList = ({ event, tableClient }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient }) => {
    return <>
        {event.comments.map(c => <EventCommentControl key={c.id} value={c} readonly={false} refetch={tableClient.refetch} />)}
    </>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const EventCommentTabContent = ({ event, tableClient }: { event: db3.EventClientPayload_Verbose, tableClient: DB3Client.xTableRenderClient }) => {
    const [newCommentOpen, setNewCommentOpen] = React.useState<boolean>(false);
    return <>
        {newCommentOpen ? (
            <EventCommentNewEditor event={event} tableClient={tableClient} onCancel={() => setNewCommentOpen(false)} onSuccess={() => { setNewCommentOpen(false); tableClient.refetch(); }} />
        ) : (
            <Button onClick={() => setNewCommentOpen(true)}>{gIconMap.Add()} Add new comment</Button>
        )}
        <EventCommentList event={event} tableClient={tableClient} />
    </>;
};

