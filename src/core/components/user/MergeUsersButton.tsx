import { invoke, useMutation, useQuery } from "@blitzjs/rpc";
import { Alert, Button } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import mergeUsers from "src/auth/mutations/mergeUsers";
import previewUserMerge from "src/auth/queries/previewUserMerge";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
import type { MergeIdentity, UserMergePreview } from "src/auth/userMergeSchemas";
import getUserMassAnalysis from "../../db3/queries/getUserMassAnalysis";
import { UserMassAnalysisResult } from "../../db3/shared/getUserMassAnalysisTypes";
import { CMDialog } from "../CMDialog";
import { CMUserMgmtButton } from "../CMCoreComponents2";
import { CMTable } from "../CMTable";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { RoleChip } from "../RoleChip";
import { CMSelectDisplayStyle, CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/selectionSource";
import type { UserPublicId } from "shared/publicId";

export function UserMergeReport({ preview }: { preview: UserMergePreview }) {
    const dashboardContext = useDashboardContext();
    const resultingRole = dashboardContext.role.getById(preview.main.roleId);
    const retiringRole = dashboardContext.role.getById(preview.retiring.roleId);
    return <>
        <table><tbody>
            <tr><th>Main account</th><td>{preview.main.name} - {preview.main.publicId} - {preview.main.email}</td></tr>
            <tr><th>Retiring account</th><td>{preview.retiring.name} - {preview.retiring.publicId} - {preview.retiring.email}</td></tr>
            <tr><th>Resulting role</th><td><RoleChip role={resultingRole} />{preview.main.isSysAdmin ? " (Sysadmin)" : ""}</td></tr>
        </tbody></table>
        {preview.sections.map(section => <section key={section.key}>
            <h3>{section.title}</h3>
            <p>{section.policy}</p>
            {!!section.effects.length && <table><tbody>{section.effects.map(effect =>
                <tr key={effect.label}><th>{effect.label}</th><td>{effect.count}</td></tr>,
            )}</tbody></table>}
            {section.consequences?.map(text => <p key={text}>{text}</p>)}
            {section.blockers?.map(text => <Alert key={text} severity="warning">{text}</Alert>)}
        </section>)}
    </>;
}

const MergeUserListItem = ({ user }: { user: MergeIdentity }) => {
    return <div style={{ gap: "8px", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ gap: "8px", display: "flex", alignItems: "center" }}>
            <span style={{ opacity: 0.6 }}>{user.publicId}</span>
            <span style={{ fontWeight: "bold" }}>{user.name}</span>
            <span>{<RoleChip role={user.roleId} />}{user.isDeleted ? " (deactivated)" : ""}</span>
        </div>
        <div style={{ gap: "8px", display: "flex", alignItems: "center" }}>
            <span>{user.email}</span>
        </div>
        <div style={{ gap: "8px", display: "flex", alignItems: "center" }}>
            <span>Created: <DateValue value={user.createdAt} showRelative /></span>
        </div>
    </div>
};

type UserMassAnalysisSummaryCardProps = {
    analysis: UserMassAnalysisResult;
    caption?: React.ReactNode;
    description?: React.ReactNode;
};

const UserMassAnalysisSummaryCard = ({ analysis, caption, description }: UserMassAnalysisSummaryCardProps) => {
    const userInfoRows: { label: string; value: React.ReactNode }[] = [];//[...summaryRows];

    const totalContentItems = Object.values(analysis.contentCounts).reduce((sum, count) => sum + count, 0);
    const totalParticipationItems = Object.values(analysis.participationCounts).reduce((sum, count) => sum + count, 0);
    const totalSystemItems = Object.values(analysis.systemCounts).reduce((sum, count) => sum + count, 0);

    userInfoRows.push(
        { label: "Public ID", value: <>{analysis.userInfo.publicId}</> },
        { label: "Name", value: analysis.userInfo.name },
        { label: "Email", value: analysis.userInfo.email },
        { label: "Role", value: <RoleChip role={analysis.userInfo.roleId} /> },
        { label: "---", value: "---" },
        { label: "Created At", value: <DateValue value={analysis.userInfo.createdAt} showRelative /> },
        { label: "Last activity", value: <DateValue value={analysis.activityMetrics.lastActivityDate} showRelative /> },
        { label: "Content items", value: totalContentItems },
        { label: "Participation items", value: totalParticipationItems },
        { label: "System items", value: totalSystemItems },
    );

    return <div className="user-mass-analysis-summary-card">
        {caption && <div className="h3">{caption}</div>}
        {description && <div className="description">{description}</div>}
        <CMTable
            rows={userInfoRows}
            columns={[
                {
                    header: "",
                    memberName: "label",
                    render: (row) => <span>{row.row.label}</span>,
                },
                {
                    header: "",
                    memberName: "value",
                    render: (row) => <span>{row.row.value}</span>,
                    valueBar: {
                        getValue: (row) => typeof row.value === "number" ? row.value : undefined,
                    },
                },
            ]}
        />

    </div>;
};

function MergeUsersDialog({ user, onClose }: { user: { publicId: UserPublicId; name: string }; onClose: () => void }) {
    const router = useRouter();
    const [merge] = useMutation(mergeUsers);
    const [other, setOther] = React.useState<MergeIdentity | null>(null);
    const [mainIsProfile, setMainIsProfile] = React.useState(true);
    const [preview, setPreview] = React.useState<UserMergePreview | null>(null);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [userMassAnalysis, { refetch: refetchUser }] = useQuery(getUserMassAnalysis, { userId: user.publicId });
    const [otherUserMassAnalysis, { refetch: refetchOther }] = useQuery(getUserMassAnalysis, { userId: other?.publicId ?? user.publicId }, { enabled: !!other });

    // The selector reloads when its provider changes. RPC context rerenders must
    // keep the same provider until the profile being excluded actually changes.
    const getCandidates = React.useCallback(({ quickFilter }: { quickFilter: string | undefined }) =>
        invoke(searchUserMergeCandidates, { query: quickFilter || "", excludeUserId: user.publicId }), [user.publicId]);

    const participants = other ? {
        mainUserId: mainIsProfile ? user.publicId : other.publicId,
        retiringUserId: mainIsProfile ? other.publicId : user.publicId,
    } : null;

    const showPreview = async () => {
        if (!participants) {
            return;
        }
        setPending(true);
        setError(null);
        setPreview(null);
        try {
            setPreview(await invoke(previewUserMerge, participants));
        }
        catch {
            setError("Unable to prepare this merge. Check that both accounts are eligible and that you still have merge permission.");
        }
        finally {
            setPending(false);
        }
    };

    const commit = async () => {
        if (!participants || !preview?.canCommit) return;
        setPending(true);
        setError(null);
        try {
            const result = await merge({ participants, confirmation: preview.confirmation });
            onClose();
            await router.push(`/backstage/user/${result.mainUserId}`);
            router.reload();
        } catch {
            // Keep errors aggregate-only. A fresh report also recovers safely
            // from stale data or a commit whose response was lost.
            setPreview(null);
            setError("The merge could not be confirmed. Refresh the report before continuing. If the retiring account is already merged, open the main profile.");
        } finally { setPending(false); }
    };

    const mainUserMassAnalysis = mainIsProfile ? userMassAnalysis : otherUserMassAnalysis;
    const otherUserMassAnalysisToShow = mainIsProfile ? otherUserMassAnalysis : userMassAnalysis;

    return <CMDialog
        open
        onClose={pending ? undefined : onClose}
        fullWidth
        maxWidth="md"
        title="Merge users"
        actions={<>
            <Button disabled={pending} onClick={onClose}>Cancel</Button>
            {preview
                ? <Button disabled={pending || !preview.canCommit} onClick={commit}>
                    Accept report and merge accounts
                </Button>
                : <Button disabled={pending || !other} onClick={showPreview}>
                    Preview merge
                </Button>}
        </>}
    >
            <p>Select a second account, choose which one remains main and which one will be retired.
                The report will explain the merge outcomes and policies; merging accepts all of them.</p>

            <CMSingleSelect<MergeIdentity>
                value={other} nullBehavior={CMSelectNullBehavior.AllowNull} readonly={pending}
                onChange={value => { setOther(value); setPreview(null); setError(null); }}
                getOptions={getCandidates}
                getOptionInfo={item => ({ id: item.publicId })}
                renderOption={item => <MergeUserListItem user={item} />}
                displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
                dialogTitle="Select the other account"
                editButtonChildren="Select another user"
                allowQuickFilter
            />

            {/* display 2 side-by-side cards indicating the main and the other account  clearly, with a brief mass analysis summary */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                {mainUserMassAnalysis && <UserMassAnalysisSummaryCard
                    analysis={mainUserMassAnalysis}
                    caption={<>Account to keep ✅</>}
                    description={<>This account will remain as the main account, and takes priority when merging.</>}
                />}
                {otherUserMassAnalysisToShow && <UserMassAnalysisSummaryCard
                    analysis={otherUserMassAnalysisToShow}
                    caption={<>Account to retire ❌</>}
                    description={<>This account will be retired after the merge.</>} />}
            </div>

            <Button disabled={pending} onClick={() => { setMainIsProfile(!mainIsProfile); setPreview(null); setError(null); }}>
                Swap Main and Retiring
            </Button>

            {error && <Alert severity="error">{error}</Alert>}
            {pending && <p role="status">{preview ? "Merging accounts..." : "Preparing report..."}</p>}
            {preview && <UserMergeReport preview={preview} />}
    </CMDialog>;
}

export function MergeUsersButton({ user }: { user: { publicId: UserPublicId; name: string } }) {
    const [open, setOpen] = React.useState(false);
    return <>
        <CMUserMgmtButton onClick={() => setOpen(true)}>Merge with another user</CMUserMgmtButton>
        {open && <MergeUsersDialog user={user} onClose={() => setOpen(false)} />}
    </>;
}
