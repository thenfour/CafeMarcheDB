import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import type { UserPublicId } from "shared/publicId";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import db3queries from "src/core/db3/queries/db3queries";
import { userEditorView } from "src/core/db3/shared/entities/user/userViews";
import { bandUserProfileView } from "src/core/db3/shared/entities/user/bandUserProfile";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { KeyValueTable } from "../CMCoreComponents2";
import { useRecordFeatureUse } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { UserProfileFieldsEditor } from "./UserProfileFieldsEditor";
import { BandUserInstrumentsEditor } from "./BandUserInstruments";
import { BandUserTagsEditor } from "./BandUserTags";

export function OwnAccountProfile({ personId }: { readonly personId: UserPublicId }) {
    const context = useDB3QueryContext();
    const locale = useLocale();
    const command = useDB3Command(userEditorView.crud.operations.update.command, { bandPublicId: null });
    useRecordFeatureUse({ feature: ActivityFeature.profile_view, context: `profile/${personId}` });
    const [result, { refetch }] = useQuery(db3queries, {
        ...context, bandPublicId: null,
        table: { tableID: userEditorView.tableID, tableName: userEditorView.tableName, viewID: userEditorView.viewID },
        filter: { publicIds: [personId] }, take: 1, cmdbQueryContext: "own account profile",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const row = result.items[0];
    if (!row) {
        return <Alert severity="info">{locale.getPlainString("membership.profile.accountNotFound")}</Alert>;
    }
    const person = userEditorView.parseDto(row);
    return <>
        <UserProfileFieldsEditor person={person} canEdit={person.publicId === personId} refetch={refetch}
            saveProfile={patch => command.invoke({ identity: personId, patch })} />
        <KeyValueTable data={{
            [locale.getPlainString("membership.profile.name")]: person.name,
            [locale.getPlainString("membership.profile.email")]: person.email,
            [locale.getPlainString("membership.profile.phone")]: person.phone || "—",
        }} />
    </>;
}

/** Shared profile reads stay available when selected-band membership is unavailable. */
export function OwnBandProfileAssignments({ personId }: { readonly personId: UserPublicId }) {
    const context = useDB3QueryContext();
    const [result, { refetch }] = useQuery(db3queries, {
        ...context,
        table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
        filter: { tableParams: { personPublicId: personId } }, take: 1, cmdbQueryContext: "own band profile assignments",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const row = result.items[0];
    if (!row) {
        return null;
    }
    const member = bandUserProfileView.parseDto(row);
    return <>
        <BandUserInstrumentsEditor member={member} refetch={refetch} orientation="horizontal" />
        <BandUserTagsEditor member={member} refetch={refetch} />
    </>;
}

export function OwnProfileContent({ personId }: { readonly personId: UserPublicId }) {
    const presentation = usePresentation();
    const key = `${personId}/${presentation.bandPublicId}/${presentation.data?.input.clientRequestId}`;
    return <React.Fragment key={key}>
        <OwnAccountProfile personId={personId} />
        {presentation.bandPublicId && presentation.data?.authorization.bandUserPublicId
            && <OwnBandProfileAssignments personId={personId} />}
    </React.Fragment>;
}
