import type { UserMassAnalysisActivityMetrics, UserMassAnalysisContentCounts,
    UserDependencyRiskReason, UserMassAnalysisParticipationCounts, UserMassAnalysisRiskAssessment } from "./getUserMassAnalysisTypes";

const millisPerDay = 86_400_000;
export function measureUserActivity(createdAt: Date, lastActivityDate: Date | null, actions: number, now: Date): UserMassAnalysisActivityMetrics {
    return {
        accountAgeInDays: Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / millisPerDay)),
        // Preserve the reference report's activity-record proxy for prior login.
        hasEverLoggedIn: actions > 0,
        lastActivityDate,
        daysSinceLastActivity: lastActivityDate === null ? null : Math.max(0, Math.floor((now.getTime() - lastActivityDate.getTime()) / millisPerDay)),
    };
}

interface DependencyRiskInput {
    readonly isProtectedAdministrator: boolean;
    readonly hasElevatedGlobalRole: boolean;
    readonly globalRoleName: string | null;
    readonly isMerged: boolean;
    readonly activeSessions: number;
    readonly contentCounts: UserMassAnalysisContentCounts;
    readonly participationCounts: UserMassAnalysisParticipationCounts;
    readonly activityMetrics: UserMassAnalysisActivityMetrics;
}

/** Reference heuristic only; dedicated lifecycle/merge policies still decide which writes are permitted. */
export function assessUserDependencyRisk(input: DependencyRiskInput): UserMassAnalysisRiskAssessment {
    const warnings: UserDependencyRiskReason[] = [];
    const blockers: UserDependencyRiskReason[] = [];
    if (input.isProtectedAdministrator) {
        blockers.push({ kind: "sysadmin" });
    }
    if (input.isMerged) {
        blockers.push({ kind: "merged" });
    }
    // Role names are localized presentation, so granted authority determines elevation.
    if (input.hasElevatedGlobalRole) {
        warnings.push({ kind: "globalRole", name: input.globalRoleName });
    }
    const counts = input.contentCounts;
    const totalContent = counts.createdSongs + counts.createdEvents + counts.createdWikiPages + counts.createdGalleryItems + counts.uploadedFiles;
    const totalParticipation = input.participationCounts.eventResponses + input.participationCounts.eventSegmentResponses + counts.songCredits;
    if (totalContent > 10) {
        warnings.push({ kind: "content", count: totalContent });
    }
    if (totalParticipation > 20) {
        warnings.push({ kind: "participation", count: totalParticipation });
    }
    const days = input.activityMetrics.daysSinceLastActivity;
    if (days !== null && days < 30) {
        warnings.push({ kind: "recentActivity", count: days });
    }
    if (input.activeSessions > 0) {
        warnings.push({ kind: "activeSessions" });
    }
    const riskLevel = blockers.length > 0 ? "high" : warnings.length > 2 || totalContent > 5 || totalParticipation > 10 ? "medium" : "low";
    return { safeToDelete: blockers.length === 0 && riskLevel === "low", riskLevel, warnings, blockers };
}
