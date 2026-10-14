import { portalHref } from "src/route/portalRouting";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs } from "@mui/material";
import type { UserPublicId } from "shared/publicId";
import React from "react";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "../../db3/components/IconMap";
import { CMLink } from "@/src/route/CMLink";
import { SelectionPicker } from "../select/SelectionPicker";
import { makeLocalSelectionSource } from "../select/selectionSource";
//import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
import { useDashboardContext } from '../dashboardContext/DashboardContext';
import { UserChip } from "./userChip";
import { CMButton } from '../CMCoreComponents2';



//////////////////////////////////////////////////////////////////////////////////////
export interface AddUserButtonProps {
    buttonChildren?: React.ReactNode;
    filterPredicate?: (u: db3.EventParticipant) => boolean;
    onSelect: (u: db3.EventParticipant | null) => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

const AddUserPicker = (props: AddUserButtonProps & { onClose: () => void }) => {
    const dashboard = useDashboardContext();
    const members = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec: DB3Client.defineTableClientSpec({ view: db3.eventParticipantView, columns: {} }),
        referenceProvider: dashboard.referenceStore,
        queryOptions: { staleTime: 0, cacheTime: 0, keepPreviousData: false },
    });
    const people = members.items.map(db3.eventParticipantFromMembership)
        .filter((person): person is db3.EventParticipant => person !== null)
        .filter(person => !props.filterPredicate || props.filterPredicate(person));
    const source = makeLocalSelectionSource<db3.EventParticipant>({
        items: people,
        getKey: person => person.membershipId,
        getLabel: person => person.name,
        renderValue: user => <UserChip value={user} noLink size="small" />,
    });
    return <SelectionPicker source={source} value={[]} title={props.title || "Add user"} description={props.description}
        onCancel={props.onClose} onAccept={users => { props.onSelect(users[0]!); props.onClose(); }} />;
};

export const AddUserButton = (props: AddUserButtonProps) => {
    const [addUserOpen, setAddUserOpen] = React.useState(false);
    const buttonChildren = props.buttonChildren || <>{gIconMap.Add()} Add users</>;

    return <>
        <CMButton type="button" onClick={() => setAddUserOpen(true)}>{buttonChildren}</CMButton>
        {addUserOpen && <AddUserPicker {...props} onClose={() => setAddUserOpen(false)} />}
    </>;
};


////////////////////////////////////////////////////////////////
export interface UserBreadcrumbProps {
    user: { publicId: UserPublicId; name: string },
};
export const UserBreadcrumbs = (props: UserBreadcrumbProps) => {
    const dashboardContext = useDashboardContext();
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href={portalHref("/backstage", dashboardContext.memberPresentation, dashboardContext.portalHosting)}
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href={portalHref("/backstage/users", dashboardContext.memberPresentation, dashboardContext.portalHosting)}
        >
            Users
        </CMLink>

        <CMLink
            href={dashboardContext.routingApi.getURIForUser(props.user)}
        >
            {IsNullOrWhitespace(props.user.name) ? props.user.publicId : props.user.name}
        </CMLink>

    </Breadcrumbs>
        ;
};
