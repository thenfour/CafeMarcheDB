import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { Permission } from "shared/permissions";
import type { UserPublicId } from "shared/publicId";
import { slugify } from "shared/rootroot";
import { useLocale } from "src/locale/components/useLocale";
import { gIconMap } from "../../db3/components/IconMap";
import { CMTab, CMTabPanel } from "../TabPanel";
import { useDashboardContext, useRecordFeatureUse } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { AccountProfile } from "./AccountProfile";
import { ImpersonateUserButton } from "./ImpersonateUserButton";
import { UserAttendanceTabContent, UserCreditsTabContent, UserMassAnalysisTabContent, UserWikiContributionsTabContent } from "./UserAnalyticTables";

interface ProfilePerson {
    readonly publicId: UserPublicId;
    readonly name?: string
}

const tabs = ["attendance", "credits", "wiki", "massAnalysis"] as const;

function isProfileTab(value: unknown): value is typeof tabs[number] {
    return tabs.some(tab => tab === value);
}

// Account authority is global; analytics retain the original sysadmin presentation gate.
export function UserDetail({ person }: { readonly person: ProfilePerson }) {
    const dashboard = useDashboardContext();
    const router = useCmdbRouter();
    const locale = useLocale();
    useRecordFeatureUse({ feature: ActivityFeature.profile_view, context: `profile/${person.publicId}` });
    const path = router.query.id_slug_tab;
    const requested = Array.isArray(path) ? path[2] : undefined;
    const selected = isProfileTab(requested) ? requested : "attendance";
    return <>
        <AccountProfile personId={person.publicId} mode="controls" />
        {!dashboard.isAuthorized(Permission.manage_global_users) && dashboard.currentUser?.publicId !== person.publicId
            && <ImpersonateUserButton userId={person.publicId} />}
        {dashboard.isAuthorized(Permission.sysadmin) && <CMTabPanel selectedTabId={selected} handleTabChange={(_, value) => {
            if (!isProfileTab(value)) {
                return;
            }
            const uri = `/backstage/user/${person.publicId}/${slugify(person.name || "member")}/${value}`;
            void router.pushCurrentPage(router.href(uri));
        }}>
            <CMTab thisTabId="attendance" summaryTitle="Attendance" summaryIcon={gIconMap.Check()}><UserAttendanceTabContent user={person} /></CMTab>
            <CMTab thisTabId="credits" summaryTitle="Credits" summaryIcon={gIconMap.Comment()}><UserCreditsTabContent user={person} /></CMTab>
            <CMTab thisTabId="wiki" summaryTitle="Wiki Contributions" summaryIcon={gIconMap.Article()}><UserWikiContributionsTabContent user={person} /></CMTab>
            <CMTab thisTabId="massAnalysis" summaryTitle={locale.getPlainString("membership.profile.analysis")} summaryIcon={gIconMap.Info()}><UserMassAnalysisTabContent user={person} /></CMTab>
        </CMTabPanel>}
    </>;
}
