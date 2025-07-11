import { Permission } from "@/shared/permissions";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Button } from "@mui/material";
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { IsNullOrWhitespace, StringToEnumValue } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { getURIForUser } from "../../db3/clientAPILL";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChipContainer, CMStandardDBChip } from "../CMChip";
import { AdminInspectObject, GoogleIconSmall, KeyValueTable } from "../CMCoreComponents2";
import { CMLink } from "../CMLink";
import { useDashboardContext } from "../DashboardContext";
import { CMTab, CMTabPanel } from "../TabPanel";
import { ChooseItemDialog } from "../select/ChooseItemDialog";
import { SongsProvider } from "../song/SongsContext";
import { UserAdminPanel } from "./UserAdminPanel";
import { UserChip } from "./userChip";
import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";

export enum UserDetailTabSlug {
    credits = "credits",
    attendance = "attendance",
    wiki = "wiki",
    massAnalysis = "massAnalysis",
};



//////////////////////////////////////////////////////////////////////////////////////
export interface AddUserButtonProps {
    buttonChildren?: React.ReactNode;
    filterPredicate?: (u: db3.UserPayload) => boolean;
    onSelect: (u: db3.UserPayload | null) => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

// todo: potential to make this more generic. add vs. change, for generic values.
export const AddUserButton = (props: AddUserButtonProps) => {
    const [addUserOpen, setAddUserOpen] = React.useState<boolean>(false);
    const buttonChildren = props.buttonChildren || <>{gIconMap.Add()} Add users</>;

    const tableClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xUser,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: { intention: "user", mode: 'primary' },
    });

    let filteredItems: db3.UserPayload[] = tableClient.items as any;
    if (props.filterPredicate) {
        filteredItems = filteredItems.filter(u => props.filterPredicate!(u));
    }

    const handleOpen = () => {
        setAddUserOpen(true);
    };

    const handleOK = (u: db3.UserPayload | null) => {
        props.onSelect(u);
        setAddUserOpen(false);
    };

    return <>
        <Button onClick={handleOpen}>{buttonChildren}</Button>
        {addUserOpen &&
            <ChooseItemDialog
                closeOnSelect={true}
                isEqual={(a: db3.UserMinimumPayload, b: db3.UserMinimumPayload) => a.id === b.id}
                items={filteredItems}
                value={null as db3.UserPayload | null}
                title={props.title || "Add user"}
                onCancel={() => setAddUserOpen(false)}
                onOK={(u: db3.UserPayload) => handleOK(u)}
                renderValue={(u) => <UserChip value={u.value} />}
                renderAsListItem={(p, u: db3.UserPayload) => <UserChip value={u} />}
                description={props.description}
            />}
    </>;
};


////////////////////////////////////////////////////////////////
export interface UserBreadcrumbProps {
    user: Prisma.UserGetPayload<{ select: { id: true, name: true } }>,
};
export const UserBreadcrumbs = (props: UserBreadcrumbProps) => {
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
            href={getURIForUser(props.user)}
        >
            {IsNullOrWhitespace(props.user.name) ? props.user.id : props.user.name}
        </CMLink>

    </Breadcrumbs>
        ;
};

////////////////////////////////////////////////////////////////
export interface UserDetailArgs {
    user: db3.EnrichedVerboseUser;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
    initialTab?: UserDetailTabSlug;
}

export const UserDetail = ({ user, tableClient, ...props }: UserDetailArgs) => {
    const dashboardContext = useDashboardContext();
    const router = useRouter();

    const [selectedTab, setSelectedTab] = React.useState<UserDetailTabSlug>(props.initialTab || UserDetailTabSlug.attendance);

    const refetch = () => {
        tableClient.refetch();
    };

    const handleTabChange = (newId: string) => {
        const slug = StringToEnumValue(UserDetailTabSlug, (newId || "").toString()) || UserDetailTabSlug.attendance;
        setSelectedTab(slug);
    }

    return <div className="EventDetail contentSection event">
        <div className='content'>

            <div className='titleLine'>
                <div className="titleText">
                    <div className="titleLink">
                        <span className='title'>{user.name}</span>
                    </div>
                </div>

                <CMChipContainer>
                    <CMStandardDBChip
                        size='small'
                        shape="rectangle"
                        model={user.role}
                        variation={StandardVariationSpec.Strong}
                        getTooltip={(_) => user.role?.description || null}
                    />
                </CMChipContainer>

                <div className='flex-spacer'></div>

                <AdminInspectObject src={user} />

            </div>{/* title line */}

            <UserAdminPanel
                user={user}
                tableClient={tableClient}
                readonly={props.readonly}
                refetch={refetch}
            />

            {dashboardContext.isAuthorized(Permission.search_users) &&
                <CMChipContainer>
                    {user.tags.map(tag => <CMStandardDBChip
                        key={tag.id}
                        size='small'
                        model={tag.userTag}
                        variation={StandardVariationSpec.Weak}
                        getTooltip={(_) => tag.userTag.description}
                    />)}
                </CMChipContainer>
            }
            {dashboardContext.isAuthorized(Permission.search_users) &&
                <CMChipContainer>
                    {user.instruments.map(tag => <CMStandardDBChip
                        key={tag.id}
                        size='small'
                        model={{ ...tag.instrument, color: tag.instrument.functionalGroup.color }}
                        variation={StandardVariationSpec.Weak}
                        getTooltip={(_) => tag.instrument.description}
                    />)}
                </CMChipContainer>
            }
            {dashboardContext.isAuthorized(Permission.manage_users) &&
                <KeyValueTable data={{
                    phone: user.phone,
                    email: user.email,
                    identity: user.googleId ? <GoogleIconSmall /> : "Password"
                }} />
            }

            {dashboardContext.isAuthorized(Permission.sysadmin) &&
                <CMTabPanel
                    selectedTabId={selectedTab}
                    handleTabChange={(e, newId) => handleTabChange(newId as string)}
                >
                    <CMTab
                        thisTabId={UserDetailTabSlug.attendance}
                        summaryTitle={"Attendance"}
                        summaryIcon={gIconMap.Check()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserAttendanceTabContent user={user} />
                        </Suspense>
                    </CMTab>
                    <CMTab
                        thisTabId={UserDetailTabSlug.credits}
                        summaryTitle={"Credits"}
                        summaryIcon={gIconMap.Comment()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <SongsProvider>
                                <UserCreditsTabContent user={user} />
                            </SongsProvider>
                        </Suspense>
                    </CMTab>
                    <CMTab
                        thisTabId={UserDetailTabSlug.wiki}
                        summaryTitle={"Wiki Contributions"}
                        summaryIcon={gIconMap.Article()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserWikiContributionsTabContent user={user} />
                        </Suspense>
                    </CMTab>
                    <CMTab
                        thisTabId={UserDetailTabSlug.massAnalysis}
                        summaryTitle={"Mass Analysis"}
                        summaryIcon={gIconMap.Info()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserMassAnalysisTabContent user={user} />
                        </Suspense>
                    </CMTab>
                </CMTabPanel>
            }
        </div>
    </div>;
};
