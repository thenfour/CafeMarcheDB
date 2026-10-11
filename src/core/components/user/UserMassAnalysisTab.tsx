import React from "react";
import { useQuery } from "@blitzjs/rpc";
import CompareArrows from "@mui/icons-material/CompareArrows";
import { Alert, DialogContent, DialogTitle, Stack } from "@mui/material";
import type { UserPublicId } from "shared/publicId";
import getUserMassAnalysis from "src/core/db3/queries/getUserMassAnalysis";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import {
    getContentCountsRows, getParticipationCountsRows, getSummaryRows, getSystemCountsRows, getUserInfoRows,
    type MassAnalysisDataRow, type UserDependencyRiskReason, type UserMassAnalysisResult
} from "src/core/db3/shared/getUserMassAnalysisTypes";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { CMButton } from "../CMCoreComponents2";
import { CMTable } from "../CMTable";
import { DateValue } from "../DateTime/DateTimeComponents";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { UserChip } from "./userChip";
import { AccountAnalysisComparisonPicker, type AccountAnalysisChoice } from "./AccountAnalysisComparisonPicker";

// lsmb todo: put in css as variables. eventually to become theme-aware
const riskColors = { low: "#28a745", medium: "#ffc107", high: "#dc3545" };
function riskMessage(reason: UserDependencyRiskReason, locale: ReturnType<typeof useLocale>): string {
    switch (reason.kind) {
        case "sysadmin":
            return locale.getPlainString("accountAnalysis.risk.sysadmin");
        case "merged":
            return locale.getPlainString("accountAnalysis.risk.merged");
        case "activeSessions":
            return locale.getPlainString("accountAnalysis.risk.sessions");
        case "globalRole":
            return locale.getPlainString("accountAnalysis.risk.globalRole", { name: reason.name ?? locale.getPlainString("accountAnalysis.risk.unnamedRole") });
        case "content":
            return locale.getPlainString("accountAnalysis.risk.content", { count: reason.count });
        case "participation":
            return locale.getPlainString("accountAnalysis.risk.participation", { count: reason.count });
        case "recentActivity":
            return locale.getPlainString("accountAnalysis.risk.activity", { count: reason.count });
    }
}
export function AccountDependencyRiskCard({ analysis }: { readonly analysis: UserMassAnalysisResult }) {
    const locale = useLocale();
    const risk = analysis.riskAssessment;
    return <div className="account-dependency-risk" style={{
        flex: 1, minWidth: 280, padding: 15,
        border: `2px solid ${riskColors[risk.riskLevel]}`, borderRadius: 8, backgroundColor: `${riskColors[risk.riskLevel]}20`
    }}>
        <h3 style={{ color: riskColors[risk.riskLevel], marginTop: 0 }}>{analysis.userInfo.name}: {risk.riskLevel.toUpperCase()}</h3>
        <div><strong>Safe to Delete:</strong> {risk.safeToDelete ? "✅ Yes" : "❌ No"}</div>
        {risk.blockers.length > 0 && <><strong>Blockers:</strong><ul>{risk.blockers.map(blocker => <li key={blocker.kind}>{riskMessage(blocker, locale)}</li>)}</ul></>}
        {risk.warnings.length > 0 && <><strong>Warnings:</strong><ul>{risk.warnings.map(warning => <li key={warning.kind}>{riskMessage(warning, locale)}</li>)}</ul></>}
    </div>;
}

function AnalysisValue({ row, comparison }: { readonly row: MassAnalysisDataRow; readonly comparison: boolean }) {
    const dashboard = useDashboardContext();
    const value = comparison ? row.compareValue : row.value;
    const display = comparison ? row.compareDisplayValue : row.displayValue;
    if (row.isDateValue) {
        return <DateValue value={value == null ? null : new Date(value)} formattingLocale={dashboard.formattingLocale} timeZone={dashboard.localTimeZone} />;
    }
    if (display !== undefined) {
        return <span>{display ?? "--"}</span>;
    }
    if (row.isBooleanValue) {
        return <span>{value ? "Yes" : "No"}</span>;
    }
    return <span>{value == null ? "--" : new Intl.NumberFormat(dashboard.formattingLocale).format(value)}</span>;
}

function AnalysisTable({ title, rows, main, comparison }: {
    readonly title: string;
    readonly rows: MassAnalysisDataRow[];
    readonly main: UserMassAnalysisResult;
    readonly comparison: UserMassAnalysisResult | null;
}) {
    const locale = useLocale();
    return <section><h4>{title}</h4><CMTable rows={rows} columns={[
        { header: "Metric", memberName: "label", render: ({ row }) => row.labelKey ? locale.getPlainString(row.labelKey) : row.label },
        {
            header: comparison ? main.userInfo.name : "Value", memberName: "value",
            render: ({ row }) => <AnalysisValue row={row} comparison={false} />,
            valueBar: { getValue: row => row.isBooleanValue || row.isDateValue || row.displayValue !== undefined ? 0 : row.value ?? 0 }
        },
        ...(comparison ? [{
            header: comparison.userInfo.name, memberName: "compareValue" as const,
            render: ({ row }: { row: MassAnalysisDataRow }) => <AnalysisValue row={row} comparison={true} />,
            valueBar: { getValue: (row: MassAnalysisDataRow) => row.isBooleanValue || row.isDateValue || row.compareDisplayValue !== undefined ? 0 : row.compareValue ?? 0 }
        }] : []),
    ]} /></section>;
}

function MembershipInventory({ analysis }: { readonly analysis: UserMassAnalysisResult }) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    return <section><h4>{locale.getPlainString("accountAnalysis.memberships")}: {analysis.userInfo.name}</h4>
        {analysis.memberships.length === 0 ? <span>{locale.getPlainString("accountAnalysis.noMemberships")}</span> : analysis.memberships.map(membership =>
            <section key={membership.publicId} className="account-membership-inventory">
                <h5>{membership.bandName ?? membership.bandPublicId}
                    {membership.bandIsDeleted && ` (${locale.getPlainString("accountAnalysis.retiredBand")})`}</h5>
                <div>{membership.isDeleted ? locale.getPlainString("accountAnalysis.inactive") : locale.getPlainString("accountAnalysis.active")}
                    {" · "}{locale.getPlainString("roles.band")}: {membership.roleName ?? "--"}
                    {membership.roleIsDeleted && ` (${locale.getPlainString("accountAnalysis.retiredRole")})`}
                    {" · "}<DateValue value={membership.createdAt} formattingLocale={dashboard.formattingLocale} timeZone={dashboard.localTimeZone} /></div>
                <CMTable rows={[...getParticipationCountsRows(membership.counts), { key: "settings", label: locale.getPlainString("accountAnalysis.membershipSettings"), value: membership.counts.settings }]}
                    columns={[{ header: "Metric", memberName: "label" }, { header: "Count", memberName: "value", render: ({ row }) => <AnalysisValue row={row} comparison={false} />, valueBar: {} }]} />
            </section>)}
    </section>;
}

/** Preserve the original aggregate tables, bars, risk cards and two-account comparison. */
export function AccountAnalysisReport({ analysis, comparison }: { readonly analysis: UserMassAnalysisResult; readonly comparison: UserMassAnalysisResult | null }) {
    return <>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={2}><AccountDependencyRiskCard analysis={analysis} />
            {comparison && <AccountDependencyRiskCard analysis={comparison} />}</Stack>
        <AnalysisTable title="Summary Statistics" rows={getSummaryRows(analysis, comparison ?? undefined)} main={analysis} comparison={comparison} />
        {[analysis, ...(comparison ? [comparison] : [])].some(report => Object.values(report.contentCounts).some(count => count > 0))
            && <AnalysisTable title="Content Created" rows={getContentCountsRows(analysis.contentCounts, comparison?.contentCounts)} main={analysis} comparison={comparison} />}
        {[analysis, ...(comparison ? [comparison] : [])].some(report => Object.values(report.participationCounts).some(count => count > 0))
            && <AnalysisTable title="Participation & Engagement" rows={getParticipationCountsRows(analysis.participationCounts, comparison?.participationCounts)} main={analysis} comparison={comparison} />}
        {[analysis, ...(comparison ? [comparison] : [])].some(report => Object.values(report.systemCounts).some(count => count > 0))
            && <AnalysisTable title="System Data" rows={getSystemCountsRows(analysis.systemCounts, comparison?.systemCounts)} main={analysis} comparison={comparison} />}
        <AnalysisTable title="User Information" rows={getUserInfoRows(analysis.userInfo, comparison?.userInfo)} main={analysis} comparison={comparison} />
        <MembershipInventory analysis={analysis} />{comparison && <MembershipInventory analysis={comparison} />}
    </>;
}

function LoadedUserMassAnalysis({ user }: { readonly user: { readonly publicId: UserPublicId } }) {
    const context = useDB3QueryContext();
    const { bandPublicId: _band, ...localeInput } = context;
    const locale = useLocale();
    const [comparisonAccount, setComparisonAccount] = React.useState<AccountAnalysisChoice | null>(null);
    const [picking, setPicking] = React.useState(false);
    const [analysis, primary] = useQuery(getUserMassAnalysis, { ...localeInput, userId: user.publicId },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
    const [candidate, secondary] = useQuery(getUserMassAnalysis, { ...localeInput, userId: comparisonAccount?.publicId ?? user.publicId },
        { enabled: comparisonAccount !== null, staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
    const comparison = comparisonAccount && !secondary.error && candidate?.userInfo.publicId === comparisonAccount.publicId ? candidate : null;
    return <div className="UserMassAnalysisTabContent">
        <p>{locale.getPlainString("accountAnalysis.scope")}</p>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <CMButton onClick={() => setPicking(true)}><CompareArrows />{locale.getPlainString("accountAnalysis.compare")}</CMButton>
            {comparisonAccount && <><UserChip value={comparisonAccount} noLink /><CMButton onClick={() => setComparisonAccount(null)}>{locale.getPlainString("accountAnalysis.clear")}</CMButton></>}
            {comparison && <span>{locale.getPlainString("accountAnalysis.comparing")}</span>}
            <CMButton disabled={primary.isFetching || (comparisonAccount !== null && secondary.isFetching)} onClick={() => {
                void primary.refetch();
                if (comparisonAccount) {
                    void secondary.refetch();
                }
            }}>{locale.getPlainString("accountAnalysis.refresh")}</CMButton>
        </Stack>
        {(primary.isFetching || (comparisonAccount !== null && secondary.isFetching)) && <span role="status">{locale.getPlainString("accountAnalysis.loading")}</span>}
        {(Boolean(primary.error) || (comparisonAccount !== null && Boolean(secondary.error))) && <Alert severity="error">{locale.getPlainString("accountAnalysis.failed")}</Alert>}
        {analysis?.userInfo.publicId === user.publicId && !primary.error && <AccountAnalysisReport analysis={analysis} comparison={comparison} />}
        {picking && <React.Suspense fallback={<span role="status">{locale.getPlainString("accountAnalysis.loading")}</span>}>
            <AccountAnalysisComparisonPicker excludedUserId={user.publicId} onSelect={setComparisonAccount} onClose={() => setPicking(false)} />
        </React.Suspense>}
    </div>;
}

export function UserMassAnalysisTabContent(props: { readonly user: { readonly publicId: UserPublicId } }) {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const scope = `${props.user.publicId}:${context.bandPublicId}:${context.routeLocale}:${context.browserLanguages?.join(",")}:${context.clientRequestId}:${presentation.data?.authorization.userPublicId}`;
    return <LoadedUserMassAnalysis key={scope} {...props} />;
}

/** Account-list entry point keeps inactive and membership-free targets reachable. */
export function AccountAnalysisAction({ userId }: { readonly userId: UserPublicId }) {
    const locale = useLocale();
    const [open, setOpen] = React.useState(false);
    return <><CMButton onClick={() => setOpen(true)}>{locale.getPlainString("accountAnalysis.inspect")}</CMButton>
        <ResponsiveDialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
            <DialogTitle>{locale.getPlainString("membership.profile.analysis")}</DialogTitle>
            <DialogContent>{open && <UserMassAnalysisTabContent user={{ publicId: userId }} />}</DialogContent>
        </ResponsiveDialog>
    </>;
}
