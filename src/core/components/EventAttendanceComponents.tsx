// Production adapter for the shared attendance control.
import React from "react";
import { API } from "../db3/clientAPI";
import type { UserInstrumentList } from "../db3/shared/schema/eventAPI";
import { AdminInspectObject } from "./CMCoreComponents2";
import { useDashboardContext, useFeatureRecorder } from "./dashboardContext/DashboardContext";
import { AttendanceChange, AttendanceControlView } from "./event/AttendanceControlView";
import { CalcEventAttendance, type AttendanceEventMetadata } from "./event/EventComponentsBase";
import { ActivityFeature } from "./featureReports/activityTracking";
import { SettingMarkdown } from "./SettingMarkdown";
import { SnackbarContext } from "./SnackbarContext";

type CreatedUpdatedObj = {
    id: number;
    createdAt?: Date | null | undefined;
    updatedAt?: Date | null | undefined;
    createdByUserId?: number | null | undefined;
    updatedByUserId?: number | null | undefined;
};

export const CreatedUpdatedView = (props: { obj: CreatedUpdatedObj, caption: string }) => {
    const { id, createdAt, createdByUserId, updatedAt, updatedByUserId } = props.obj;
    return <AdminInspectObject src={{
        id,
        createdAt,
        createdByUserId,
        updatedAt,
        updatedByUserId,
    }} label={props.caption} />
};



export interface EventAttendanceControlProps {
    eventData: AttendanceEventMetadata;
    onRefetch: () => void,
    userMap: UserInstrumentList,
    minimalWhenNotAlert: boolean,
    //alertOnly?: boolean; // when true, the control hides unless it's an alert.
};

export const EventAttendanceControl = (props: EventAttendanceControlProps) => {
    const dashboardContext = useDashboardContext();
    const attendance = CalcEventAttendance({
        eventData: props.eventData,
        userMap: props.userMap,
        dashboardContext,
    });
    const token = API.events.updateUserEventAttendance.useToken();
    const recordFeature = useFeatureRecorder();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const onSave = async (change: AttendanceChange) => {
        const eventId = props.eventData.event.id;
        const userId = attendance.eventUserResponse.user.id;
        void recordFeature({
            feature: change.type === "segment" ? ActivityFeature.attendance_response
                : change.type === "instrument" ? ActivityFeature.attendance_instrument : ActivityFeature.attendance_comment,
            eventId,
            ...(change.type === "segment" ? { eventSegmentId: change.segmentId, attendanceId: change.attendanceId ?? undefined } : {}),
            ...(change.type === "instrument" ? { instrumentId: change.instrumentId ?? undefined } : {}),
            ...(change.type === "comment" ? { context: "EventAttendanceCommentEditorDialog" } : {}),
        });
        try {
            await token.invoke({
                eventId, userId,
                ...(change.type === "segment" ? { segmentResponses: { [change.segmentId]: { attendanceId: change.attendanceId } } } : {}),
                ...(change.type === "instrument" ? { instrumentId: change.instrumentId } : {}),
                ...(change.type === "comment" ? { comment: change.comment } : {}),
            });
            showSnackbar({ children: change.type === "comment" ? "Success" : "Response updated", severity: "success" });
            props.onRefetch();
        } catch (error) {
            console.error(error);
            showSnackbar({ children: change.type === "comment" ? "error updating event description" : "update error", severity: "error" });
            if (change.type !== "comment") props.onRefetch();
            throw error;
        }
    };
    return <AttendanceControlView attendance={attendance} event={props.eventData.event}
        minimalWhenNotAlert={props.minimalWhenNotAlert}
        debugView={<AdminInspectObject src={attendance} label="AttendanceControl" />}
        environment={{
            attendances: dashboardContext.eventAttendance.items,
            instruments: dashboardContext.instrument.items,
            onSave,
            allowUploads: true,
            datePresentation: dashboardContext.eventDatePresentation,
            commentDialogTitle: <SettingMarkdown setting="EventAttendanceCommentDialog_TitleMarkdown" />,
            commentDialogDescription: <SettingMarkdown setting="EventAttendanceCommentDialog_DescriptionMarkdown" />,
        }} />;
};
