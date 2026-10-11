
import { ValidValue } from "@/shared/rootroot";
import { AccountAnalysisStringKey } from "@/src/locale/shared/accountAnalysisStrings";
import type { BandPublicId, BandRolePublicId, BandUserPublicId, GlobalRolePublicId, UserPublicId } from "shared/publicId";

export interface UserAccountAnalysisChoice {
    readonly publicId: UserPublicId;
    readonly name: string;
    readonly email: string;
    readonly isDeleted: boolean;
}

export type UserMassAnalysisContentCounts = {
    createdSongs: number;
    createdEvents: number;
    createdWikiPages: number;
    createdGalleryItems: number;
    uploadedFiles: number;
    createdMenuLinks: number;
    createdCustomLinks: number;
    songCredits: number;
    setlistPlans: number;
    wikiPageRevisions: number;
};

export type UserMassAnalysisParticipationCounts = {
    eventResponses: number;
    eventSegmentResponses: number;
    taggedFiles: number;
    instruments: number;
    userTags: number;
};

export type UserMassAnalysisSystemCounts = {
    actions: number;
    sessions: number;
    tokens: number;
    changes: number;
    signInMethods: number;
    userSettings: number;
};

export type UserMassAnalysisUserInfo = {
    publicId: UserPublicId;
    name: string;
    email: string;
    createdAt: Date;
    isSysAdmin: boolean;
    isDeleted: boolean;
    isProtectedAdministrator: boolean;
    globalRoleId: GlobalRolePublicId | null;
    globalRoleName: string | null;
    globalRoleIsDeleted: boolean;
    mergedIntoUserId: UserPublicId | null;
    mergedAt: Date | null;
    hasGoogleIdentity: boolean;
};

export type UserMassAnalysisActivityMetrics = {
    accountAgeInDays: number;
    hasEverLoggedIn: boolean;
    lastActivityDate: Date | null;
    daysSinceLastActivity: number | null;
};

// Transport carries the reason and its data; the report resolves messages in the current presentation locale.
export type UserDependencyRiskReason = {
    readonly kind: "sysadmin" | "merged" | "activeSessions"
}
    | {
        readonly kind: "globalRole";
        readonly name: string | null;
    }
    | {
        readonly kind: "content" | "participation" | "recentActivity";
        readonly count: number;
    };
export type UserMassAnalysisRiskAssessment = {
    safeToDelete: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: UserDependencyRiskReason[];
    blockers: UserDependencyRiskReason[];
};

export type UserMassAnalysisResult = {
    userInfo: UserMassAnalysisUserInfo;
    contentCounts: UserMassAnalysisContentCounts;
    participationCounts: UserMassAnalysisParticipationCounts;
    systemCounts: UserMassAnalysisSystemCounts;
    activityMetrics: UserMassAnalysisActivityMetrics;
    riskAssessment: UserMassAnalysisRiskAssessment;
    memberships: UserMassAnalysisMembership[];
};

export interface UserMassAnalysisMembership {
    readonly publicId: BandUserPublicId;
    readonly bandPublicId: BandPublicId;
    readonly bandName: string | null;
    readonly bandIsDeleted: boolean;
    readonly isDeleted: boolean;
    readonly createdAt: Date;
    readonly roleId: BandRolePublicId | null;
    readonly roleName: string | null;
    readonly roleIsDeleted: boolean;
    readonly counts: UserMassAnalysisParticipationCounts & { readonly settings: number };
}

// Type-safe data row structure for tables
type AccountAnalysisRowLabel = ValidValue<AccountAnalysisStringKey, "accountAnalysis.signInMethods">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.accountSettings">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.globalRole">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.protectedAdministrator">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.deletedGlobalRole">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.mergedInto">
    | ValidValue<AccountAnalysisStringKey, "accountAnalysis.mergedAt">;



export type MassAnalysisDataRow = {
    key: string;
    label: string;
    labelKey?: AccountAnalysisRowLabel;
    value: number | null;
    compareValue?: number | null;
    displayValue?: string | null;
    compareDisplayValue?: string | null;
    isDateValue?: boolean;
    isBooleanValue?: boolean;
};

// Helper functions to convert typed data to table rows
export const getContentCountsRows = (
    counts: UserMassAnalysisContentCounts,
    compareCounts?: UserMassAnalysisContentCounts
): MassAnalysisDataRow[] => [
        { key: "createdSongs", label: "Songs", value: counts.createdSongs, compareValue: compareCounts?.createdSongs },
        { key: "createdEvents", label: "Events", value: counts.createdEvents, compareValue: compareCounts?.createdEvents },
        { key: "createdWikiPages", label: "Wiki Pages", value: counts.createdWikiPages, compareValue: compareCounts?.createdWikiPages },
        { key: "createdGalleryItems", label: "Gallery Items", value: counts.createdGalleryItems, compareValue: compareCounts?.createdGalleryItems },
        { key: "uploadedFiles", label: "Uploaded Files", value: counts.uploadedFiles, compareValue: compareCounts?.uploadedFiles },
        { key: "createdMenuLinks", label: "Menu Links", value: counts.createdMenuLinks, compareValue: compareCounts?.createdMenuLinks },
        { key: "createdCustomLinks", label: "Custom Links", value: counts.createdCustomLinks, compareValue: compareCounts?.createdCustomLinks },
        { key: "songCredits", label: "Song Credits", value: counts.songCredits, compareValue: compareCounts?.songCredits },
        { key: "setlistPlans", label: "Setlist Plans", value: counts.setlistPlans, compareValue: compareCounts?.setlistPlans },
        { key: "wikiPageRevisions", label: "Wiki Revisions", value: counts.wikiPageRevisions, compareValue: compareCounts?.wikiPageRevisions },
    ];

export const getParticipationCountsRows = (
    counts: UserMassAnalysisParticipationCounts,
    compareCounts?: UserMassAnalysisParticipationCounts
): MassAnalysisDataRow[] => [
        { key: "eventResponses", label: "Event Responses", value: counts.eventResponses, compareValue: compareCounts?.eventResponses },
        { key: "eventSegmentResponses", label: "Event Segment Responses", value: counts.eventSegmentResponses, compareValue: compareCounts?.eventSegmentResponses },
        { key: "taggedFiles", label: "Tagged Files", value: counts.taggedFiles, compareValue: compareCounts?.taggedFiles },
        { key: "instruments", label: "Instruments", value: counts.instruments, compareValue: compareCounts?.instruments },
        { key: "userTags", label: "User Tags", value: counts.userTags, compareValue: compareCounts?.userTags },
    ];

export const getSystemCountsRows = (
    counts: UserMassAnalysisSystemCounts,
    compareCounts?: UserMassAnalysisSystemCounts
): MassAnalysisDataRow[] => [
        { key: "actions", label: "Actions", value: counts.actions, compareValue: compareCounts?.actions },
        { key: "sessions", label: "Sessions", value: counts.sessions, compareValue: compareCounts?.sessions },
        { key: "tokens", label: "Tokens", value: counts.tokens, compareValue: compareCounts?.tokens },
        { key: "changes", label: "Changes", value: counts.changes, compareValue: compareCounts?.changes },
        { key: "signInMethods", label: "Sign-in Methods", labelKey: "accountAnalysis.signInMethods", value: counts.signInMethods, compareValue: compareCounts?.signInMethods },
        { key: "userSettings", label: "Account Settings", labelKey: "accountAnalysis.accountSettings", value: counts.userSettings, compareValue: compareCounts?.userSettings },
    ];

export const getSummaryRows = (
    analysis: UserMassAnalysisResult,
    compareAnalysis?: UserMassAnalysisResult
): MassAnalysisDataRow[] => {
    const totalContentItems = Object.values(analysis.contentCounts).reduce((sum, count) => sum + count, 0);
    const totalParticipationItems = Object.values(analysis.participationCounts).reduce((sum, count) => sum + count, 0);
    const totalSystemItems = Object.values(analysis.systemCounts).reduce((sum, count) => sum + count, 0);

    const compareTotalContent = compareAnalysis ? Object.values(compareAnalysis.contentCounts).reduce((sum, count) => sum + count, 0) : undefined;
    const compareTotalParticipation = compareAnalysis ? Object.values(compareAnalysis.participationCounts).reduce((sum, count) => sum + count, 0) : undefined;
    const compareTotalSystem = compareAnalysis ? Object.values(compareAnalysis.systemCounts).reduce((sum, count) => sum + count, 0) : undefined;

    return [
        { key: "totalContentItems", label: "Total Content Items", value: totalContentItems, compareValue: compareTotalContent },
        { key: "totalParticipationItems", label: "Total Participation Items", value: totalParticipationItems, compareValue: compareTotalParticipation },
        { key: "totalSystemItems", label: "Total System Items", value: totalSystemItems, compareValue: compareTotalSystem },
        { key: "accountAgeInDays", label: "Account Age", value: analysis.activityMetrics.accountAgeInDays, compareValue: compareAnalysis?.activityMetrics.accountAgeInDays },
        { key: "daysSinceLastActivity", label: "Days Since Last Activity", value: analysis.activityMetrics.daysSinceLastActivity, compareValue: compareAnalysis?.activityMetrics.daysSinceLastActivity },
        {
            key: "hasEverLoggedIn",
            label: "Has Ever Logged In",
            value: analysis.activityMetrics.hasEverLoggedIn ? 1 : 0,
            compareValue: compareAnalysis ? (compareAnalysis.activityMetrics.hasEverLoggedIn ? 1 : 0) : undefined,
            displayValue: analysis.activityMetrics.hasEverLoggedIn ? 'Yes' : 'No',
            compareDisplayValue: compareAnalysis ? (compareAnalysis.activityMetrics.hasEverLoggedIn ? 'Yes' : 'No') : undefined,
            isBooleanValue: true
        },
        {
            key: "lastActivityDate",
            label: "Last Activity",
            value: analysis.activityMetrics.lastActivityDate?.getTime() ?? null,
            compareValue: compareAnalysis?.activityMetrics.lastActivityDate?.getTime() ?? null,
            isDateValue: true
        },
    ];
};

export const getUserInfoRows = (
    userInfo: UserMassAnalysisUserInfo,
    compareUserInfo?: UserMassAnalysisUserInfo
): MassAnalysisDataRow[] => [
        {
            key: "publicId",
            label: "Public ID",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.publicId,
            compareDisplayValue: compareUserInfo?.publicId
        },
        {
            key: "name",
            label: "Name",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.name,
            compareDisplayValue: compareUserInfo?.name
        },
        {
            key: "email",
            label: "Email",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.email,
            compareDisplayValue: compareUserInfo?.email
        },
        {
            key: "globalRoleName",
            label: "Global Account Role",
            labelKey: "accountAnalysis.globalRole",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.globalRoleName,
            compareDisplayValue: compareUserInfo?.globalRoleName
        },
        {
            key: "isSysAdmin",
            label: "System Admin",
            value: userInfo.isSysAdmin ? 1 : 0,
            compareValue: compareUserInfo ? (compareUserInfo.isSysAdmin ? 1 : 0) : undefined,
            displayValue: userInfo.isSysAdmin ? 'Yes' : 'No',
            compareDisplayValue: compareUserInfo ? (compareUserInfo.isSysAdmin ? 'Yes' : 'No') : undefined,
            isBooleanValue: true
        },
        {
            key: "isDeleted",
            label: "Is Deleted",
            value: userInfo.isDeleted ? 1 : 0,
            compareValue: compareUserInfo ? (compareUserInfo.isDeleted ? 1 : 0) : undefined,
            displayValue: userInfo.isDeleted ? 'Yes' : 'No',
            compareDisplayValue: compareUserInfo ? (compareUserInfo.isDeleted ? 'Yes' : 'No') : undefined,
            isBooleanValue: true
        },
        {
            key: "isProtectedAdministrator",
            label: "Protected Administrator",
            labelKey: "accountAnalysis.protectedAdministrator",
            value: Number(userInfo.isProtectedAdministrator),
            compareValue: compareUserInfo ? Number(compareUserInfo.isProtectedAdministrator) : undefined,
            isBooleanValue: true,
        },
        {
            key: "globalRoleIsDeleted",
            label: "Global Role Is Deleted", labelKey: "accountAnalysis.deletedGlobalRole",
            value: Number(userInfo.globalRoleIsDeleted),
            compareValue: compareUserInfo ? Number(compareUserInfo.globalRoleIsDeleted) : undefined,
            isBooleanValue: true,
        },
        {
            key: "mergedIntoUserId",
            label: "Merged Into Account",
            labelKey: "accountAnalysis.mergedInto",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.mergedIntoUserId,
            compareDisplayValue: compareUserInfo?.mergedIntoUserId,
        },
        {
            key: "mergedAt",
            label: "Merged At",
            labelKey: "accountAnalysis.mergedAt",
            value: userInfo.mergedAt?.getTime() ?? null,
            compareValue: compareUserInfo?.mergedAt?.getTime() ?? null,
            isDateValue: true,
        },
        {
            key: "hasGoogleIdentity",
            label: "Google ID",
            value: userInfo.hasGoogleIdentity ? 1 : 0,
            compareValue: compareUserInfo ? (compareUserInfo.hasGoogleIdentity ? 1 : 0) : undefined,
            displayValue: userInfo.hasGoogleIdentity ? 'Yes' : 'No',
            compareDisplayValue: compareUserInfo ? (compareUserInfo.hasGoogleIdentity ? 'Yes' : 'No') : undefined,
            isBooleanValue: true
        },
        {
            key: "createdAt",
            label: "Created",
            value: userInfo.createdAt.getTime(),
            compareValue: compareUserInfo?.createdAt.getTime(),
            isDateValue: true
        },
    ];
