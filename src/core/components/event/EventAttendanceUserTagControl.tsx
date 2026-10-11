import React from "react";
import type { EventPublicId, UserPublicId } from "shared/publicId";
import * as db3 from "src/core/db3/db3";
import { BandLocalizedMarkdown } from "../../../setting/client/components/SettingMarkdown";
import { API } from "../../db3/clientAPI";
import { useClientAuth } from "../../db3/components/useClientAuth";
import { CMStandardDBChip } from "../CMChip";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { CMSelectDisplayStyle, SelectionField } from "../select/SelectionField";
import { CMSelectNullBehavior, makeLocalSelectionSource, withNullSelection } from "../select/selectionSource";
import { SnackbarContext } from "../SnackbarContext";

interface EventAttendanceUserTagControlEvent {
    publicId: EventPublicId;
    createdByUser: { publicId: UserPublicId } | null;
    expectedAttendanceUserTag: Pick<db3.UserTagDisplay, "publicId"> | null;
}

export const EventAttendanceUserTagControl = ({ event, refetch, readonly }: { event: EventAttendanceUserTagControlEvent; refetch: () => void; readonly: boolean }) => {
    const mutationToken = API.events.updateEventBasicFields.useToken();
    const { showMessage } = React.useContext(SnackbarContext);
    const dashboard = useDashboardContext();
    const selectedTag = event.expectedAttendanceUserTag
        ? dashboard.userTag.getById(event.expectedAttendanceUserTag.publicId) ?? null
        : null;
    const recordFeature = useFeatureRecorder();
    const auth = useClientAuth();
    const authorizedForEdit = db3.xEvent.authorizeColumnForEdit({
        auth: auth, model: event, columnName: "expectedAttendanceUserTag",
        fallbackOwnerId: null,
        fallbackOwnerPublicId: event.createdByUser?.publicId ?? null,
    });

    const handleChange = (value: db3.UserTagDisplay | null | undefined) => {
        void recordFeature({ feature: ActivityFeature.event_change_invite_tag });
        mutationToken.invoke({
            eventId: event.publicId,
            bandPublicId: dashboard.requireBandPublicId(),
            expectedAttendanceUserTagId: value ? db3.xBandUserTag.getIdentity(value) : null,
        }).then(() => {
            showMessage({ severity: "success", children: "Successfully updated event attendance tag" });
        }).catch(error => {
            console.error(error);
            showMessage({ severity: "error", children: "Error updating event attendance tag" });
        }).finally(refetch);
    };

    const source = withNullSelection(makeLocalSelectionSource<db3.UserTagDisplay>({
        items: dashboard.userTag.items,
        getKey: tag => db3.xBandUserTag.getIdentity(tag),
        getLabel: tag => tag.name,
        renderValue: tag => <CMStandardDBChip model={tag} />,
    }), CMSelectNullBehavior.AllowNull, () => "No tags are invited");

    return <SelectionField className={`eventStatusControl ${selectedTag?.cssClass ?? ""}`} source={source}
        value={[selectedTag]}
        readonly={readonly || !authorizedForEdit} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        dialogTitle="Expected attendance group"
        dialogDescription={<BandLocalizedMarkdown id={"event.expectedAttendanceUserTag.DescriptionMarkdown"} />}
        onChange={values => handleChange(values[0]!)} />;
};
