import React from "react";
import * as db3 from "src/core/db3/db3";
import { API } from "../../db3/clientAPI";
import { useDB3Authorization } from "../../db3/components/useDB3Authorization";
import { CMStandardDBChip } from "../CMChip";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { CMSelectDisplayStyle, SelectionField } from "../select/SelectionField";
import { CMSelectNullBehavior, makeLocalSelectionSource, withNullSelection } from "../select/selectionSource";
import { GenerateDefaultDescriptionSettingName, SettingMarkdown } from "../SettingMarkdown";
import { SnackbarContext } from "../SnackbarContext";
import type { EventPublicId, UserPublicId } from "shared/publicId";

interface EventAttendanceUserTagControlEvent {
    publicId: EventPublicId;
    createdByUser: { publicId: UserPublicId } | null;
    expectedAttendanceUserTag: db3.UserTagDisplay | null;
}

export const EventAttendanceUserTagControl = ({ event, refetch, readonly }: { event: EventAttendanceUserTagControlEvent; refetch: () => void; readonly: boolean }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage } = React.useContext(SnackbarContext);
    const dashboard = useDashboardContext();
    const recordFeature = useFeatureRecorder();
    const publicData = useDB3Authorization();
    const authorizedForEdit = db3.xEvent.authorizeColumnForEdit({
        publicData, model: event, columnName: "expectedAttendanceUserTag",
        fallbackOwnerId: null,
        fallbackOwnerPublicId: event.createdByUser?.publicId ?? null,
    });

    const handleChange = (value: db3.UserTagDisplay | null | undefined) => {
        void recordFeature({ feature: ActivityFeature.event_change_invite_tag });
        mutationToken.invoke({
            eventId: event.publicId,
            expectedAttendanceUserTagId: value ? db3.xUserTag.getIdentity(value) : null,
        }).then(() => {
            showMessage({ severity: "success", children: "Successfully updated event attendance tag" });
        }).catch(error => {
            console.error(error);
            showMessage({ severity: "error", children: "Error updating event attendance tag" });
        }).finally(refetch);
    };

    const source = withNullSelection(makeLocalSelectionSource<db3.UserTagDisplay>({
        items: dashboard.userTag.items,
        getKey: tag => db3.xUserTag.getIdentity(tag),
        getLabel: tag => tag.text,
        renderValue: tag => <CMStandardDBChip model={tag} />,
    }), CMSelectNullBehavior.AllowNull, () => "No tags are invited");

    return <SelectionField className={`eventStatusControl ${event.expectedAttendanceUserTag?.significance}`} source={source}
        value={[event.expectedAttendanceUserTag]} readonly={readonly || !authorizedForEdit} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        dialogTitle="Expected attendance group"
        dialogDescription={<SettingMarkdown setting={GenerateDefaultDescriptionSettingName("event", "expectedAttendanceUserTag")} />}
        onChange={values => handleChange(values[0]!)} />;
};
