import { useQuery } from "@blitzjs/rpc";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Button, Link } from "@mui/material";
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { SortDirection } from "shared/rootroot";
import { getHashedColor, IsNullOrWhitespace, StringToEnumValue } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { getURIForSong, getURIForUser } from "../db3/clientAPILL";
import { gIconMap } from "../db3/components/IconMap";
import getUserCredits from "../db3/queries/getUserCredits";
import getUserEventAttendance from "../db3/queries/getUserEventAttendance";
import { DiscreteCriterion } from "../db3/shared/apiTypes";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { AdminInspectObject, AttendanceChip, EventTextLink, InspectObject, InstrumentChip, UserChip } from "./CMCoreComponents";
import { GoogleIconSmall, KeyValueTable } from "./CMCoreComponents2";
import { ChooseItemDialog } from "./ChooseItemDialog";
import { useDashboardContext } from "./DashboardContext";
import { CMTab, CMTabPanel } from "./TabPanel";
import { SongsProvider, useSongsContext } from "./SongsContext";



export enum UserDetailTabSlug {
    credits = "credits",
    attendance = "attendance",
};



////////////////////////////////////////////////////////////////////////////////////////////////////
export enum UserOrderByColumnOptions {
    id = "id",
    name = "name",
};

export type UserOrderByColumnOption = keyof typeof UserOrderByColumnOptions;

export interface UsersFilterSpec {
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: UserOrderByColumnOptions;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
    instrumentFilter: DiscreteCriterion;
    roleFilter: DiscreteCriterion;
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
        <Link
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </Link>
        <Link
            underline="hover"
            color="inherit"
            href="/backstage/users"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Users
        </Link>

        <Link
            underline="hover"
            color="inherit"
            href={getURIForUser(props.user)}
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            {IsNullOrWhitespace(props.user.name) ? props.user.id : props.user.name}
        </Link>

    </Breadcrumbs>
        ;
};

////////////////////////////////////////////////////////////////
type UserAttendanceTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserAttendanceTabContent = (props: UserAttendanceTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [qr, refetch] = useQuery(getUserEventAttendance, { userId: props.user.id });
    const agg = qr.events.reduce((acc, event) => {
        const segAgg = event.segments.reduce((segAcc, seg) => {
            const hasResponse = seg.attendanceId != null;
            const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
            return {
                responseCount: segAcc.responseCount + (hasResponse ? 1 : 0),
                goingCount: segAcc.goingCount + ((att?.strength || 0) > 50 ? 1 : 0),
            };
        }, { responseCount: 0, goingCount: 0 });
        return {
            totalSegmentCount: acc.totalSegmentCount + event.segments.length,
            responseCount: acc.responseCount + segAgg.responseCount,
            goingCount: acc.goingCount + segAgg.goingCount,
        };
    }, { totalSegmentCount: 0, responseCount: 0, goingCount: 0 });

    const sortedQr = API.events.sortEvents(qr.events);

    return <div className="UserAttendanceTabContent">
        <AdminInspectObject src={qr} label="results" />
        <table className="userAttendanceTable">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Instrument</th>
                    <th>Response(s)</th>
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
                {sortedQr.map(event => {
                    const inst = dashboardContext.instrument.getById(event.instrumentId);
                    const sortedSegs = API.events.sortEvents(event.segments);
                    const year = event.startsAt ? new Date(event.startsAt).getFullYear() : 0;
                    const month = event.startsAt ? new Date(event.startsAt).getMonth() : 0;
                    const yearColorA = getHashedColor(`${year}`, { alpha: "5%" });
                    const yearColorB = getHashedColor(`${year}`, { alpha: "15%" });
                    return <tr key={event.id} style={{ backgroundColor: month % 2 === 0 ? yearColorA : yearColorB }}>
                        <td style={{ overflow: "hidden" }}><EventTextLink event={event} /></td>
                        <td>{inst && <InstrumentChip value={inst} />}</td>
                        <td><CMChipContainer>
                            {sortedSegs.map(seg => {
                                const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
                                return <AttendanceChip key={seg.id} size={"small"} fadeNoResponse={true} showLabel={false} value={att} tooltipOverride={db3.EventAPI.getLabel(seg)} />
                            })}</CMChipContainer></td>
                        <td>{event.userComment}</td>
                    </tr>;
                })}
            </tbody>
        </table>

        {agg.totalSegmentCount > 0 &&
            <KeyValueTable data={{
                ...agg,
                "Response rate": <>{(agg.responseCount * 100 / agg.totalSegmentCount).toFixed(1)}%</>,
                "Attendance rate (overall)": <>{(agg.goingCount * 100 / agg.totalSegmentCount).toFixed(1)}%</>,
                "Attendance rate (when responding)": <>{(agg.goingCount * 100 / agg.responseCount).toFixed(1)}%</>,
            }} />}

    </div>;
};


////////////////////////////////////////////////////////////////
type UserCreditsTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserCreditsTabContent = (props: UserCreditsTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const allSongs = useSongsContext().songs;
    const [qr, refetch] = useQuery(getUserCredits, { userId: props.user.id });

    return <div>
        <table className="songCreditTable">
            <thead>
                <tr>
                    <th>Song</th>
                    <th>Credit</th>
                </tr>
            </thead>
            <tbody>
                {qr.songCredits.map(sc => {
                    const song = allSongs.find(s => s.id === sc.songId)!;
                    return <tr key={sc.id}>
                        <td><a href={getURIForSong(song || { id: sc.songId, name: `#${sc.songId}` })} target="_blank" rel="noreferrer">{song?.name || sc.songId}</a></td>
                        <td>{dashboardContext.songCreditType.getById(sc.typeId)?.text}</td>
                    </tr>
                })}
            </tbody>
        </table>
    </div>;
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

                {
                    dashboardContext.isShowingAdminControls && <>
                        <KeyValueTable
                            data={{ userId: user.id }}
                        />
                        <InspectObject src={user} />
                    </>
                }

            </div>{/* title line */}

            <CMChipContainer>
                {user.tags.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={tag.userTag}
                    variation={StandardVariationSpec.Weak}
                    getTooltip={(_) => tag.userTag.description}
                />)}
            </CMChipContainer>

            <CMChipContainer>
                {user.instruments.map(tag => <CMStandardDBChip
                    key={tag.id}
                    size='small'
                    model={{ ...tag.instrument, color: tag.instrument.functionalGroup.color }}
                    variation={StandardVariationSpec.Weak}
                    getTooltip={(_) => tag.instrument.description}
                />)}
            </CMChipContainer>

            <KeyValueTable data={{
                phone: user.phone,
                email: user.email,
                identity: user.googleId ? <GoogleIconSmall /> : "Password"
            }} />

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
            </CMTabPanel>

        </div>
    </div>;
};
