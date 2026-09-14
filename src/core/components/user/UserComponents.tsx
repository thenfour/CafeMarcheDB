import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Button } from "@mui/material";
import { Prisma } from "db";
import React from "react";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { useDB3SelectionSource } from "src/core/db3/components/useDB3SelectionSource";
import { gIconMap } from "../../db3/components/IconMap";
import { CMLink } from "../CMLink";
import { SelectionPicker } from "../select/SelectionPicker";
import { SelectionSource } from "../select/selectionSource";
//import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
import { useDashboardContext } from '../dashboardContext/DashboardContext';
import { UserChip } from "./userChip";



//////////////////////////////////////////////////////////////////////////////////////
export interface AddUserButtonProps {
    buttonChildren?: React.ReactNode;
    filterPredicate?: (u: db3.UserPayload) => boolean;
    onSelect: (u: db3.UserPayload | null) => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

const AddUserPicker = (props: AddUserButtonProps & { onClose: () => void }) => {
    const users = useDB3SelectionSource<db3.UserPayload>({ schema: db3.xUser, allowInsertFromString: false });
    const source: SelectionSource<db3.UserPayload> = {
        ...users,
        renderValue: user => <UserChip value={user} noLink size="small" />,
        useOptions(filterText, enabled) {
            const query = users.useOptions(filterText, enabled);
            return { ...query, items: props.filterPredicate ? query.items.filter(props.filterPredicate) : query.items };
        },
    };
    return <SelectionPicker source={source} value={[]} title={props.title || "Add user"} description={props.description}
        onCancel={props.onClose} onAccept={users => { props.onSelect(users[0]!); props.onClose(); }} />;
};

export const AddUserButton = (props: AddUserButtonProps) => {
    const [addUserOpen, setAddUserOpen] = React.useState(false);
    const buttonChildren = props.buttonChildren || <>{gIconMap.Add()} Add users</>;

    return <>
        <Button type="button" onClick={() => setAddUserOpen(true)}>{buttonChildren}</Button>
        {addUserOpen && <AddUserPicker {...props} onClose={() => setAddUserOpen(false)} />}
    </>;
};


////////////////////////////////////////////////////////////////
export interface UserBreadcrumbProps {
    user: Prisma.UserGetPayload<{ select: { id: true, name: true } }>,
};
export const UserBreadcrumbs = (props: UserBreadcrumbProps) => {
    const dashboardContext = useDashboardContext();
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href="/backstage/users"
        >
            Users
        </CMLink>

        <CMLink
            href={dashboardContext.routingApi.getURIForUser(props.user)}
        >
            {IsNullOrWhitespace(props.user.name) ? props.user.id : props.user.name}
        </CMLink>

    </Breadcrumbs>
        ;
};
