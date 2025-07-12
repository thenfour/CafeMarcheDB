
// Type-safe data structures for mass analysis
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
    workflowAssignments: number;
    workflowLogItems: number;
    taggedFiles: number;
    instruments: number;
    userTags: number;
};

export type UserMassAnalysisSystemCounts = {
    actions: number;
    sessions: number;
    tokens: number;
    changes: number;
};

export type UserMassAnalysisUserInfo = {
    id: number;
    name: string;
    email: string;
    createdAt: Date;
    isSysAdmin: boolean;
    isDeleted: boolean;
    roleId: number | null;
    roleName: string | null;
    googleId: string | null;
};

export type UserMassAnalysisActivityMetrics = {
    accountAgeInDays: number;
    hasEverLoggedIn: boolean;
    lastActivityDate: Date | null;
    daysSinceLastActivity: number | null;
};

export type UserMassAnalysisRiskAssessment = {
    safeToDelete: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
    blockers: string[];
};

export type UserMassAnalysisResult = {
    userInfo: UserMassAnalysisUserInfo;
    contentCounts: UserMassAnalysisContentCounts;
    participationCounts: UserMassAnalysisParticipationCounts;
    systemCounts: UserMassAnalysisSystemCounts;
    activityMetrics: UserMassAnalysisActivityMetrics;
    riskAssessment: UserMassAnalysisRiskAssessment;
};

// Type-safe data row structure for tables
export type MassAnalysisDataRow = {
    key: string;
    label: string;
    value: number;
    compareValue?: number;
    displayValue?: string;
    compareDisplayValue?: string;
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
        { key: "workflowAssignments", label: "Workflow Assignments", value: counts.workflowAssignments, compareValue: compareCounts?.workflowAssignments },
        { key: "workflowLogItems", label: "Workflow Log Items", value: counts.workflowLogItems, compareValue: compareCounts?.workflowLogItems },
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
        { key: "daysSinceLastActivity", label: "Days Since Last Activity", value: analysis.activityMetrics.daysSinceLastActivity || 0, compareValue: compareAnalysis?.activityMetrics.daysSinceLastActivity || 0 },
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
            value: analysis.activityMetrics.lastActivityDate ? analysis.activityMetrics.lastActivityDate.getTime() : 0,
            compareValue: compareAnalysis?.activityMetrics.lastActivityDate ? compareAnalysis.activityMetrics.lastActivityDate.getTime() : 0,
            displayValue: analysis.activityMetrics.lastActivityDate ? analysis.activityMetrics.lastActivityDate.toLocaleDateString() : 'Never',
            compareDisplayValue: compareAnalysis?.activityMetrics.lastActivityDate ? compareAnalysis.activityMetrics.lastActivityDate.toLocaleDateString() : 'Never',
            isDateValue: true
        },
    ];
};

export const getUserInfoRows = (
    userInfo: UserMassAnalysisUserInfo,
    compareUserInfo?: UserMassAnalysisUserInfo
): MassAnalysisDataRow[] => [
        {
            key: "id",
            label: "ID",
            value: userInfo.id,
            compareValue: compareUserInfo?.id,
            displayValue: userInfo.id.toString(),
            compareDisplayValue: compareUserInfo?.id.toString()
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
            key: "roleName",
            label: "Role",
            value: 0,
            compareValue: 0,
            displayValue: userInfo.roleName || 'No Role',
            compareDisplayValue: compareUserInfo?.roleName || 'No Role'
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
            key: "googleId",
            label: "Google ID",
            value: userInfo.googleId ? 1 : 0,
            compareValue: compareUserInfo ? (compareUserInfo.googleId ? 1 : 0) : undefined,
            displayValue: userInfo.googleId ? 'Yes' : 'No',
            compareDisplayValue: compareUserInfo ? (compareUserInfo.googleId ? 'Yes' : 'No') : undefined,
            isBooleanValue: true
        },
        {
            key: "createdAt",
            label: "Created",
            value: userInfo.createdAt.getTime(),
            compareValue: compareUserInfo?.createdAt.getTime(),
            displayValue: userInfo.createdAt.toLocaleDateString(),
            compareDisplayValue: compareUserInfo?.createdAt.toLocaleDateString(),
            isDateValue: true
        },
    ];
