import { Permission } from "@/shared/permissions";
import getUserManagementCapabilities from "@/src/auth/queries/getUserManagementCapabilities";
import { useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React, { Suspense } from "react";
import { StringToEnumValue } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip, CMChipContainer, CMStandardDBChip } from "../CMChip";
import { AdminInspectObject, CMButtonGroup, KeyValueTable } from "../CMCoreComponents2";
import { useSnackbar } from "../SnackbarContext";
import { CMTab, CMTabPanel } from "../TabPanel";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { CMSelectDisplayStyle, CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/CMSingleSelectDialog";
import { SongsProvider } from "../song/SongsContext";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { EditUserProfileButton } from "./EditUserProfileButton";
import { UserAdminPanel } from "./UserAdminPanel";
import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { EnrichedVerboseUser } from "./UserListItem";
import { UserSignInMethodsButton } from "./UserSignInMethodsButton";
import type { UserPublicId } from "shared/publicId";

type RoleControlProps = {
    value: db3.RoleDisplay | null | undefined;
    userId: UserPublicId;
    tableClient: DB3Client.xTableRenderClient<typeof db3.userEditorView>;
    readonly: boolean;
    onChange: () => void;
};

export const RoleControl = ({ value, userId, tableClient, readonly, onChange }: RoleControlProps) => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const editCommands = DB3Client.useCrudViewCommands({
        view: db3.userEditorView,
        tableClient,
    });
    return (
        <CMSingleSelect<db3.RoleDisplay>
            value={value ?? null}
            readonly={readonly}
            nullBehavior={CMSelectNullBehavior.AllowNull}
            onChange={async (option) => {
                await snackbar.invokeAsync(async () => {
                    const newid = option ? db3.xRole.getIdentity(option) : null;
                    console.log("Updating role for userId:", userId, "to roleId:", newid, " - ", dashboardContext.role.getById(newid));
                    await editCommands.update({
                        publicId: userId,
                        roleId: newid,
                        //role: dashboardContext.role.getById(newid) ?? null,
                    }, {
                        publicId: userId,
                        roleId: value ? db3.xRole.getIdentity(value) : null,
                    });
                });
                onChange();
            }}
            displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
            renderOption={(item) => {
                return item.name;
            }}
            getOptions={(args) => {
                return dashboardContext.role.items;
            }}
            getOptionInfo={(item) => {
                return {
                    id: db3.xRole.getIdentity(item),
                    color: item.color,
                    tooltip: item.description ?? undefined,
                };
            }}
        />
    );
};










export enum UserDetailTabSlug {
    credits = "credits",
    attendance = "attendance",
    wiki = "wiki",
    massAnalysis = "massAnalysis",
};


////////////////////////////////////////////////////////////////
export interface UserDetailArgs {
    user: EnrichedVerboseUser;
    tableClient: DB3Client.xTableRenderClient<typeof db3.userEditorView>;
    readonly: boolean;
    initialTab?: UserDetailTabSlug;
}

export const UserDetail = ({ user, tableClient, ...props }: UserDetailArgs) => {

    const [capabilities, { refetch: refetchCapabilities }] = useQuery(
        getUserManagementCapabilities,
        { userId: user.publicId },
    );


    const dashboardContext = useDashboardContext();
    const canViewBasicInfo = dashboardContext.isAuthorized(Permission.view_users_basic_info);
    const canViewContactInfo = dashboardContext.isAuthorized(Permission.view_user_contact_info);
    const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);

    const [selectedTab, setSelectedTab] = React.useState<UserDetailTabSlug>(props.initialTab || UserDetailTabSlug.attendance);

    const refetch = async () => {
        await tableClient.refetch();
        await refetchCapabilities();
    };

    const handleTabChange = (newId: string) => {
        const slug = StringToEnumValue(UserDetailTabSlug, (newId || "").toString()) || UserDetailTabSlug.attendance;
        setSelectedTab(slug);
    }

    return <div className="EventDetail contentSection event">
        <div className='content'>
            {canManageUsers && user.isDeleted && <Alert severity="warning">
                {capabilities.mergedIntoUserId != null
                    ? <>This account was merged into <a href={`/backstage/user/${capabilities.mergedIntoUserId}`}>account #{capabilities.mergedIntoUserId}</a> and cannot be reactivated.</>
                    : "This user account is deactivated."}
            </Alert>}

            <div className='titleLine'>
                <div className="titleText">
                    <div className="titleLink">
                        <span className='title'>{user.name}</span>
                    </div>
                </div>

                {canManageUsers && <RoleControl
                    userId={user.publicId}
                    value={user.role}
                    readonly={props.readonly || !capabilities.canAssignRole}
                    tableClient={tableClient}
                    onChange={async () => {
                        await refetch();
                    }}
                />}

                <div className='flex-spacer'></div>

                <AdminInspectObject src={user} />

            </div>{/* /title line */}

            {canViewBasicInfo &&
                <CMChipContainer>
                    {user.tags.map(tag => <CMStandardDBChip
                        key={db3.xUserTagAssignment.getIdentity(tag)}
                        size='small'
                        model={tag.userTag}
                        variation={StandardVariationSpec.Weak}
                        getTooltip={(_) => tag.userTag.description}
                    />)}
                </CMChipContainer>
            }
            {canViewBasicInfo &&
                <CMChipContainer>
                    {user.instruments.map(tag => <CMStandardDBChip
                        key={db3.xUserInstrument.getIdentity(tag)}
                        size='small'
                        model={{ ...tag.instrument, color: tag.instrument.functionalGroup.color }}
                        variation={StandardVariationSpec.Weak}
                        getTooltip={(_) => tag.instrument.description}
                    />)}
                </CMChipContainer>
            }

            <CMButtonGroup>

                {canManageUsers && (
                    <EditUserProfileButton
                        readonly={props.readonly}
                        tableClient={tableClient}
                        user={user}
                        onOK={refetch}
                    />
                )}

                <UserAdminPanel
                    user={user}
                    refetch={refetch}
                    capabilities={capabilities}
                />
            </CMButtonGroup>

            {canViewContactInfo &&
                <KeyValueTable data={{
                    Phone: <CMChipContainer>
                        {user.phone && <CMChip>{user.phone}</CMChip>}
                        {!user.phone && <span>-</span>}
                    </CMChipContainer>,
                    Email: <>
                        <CMChipContainer>
                            <CMChip>{user.email}</CMChip>
                        </CMChipContainer>
                    </>,
                }} />
            }

            {canManageUsers &&
                <KeyValueTable data={{
                    Identity: <Suspense>
                        <CMChipContainer>
                            <UserIdentityIndicator user={user} />

                            <CMButtonGroup>
                                {capabilities.canResetPassword && <AdminResetPasswordButton user={user} />}
                                {capabilities.canManageSignInMethods && <UserSignInMethodsButton user={user} onChanged={refetch} />}
                            </CMButtonGroup>
                        </CMChipContainer>
                    </Suspense>,
                }} />
            }

            {dashboardContext.isAuthorized(Permission.sysadmin) && (

                <CMTabPanel
                    selectedTabId={selectedTab}
                    handleTabChange={(e, newId) => handleTabChange(newId as string)}
                >
                    <CMTab
                        enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
                        thisTabId={UserDetailTabSlug.attendance}
                        summaryTitle={"Attendance"}
                        summaryIcon={gIconMap.Check()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserAttendanceTabContent user={user} />
                        </Suspense>
                    </CMTab>
                    <CMTab
                        enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
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
                        enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
                        thisTabId={UserDetailTabSlug.wiki}
                        summaryTitle={"Wiki Contributions"}
                        summaryIcon={gIconMap.Article()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserWikiContributionsTabContent user={user} />
                        </Suspense>
                    </CMTab>
                    <CMTab
                        enabled={dashboardContext.isAuthorized(Permission.sysadmin)}
                        thisTabId={UserDetailTabSlug.massAnalysis}
                        summaryTitle={"Mass Analysis"}
                        summaryIcon={gIconMap.Info()}
                    >
                        <Suspense fallback={<div className="lds-dual-ring"></div>}>
                            <UserMassAnalysisTabContent user={user} />
                        </Suspense>
                    </CMTab>
                </CMTabPanel>
            )}
        </div>
    </div>;
};

