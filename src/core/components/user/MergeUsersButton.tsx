import { useCmdbRouter } from "@/src/route/useCmdbRouter";
import { invoke, useMutation, useQuery } from "@blitzjs/rpc";
import { Alert } from "@mui/material";
import React from "react";
import type { UserPublicId } from "shared/publicId";
import mergeUsers from "src/auth/mutations/mergeUsers";
import getUserMergeAccountAnalysis from "src/auth/queries/getUserMergeAccountAnalysis";
import previewUserMerge from "src/auth/queries/previewUserMerge";
import searchUserMergeCandidates from "src/auth/queries/searchUserMergeCandidates";
import type { MergeIdentity, MergeReportText, UserMergePresentation, UserMergePreview } from "src/auth/userMergeSchemas";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import type { UserMassAnalysisResult } from "src/core/db3/shared/getUserMassAnalysisTypes";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { portalHref } from "src/route/portalRouting";
import { CMButton, CMUserMgmtButton } from "../CMCoreComponents2";
import { CMDialog } from "../CMDialog";
import { CMTable } from "../CMTable";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { DateValue } from "../DateTime/DateTimeComponents";
import { CMSelectDisplayStyle, CMSingleSelect } from "../select/CMSelect";
import { CMSelectNullBehavior } from "../select/selectionSource";

export function UserMergeReport({ preview }: { preview: UserMergePreview }) {
    const locale = useLocale();
    const viewer = useDashboardContext();
    const reportText = (text: MergeReportText) => typeof text === "string" ? text : locale.getPlainString(text.key);
    return <div className="user-merge-report">
        <table><tbody>
            <tr><th>Main account</th><td>{preview.main.name} - {preview.main.publicId} - {preview.main.email}</td></tr>
            <tr><th>Retiring account</th><td>{preview.retiring.name} - {preview.retiring.publicId} - {preview.retiring.email}</td></tr>
            <tr><th>Resulting global role</th><td>{preview.main.roleName ?? "--"}{preview.main.isSysAdmin ? " (Sysadmin)" : ""}</td></tr>
        </tbody></table>
        {preview.sections.map(section => <section key={section.key}>
            <h3>{reportText(section.title)}</h3>
            <p>{reportText(section.policy)}</p>
            {!!section.effects.length && <table><tbody>{section.effects.map(effect => <tr key={reportText(effect.label)}><th>{reportText(effect.label)}</th><td>{new Intl.NumberFormat(viewer.formattingLocale).format(effect.count)}</td></tr>)}</tbody></table>}
            {section.consequences?.map(text => <p key={reportText(text)}>{reportText(text)}</p>)}
            {section.blockers?.map(text => <Alert key={text} severity="warning">{text}</Alert>)}
        </section>)}
    </div>;
}
function MergeUserListItem({ user }: { user: MergeIdentity }) {
    const viewer = useDashboardContext();
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <div>{user.publicId} <strong>{user.name}</strong> {user.roleName ?? "--"}{user.isDeleted ? " (deactivated)" : ""}</div>
        <div>{user.email}</div>
        <div>Created: <DateValue value={user.createdAt} formattingLocale={viewer.formattingLocale} timeZone={viewer.localTimeZone} /></div>
    </div>;
}
export function UserMassAnalysisSummaryCard({ analysis, caption }: { analysis: UserMassAnalysisResult; caption: string }) {
    const viewer = useDashboardContext();
    const rows: { label: string; value: React.ReactNode }[] = [
        { label: "Public ID", value: analysis.userInfo.publicId }, { label: "Name", value: analysis.userInfo.name },
        { label: "Email", value: analysis.userInfo.email }, { label: "Global role", value: analysis.userInfo.globalRoleName ?? "--" },
        { label: "Created At", value: <DateValue value={analysis.userInfo.createdAt} formattingLocale={viewer.formattingLocale} timeZone={viewer.localTimeZone} /> },
        { label: "Last activity", value: <DateValue value={analysis.activityMetrics.lastActivityDate} formattingLocale={viewer.formattingLocale} timeZone={viewer.localTimeZone} /> },
        { label: "Content items", value: Object.values(analysis.contentCounts).reduce((sum, count) => sum + count, 0) },
        { label: "Participation items", value: Object.values(analysis.participationCounts).reduce((sum, count) => sum + count, 0) },
        { label: "System items", value: Object.values(analysis.systemCounts).reduce((sum, count) => sum + count, 0) },
    ];
    return <div className="user-mass-analysis-summary-card" style={{ flex: 1, minWidth: 240 }}>
        <h3>{caption}</h3><CMTable rows={rows} columns={[
            { header: "", memberName: "label", render: row => <span>{row.row.label}</span> },
            {
                header: "", memberName: "value", render: row => <span>{typeof row.row.value === "number" ? new Intl.NumberFormat(viewer.formattingLocale).format(row.row.value) : row.row.value}</span>,
                valueBar: { getValue: row => typeof row.value === "number" ? row.value : undefined }
            },
        ]} />
    </div>;
}
type MergeProfile = { publicId: UserPublicId; name: string };
function MergeUsersDialog({ user, onClose, input }: { user: MergeProfile; onClose: () => void; input: UserMergePresentation }) {
    //const router = useRouter();
    const router = useCmdbRouter();
    const locale = useLocale();
    // The parent remounts on any presentation/actor change. Pin this dialog's request context.
    const [requestInput] = React.useState(input);
    const [merge] = useMutation(mergeUsers);
    const [other, setOther] = React.useState<MergeIdentity | null>(null);
    const [mainIsProfile, setMainIsProfile] = React.useState(true);
    const [preview, setPreview] = React.useState<UserMergePreview | null>(null);
    const [pending, setPending] = React.useState<"preview" | "commit" | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const live = React.useRef(true);
    React.useEffect(() => {
        live.current = true;
        return () => {
            live.current = false;
        };
    }, []);
    const [profileAnalysis, primary] = useQuery(getUserMergeAccountAnalysis, { ...requestInput, userId: user.publicId },
        { staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
    const [otherAnalysis, secondary] = useQuery(getUserMergeAccountAnalysis, { ...requestInput, userId: other?.publicId ?? user.publicId },
        { enabled: other !== null, staleTime: 0, cacheTime: 0, keepPreviousData: false, suspense: false, useErrorBoundary: false });
    const getCandidates = React.useCallback(({ quickFilter }: { quickFilter: string | undefined }) => invoke(searchUserMergeCandidates,
        { ...requestInput, query: quickFilter ?? "", excludeUserId: user.publicId }), [requestInput, user.publicId]);
    const selectedProfile = !primary.error && profileAnalysis?.userInfo.publicId === user.publicId ? profileAnalysis : null;
    const selectedOther = other && !secondary.error && otherAnalysis?.userInfo.publicId === other.publicId ? otherAnalysis : null;
    const mainAnalysis = mainIsProfile ? selectedProfile : selectedOther;
    const retiringAnalysis = mainIsProfile ? selectedOther : selectedProfile;
    const analysisFailed = Boolean(primary.error) || (other !== null && Boolean(secondary.error));
    const participants = other ? { mainUserId: mainIsProfile ? user.publicId : other.publicId, retiringUserId: mainIsProfile ? other.publicId : user.publicId } : null;
    async function showPreview() {
        if (!participants || pending) {
            return;
        }
        setPending("preview"); setError(null); setPreview(null);
        try {
            const result = await invoke(previewUserMerge, { ...requestInput, participants });
            if (live.current) {
                setPreview(result);
            }
        } catch (failure) {
            if (live.current) {
                setError(failure instanceof Error ? failure.message : "Unable to prepare the merge report.");
            }
        } finally {
            if (live.current) {
                setPending(null);
            }
        }
    }
    async function commit() {
        if (!participants || !preview || pending) {
            return;
        }
        setPending("commit"); setError(null);
        try {
            const result = await merge({ ...requestInput, participants, confirmation: preview.confirmation });
            if (live.current) {
                onClose();
                await router.push(portalHref("/platform/user/" + result.mainUserId, requestInput, router.hosting));
            }
        } catch (failure) {
            if (live.current) {
                setPreview(null);
                setError(failure instanceof Error ? failure.message : "Unable to merge the accounts.");
            }
        } finally {
            if (live.current) {
                setPending(null);
            }
        }
    }
    return <CMDialog open title={locale.getPlainString("accountMerge.title")} onClose={pending ? undefined : onClose} fullWidth maxWidth="md" actions={<>
        <CMButton disabled={pending !== null} onClick={onClose}>{locale.getPlainString("accountMerge.cancel")}</CMButton>
        {preview ? <CMButton disabled={pending !== null || analysisFailed || !preview.canCommit} onClick={commit}>{locale.getPlainString("accountMerge.accept")}</CMButton>
            : <CMButton disabled={pending !== null || !other || analysisFailed} onClick={showPreview}>{locale.getPlainString("accountMerge.preview")}</CMButton>}
    </>}>
        <p>{locale.getPlainString("accountMerge.instruction")}</p>
        <CMSingleSelect<MergeIdentity> value={other} nullBehavior={CMSelectNullBehavior.AllowNull} readonly={pending !== null}
            onChange={value => {
                setOther(value);
                if (!value) {
                    setMainIsProfile(true);
                }
                setPreview(null);
                setError(null);
            }}
            getOptions={getCandidates} getOptionInfo={account => ({ id: account.publicId, name: account.name + " " + account.email + " " + account.publicId })}
            renderOption={account => <MergeUserListItem user={account} />} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
            dialogTitle={locale.getPlainString("accountMerge.pickTitle")} editButtonChildren={locale.getPlainString("accountMerge.select")} allowQuickFilter />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            {mainAnalysis && <UserMassAnalysisSummaryCard analysis={mainAnalysis} caption={locale.getPlainString("accountMerge.keep")} />}
            {retiringAnalysis && <UserMassAnalysisSummaryCard analysis={retiringAnalysis} caption={locale.getPlainString("accountMerge.retire")} />}
        </div>
        <CMButton disabled={pending !== null || !other} onClick={() => { setMainIsProfile(value => !value); setPreview(null); setError(null); }}>{locale.getPlainString("accountMerge.swap")}</CMButton>
        <CMButton disabled={pending !== null || primary.isFetching || (other !== null && secondary.isFetching)} onClick={() => {
            setPreview(null); setError(null); void primary.refetch();
            if (other) {
                void secondary.refetch();
            }
        }}>{locale.getPlainString("accountMerge.refresh")}</CMButton>
        {analysisFailed && <Alert severity="error">{locale.getPlainString("accountMerge.loadFailed")}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {pending && <p role="status">{locale.getPlainString(pending === "commit" ? "accountMerge.merging" : "accountMerge.loading")}</p>}
        {preview && !analysisFailed && <UserMergeReport preview={preview} />}
    </CMDialog>;
}
function ScopedMergeUsersButton({ user }: { user: MergeProfile }) {
    const context = useDB3QueryContext();
    const { bandPublicId: _band, ...input } = context;
    const locale = useLocale();
    const [open, setOpen] = React.useState(false);
    return <><CMUserMgmtButton onClick={() => setOpen(true)}>{locale.getPlainString("accountMerge.open")}</CMUserMgmtButton>
        {open && <MergeUsersDialog user={user} input={input} onClose={() => setOpen(false)} />}</>;
}
export function MergeUsersButton(props: { user: MergeProfile }) {
    const context = useDB3QueryContext();
    const presentation = usePresentation();
    const scope = JSON.stringify([props.user.publicId, context.bandPublicId, context.routeLocale, context.browserLanguages, context.clientRequestId, presentation.data?.authorization.userPublicId]);
    return <ScopedMergeUsersButton key={scope} {...props} />;
}
