import { Suspense } from "react";
import * as db3 from "src/core/db3/db3";
import { gIconMap } from "../../db3/components/IconMap";
import { SearchResultsRet } from "../../db3/shared/apiTypes";
import { EnrichedUser } from "../../db3/shared/schema/enrichedUserTypes";
import { CMChip, CMChipContainer, CMDivider, CMStandardDBChip } from "../CMChip";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { GenericSearchListItem } from "../search/SearchListItem";
import { UsersFilterSpec } from "./UserClientBaseTypes";
import { UserIdentityIndicator } from "./UserIdentityIndicator";
import { Permission } from "@/shared/permissions";

export type EnrichedVerboseUser = EnrichedUser<db3.UserClientPayload>;

type UserListItemProps = {
    index: number;
    user: EnrichedVerboseUser;
    results: SearchResultsRet;
    refetch: () => void;
    filterSpec: UsersFilterSpec;
};

export const UserListItem = (props: UserListItemProps) => {
    const dashboardContext = useDashboardContext();
    const canViewContactInfo = dashboardContext.isAuthorized(Permission.view_user_contact_info);
    const canManageUsers = dashboardContext.isAuthorized(Permission.manage_users);
    return <GenericSearchListItem<EnrichedVerboseUser>
        index={props.index}
        item={props.user}
        icon={gIconMap.Person()}
        refetch={props.refetch}
        href={dashboardContext.routingApi.getURIForUser(props.user)}
        title={props.user.name}
        titleExtra={canManageUsers && props.user.isDeleted && <CMChip color="warning" size="small">Deactivated</CMChip>}
        credits={canViewContactInfo ? [
            props.user.email,
            props.user.phone,
        ] : []}
        bodyContent={
            <>
                <CMChipContainer className="songTags">
                    {props.user.tags.map(tag => <CMStandardDBChip
                        key={db3.xUserTagAssignment.getIdentity(tag)}
                        size='small'
                        model={tag.userTag}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.tagFilter.options.includes(tag.userTagId) }}
                        getTooltip={(_) => tag.userTag.description}
                    />)}
                    {canManageUsers && props.user.role &&
                        <CMChip
                            color={props.user.role.color}
                            shape={"rectangle"}
                            size="small"
                            variation={{ ...StandardVariationSpec.Strong, selected: props.filterSpec.roleFilter.options.includes(props.user.role.id) }}
                        >
                            {props.user.role.name}
                        </CMChip>}
                    {canManageUsers && <Suspense>
                        <CMDivider />
                        <UserIdentityIndicator userId={props.user.id} />
                    </Suspense>}
                </CMChipContainer>

                <CMChipContainer className="instruments">
                    {props.user.instruments.map(tag => <CMStandardDBChip
                        key={db3.xUserInstrument.getIdentity(tag)}
                        size='small'
                        model={tag.instrument}
                        variation={{ ...StandardVariationSpec.Weak, selected: props.filterSpec.instrumentFilter.options.includes(tag.instrumentId) }}
                        getTooltip={(_) => tag.instrument.description}
                    />)}
                </CMChipContainer>
            </>
        }
        footerContent={canManageUsers &&
            <>
                <DateValue value={props.user.createdAt} format={(dateStr) => `Created at ${dateStr}`} style={{ opacity: .5 }} />
            </>
        }
    />;
}
