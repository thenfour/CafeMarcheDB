import { Permission } from "@/shared/permissions";
import React, { Suspense } from "react";
import { StringToEnumValue } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChipContainer, CMStandardDBChip } from "../CMChip";
import { AdminInspectObject, KeyValueTable } from "../CMCoreComponents2";
import { useDashboardContext } from "../DashboardContext";
import { CMTab, CMTabPanel } from "../TabPanel";
import { SongsProvider } from "../song/SongsContext";
import { UserAdminPanel } from "./UserAdminPanel";
import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { StandardVariationSpec } from "../color/palette";

export enum UserDetailTabSlug {
    credits = "credits",
    attendance = "attendance",
    wiki = "wiki",
    massAnalysis = "massAnalysis",
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
    //const router = useRouter();

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
                    identity: <Suspense><UserIdentityIndicator user={user} /></Suspense>// user.googleId ? <GoogleIconSmall /> : "Password"
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
