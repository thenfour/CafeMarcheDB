import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { Suspense } from "react";
import { Permission } from "shared/permissions";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import type { BandUserSearchClient } from "src/core/db3/db3";
import { localizedText } from "src/core/db3/shared/columnTypes/localizedString";
import { useLocale } from "src/locale/components/useLocale";
import { gIconMap } from "../../db3/components/IconMap";
import { CMChip, CMChipContainer, CMDivider, CMStandardDBChip } from "../CMChip";
import { StandardVariationSpec } from "../color/palette";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { GenericSearchListItem } from "../search/SearchListItem";
import { bandMemberHref } from "./bandMemberLinks";
import type { UsersFilterSpec } from "./UserClientBaseTypes";
import { UserIdentityIndicator } from "./UserIdentityIndicator";

export function UserListItem({ user, index, refetch, filterSpec }: {
    readonly user: BandUserSearchClient; readonly index: number;
    readonly refetch: () => void; readonly filterSpec: UsersFilterSpec;
}) {
    const dashboard = useDashboardContext();
    const router = useCmdbRouter();
    const context = useDB3QueryContext();
    const locale = useLocale();
    const canManage = dashboard.isAuthorized(Permission.manage_users);
    const joinedAt = user.createdAt;
    return <GenericSearchListItem index={index} item={user} refetch={refetch} icon={gIconMap.Person()}
        href={bandMemberHref(user.user.publicId, context, router.hosting)} title={user.user.name ?? ""}
        titleExtra={canManage && user.isDeleted && <CMChip color="warning" size="small">Deactivated</CMChip>}
        credits={dashboard.isAuthorized(Permission.view_user_contact_info) ? [user.user.email, user.user.phone] : []}
        bodyContent={<>
            <CMChipContainer className="songTags">
                {user.bandUserTagAssignments.map(assignment => {
                    const tag = dashboard.userTag.getById(assignment.bandUserTagId);
                    if (!tag || tag.isHidden) {
                        return null;
                    }
                    return <CMStandardDBChip key={assignment.publicId} model={tag} size="small"
                        getTooltip={() => tag.description}
                        variation={{ ...StandardVariationSpec.Weak, selected: filterSpec.tagFilter.options.includes(tag.publicId) }} />;
                })}
                {canManage && user.bandRole && <CMChip size="small" shape="rectangle" color={user.bandRole.color}
                    variation={{ ...StandardVariationSpec.Strong, selected: filterSpec.roleFilter.options.includes(user.bandRole.publicId) }}>{localizedText(user.bandRole.name)}</CMChip>}
                {dashboard.isAuthorized(Permission.sysadmin) && <Suspense><CMDivider /><UserIdentityIndicator userId={user.user.publicId} /></Suspense>}
            </CMChipContainer>
            <CMChipContainer className="instruments">
                {user.bandUserInstruments.map(assignment => {
                    const instrument = dashboard.instrument.getById(assignment.bandInstrumentId);
                    if (!instrument || instrument.isHidden || instrument.functionalGroup.isHidden) {
                        return null;
                    }
                    return <CMStandardDBChip key={assignment.publicId} model={instrument} size="small"
                        getTooltip={() => instrument.description}
                        variation={{ ...StandardVariationSpec.Weak, selected: filterSpec.instrumentFilter.options.includes(instrument.publicId) }} />;
                })}
            </CMChipContainer>
        </>}
        footerContent={canManage && joinedAt && <DateValue value={joinedAt} formattingLocale={dashboard.formattingLocale} timeZone={dashboard.localTimeZone}
            format={() => locale.getPlainString("membership.directory.joinedAt", { joinedAt })} style={{ opacity: .5 }} />} />;
}
