import { useQuery } from "@blitzjs/rpc";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs, Button } from "@mui/material";
import { Prisma } from "db";
import { useRouter } from "next/router";
import React, { Suspense } from "react";
import { StandardVariationSpec } from "shared/color";
import { SortDirection } from "shared/rootroot";
import { getHashedColor, IsNullOrWhitespace, StringToEnumValue } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { API } from '../db3/clientAPI';
import { getURIForUser } from "../db3/clientAPILL";
import { gIconMap } from "../db3/components/IconMap";
import getUserCredits from "../db3/queries/getUserCredits";
import getUserEventAttendance from "../db3/queries/getUserEventAttendance";
import getUserWikiContributions from "../db3/queries/getUserWikiContributions";
import { DiscreteCriterion } from "../db3/shared/apiTypes";
import { CMChipContainer, CMStandardDBChip } from "./CMChip";
import { AttendanceChip, EventTextLink, InstrumentChip, SongChip } from "./CMCoreComponents";
import { AdminInspectObject, CMTable, GoogleIconSmall, KeyValueTable } from "./CMCoreComponents2";
import { ChooseItemDialog } from "./ChooseItemDialog";
import { useDashboardContext } from "./DashboardContext";
import { SongsProvider, useSongsContext } from "./SongsContext";
import { CMTab, CMTabPanel } from "./TabPanel";
import { UserChip } from "./userChip";
import { Markdown } from "./markdown/Markdown";
import { Permission } from "@/shared/permissions";
import { EventShortDate } from "./EventComponentsBase";
import { CMLink } from "./CMLink";

export enum UserDetailTabSlug {
    credits = "credits",
    attendance = "attendance",
    wiki = "wiki",
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
    const sortedQrWithIndex = sortedQr.map((event, index) => ({
        ...event,
        index: index + 1, // add an index for display purposes
    }));

    return <div className="UserAttendanceTabContent">
        <AdminInspectObject src={qr} label="results" />

        <CMTable
            className="userAttendanceTable"
            getRowStyle={(row) => {
                const year = row.row.startsAt ? new Date(row.row.startsAt).getFullYear() : 0;
                const month = row.row.startsAt ? new Date(row.row.startsAt).getMonth() : 0;
                const yearColorA = getHashedColor(`${year}`, { alpha: "5%" });
                const yearColorB = getHashedColor(`${year}`, { alpha: "15%" });
                return {
                    backgroundColor: month % 2 === 0 ? yearColorA : yearColorB,
                }
            }}
            rows={sortedQrWithIndex} columns={[
                {
                    allowSort: true,
                    memberName: "index",
                    render: (row) => {
                        return <span className="pre">#{row.row.index}</span>;
                    }
                },
                {
                    allowSort: false,
                    header: "Event",
                    render: (row) => <EventTextLink event={row.row} />,
                    compareFn: (a, b) => {
                        const aName = a.name || "";
                        const bName = b.name || "";
                        return aName.localeCompare(bName);
                    },
                },
                {
                    allowSort: true,
                    memberName: "startsAt",
                    header: "Date",
                    render: (row) => {
                        return <EventShortDate event={row.row} />;
                    }
                },
                {
                    allowSort: true,
                    memberName: "instrumentId",
                    header: "Instrument",
                    render: (row) => {
                        const inst = dashboardContext.instrument.getById(row.row.instrumentId);
                        return inst ? <InstrumentChip value={inst} /> : <span>--</span>;
                    },
                    compareFn: (a, b) => {
                        const aInst = dashboardContext.instrument.getById(a.instrumentId);
                        const bInst = dashboardContext.instrument.getById(b.instrumentId);
                        const aName = aInst ? aInst.name : "";
                        const bName = bInst ? bInst.name : "";
                        return aName.localeCompare(bName);
                    }

                },
                {
                    allowSort: false,
                    header: "Response(s)",
                    render: (row) => {
                        const segs = API.events.sortEvents(row.row.segments);
                        return <CMChipContainer>
                            {segs.map(seg => {
                                const att = dashboardContext.eventAttendance.getById(seg.attendanceId);
                                return <AttendanceChip
                                    key={seg.id}
                                    size={"small"}
                                    fadeNoResponse={true}
                                    showLabel={false}
                                    value={att}

                                    event={row.row}
                                    eventSegment={seg}
                                // todo: eventSegmentResponse and eventResponse.
                                />
                            })}
                        </CMChipContainer>;
                    }
                },
                {
                    allowSort: true,
                    memberName: "userComment",
                    header: "Comments",
                    render: (row) => <Markdown markdown={row.row.userComment || ""} />,
                }
            ]} />

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

    const songCreditsWithAddl = qr.songCredits.map((credit, index) => ({
        ...credit,
        rowIndex: index,
        songYear: allSongs.find(s => s.id === credit.songId)?.introducedYear,
        songName: allSongs.find(s => s.id === credit.songId)?.name || `#${credit.songId}`,
    }));

    return <CMTable
        rows={songCreditsWithAddl}
        columns={[
            {
                header: "#",
                allowSort: false,
                memberName: "rowIndex",
                render: (row) => {
                    return <span className="pre">#{row.rowIndex + 1}</span>;
                },
            },
            {
                header: "Song",
                memberName: "songName",
                allowSort: true,
                render: (row) => {
                    return <SongChip value={allSongs.find(s => s.id === row.row.songId) || { id: row.row.songId, name: `#${row.row.songId}` }} />;
                },
            },
            {
                header: "Song year",
                allowSort: true,
                memberName: "songYear",
                render: (row) => {
                    const song = allSongs.find(s => s.id === row.row.songId)!;
                    return <span>{song?.introducedYear}</span>;
                },
            },
            {
                header: "Credit type",
                memberName: "typeId",
                render: (row) => {
                    return <span>{dashboardContext.songCreditType.getById(row.row.typeId)?.text}</span>;
                },
            },
            {
                header: "Credit year",
                memberName: "year",
            },
            {
                memberName: "comment",
                render: (row) => {
                    return <Markdown markdown={row.row.comment} />;
                }
            }
        ]}
    />;
};


////////////////////////////////////////////////////////////////
type UserWikiContributionsTabContentProps = {
    user: db3.EnrichedVerboseUser;
};
export const UserWikiContributionsTabContent = (props: UserWikiContributionsTabContentProps) => {
    const dashboardContext = useDashboardContext();
    const [qr, refetch] = useQuery(getUserWikiContributions, { userId: props.user.id });

    const wikiContributionsWithAddl = qr.wikiContributions.map((contribution, index) => ({
        ...contribution,
        rowIndex: index,
        totalRevisions: contribution.revisions.length,
        lastRevisionDate: contribution.revisions[0]?.createdAt,
        firstRevisionDate: contribution.revisions[contribution.revisions.length - 1]?.createdAt,
    }));

    return <div className="UserWikiContributionsTabContent">
        <AdminInspectObject src={qr} label="wiki contributions" />

        <CMTable
            rows={wikiContributionsWithAddl}
            columns={[
                {
                    header: "#",
                    allowSort: false,
                    memberName: "rowIndex",
                    render: (row) => {
                        return <span className="pre">#{row.rowIndex + 1}</span>;
                    },
                },
                {
                    header: "Wiki Page",
                    memberName: "slug",
                    allowSort: true,
                    render: (row) => {
                        return <CMLink href={`/backstage/wiki/${row.row.slug}`}>{row.row.slug}</CMLink>;
                    },
                },
                {
                    header: "Revisions",
                    memberName: "totalRevisions",
                    allowSort: true,
                    render: (row) => {
                        return <span>{row.row.totalRevisions}</span>;
                    },
                }, {
                    header: "First Contribution",
                    memberName: "firstRevisionDate",
                    allowSort: true,
                    render: (row) => {
                        if (!row.row.firstRevisionDate) return <span>-</span>;
                        const date = new Date(row.row.firstRevisionDate);
                        return <span>{date.toLocaleDateString()}</span>;
                    },
                },
                {
                    header: "Last Contribution",
                    memberName: "lastRevisionDate",
                    allowSort: true,
                    render: (row) => {
                        if (!row.row.lastRevisionDate) return <span>-</span>;
                        const date = new Date(row.row.lastRevisionDate);
                        return <span>{date.toLocaleDateString()}</span>;
                    },
                },
            ]}
        />
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

                <AdminInspectObject src={user} />

            </div>{/* title line */}

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
                </CMTabPanel>
            }
        </div>
    </div>;
};
