import React, { Suspense } from "react";
import { useQuery } from "@blitzjs/rpc";
import type { GridRenderCellParams } from "@mui/x-data-grid";
import { ContentCopy, Launch, Terminal } from "@mui/icons-material";
import { CMButton, NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMDialog } from "src/core/components/CMDialog";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { useLocale } from "src/locale/components/useLocale";
import { getHashedColor } from "shared/utils";
import { CMChip } from "src/core/components/CMChip";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import { parsePublicId } from "shared/publicId";
import { z } from "zod";
import getAdminLogItemInfo from "../queries/getAdminLogItemInfo";
import { IColumnClient, type ColumnPresentationArgs, type RenderViewerArgs } from "./DB3ClientCore";
import { useDB3QueryContext } from "./useDB3Context";
import { AuditReferenceChip, AuditSnapshotViewer } from "./audit/AuditValueViewer";
import type { AuditValue } from "../shared/audit/auditSnapshot";

export function AuditJSONToolbar({ value, onExpand }: { value: AuditValue; onExpand: () => void }) {
    const snackbar = useSnackbar();
    const locale = useLocale();
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            snackbar.showMessage({ severity: "success", children: locale.getPlainString("auditLog.copied") });
        } catch {
            snackbar.showMessage({ severity: "error", children: locale.getPlainString("auditLog.copyFailed") });
        }
    };
    const dump = () => {
        console.log(value);
        snackbar.showMessage({ severity: "success", children: locale.getPlainString("auditLog.dumped") });
    };
    return <div style={{ display: "flex", gap: 4 }}>
        <CMButton aria-label={locale.getPlainString("auditLog.copy")} tooltip={locale.getPlainString("auditLog.copy")} onClick={() => void copy()}><ContentCopy fontSize="small" /></CMButton>
        <CMButton aria-label={locale.getPlainString("auditLog.dump")} tooltip={locale.getPlainString("auditLog.dump")} onClick={dump}><Terminal fontSize="small" /></CMButton>
        <CMButton aria-label={locale.getPlainString("auditLog.expand")} tooltip={locale.getPlainString("auditLog.expand")} onClick={onExpand}><Launch fontSize="small" /></CMButton>
    </div>;
}

export function AuditJSONCell({ changeId, tableName, member }: { changeId: number; tableName: string; member: "oldValues" | "newValues" }) {
    const context = useDB3QueryContext();
    const locale = useLocale();
    const [expanded, setExpanded] = React.useState(false);
    const [detail] = useQuery(getAdminLogItemInfo, { ...context, changeId }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const value = detail[member];
    return <div className="audit-json" style={{ width: "100%", minWidth: 0 }}>
        <AuditJSONToolbar value={value} onExpand={() => setExpanded(true)} />
        <small>{new Blob([JSON.stringify(value)]).size} bytes</small>
        <AuditSnapshotViewer tableName={tableName} value={value} />
        {expanded && <CMDialog open onClose={() => setExpanded(false)} title={`${tableName}: ${member}`}
            actions={<CMButton onClick={() => setExpanded(false)}>{locale.getPlainString("auditLog.close")}</CMButton>}>
            <AuditJSONToolbar value={value} onExpand={() => setExpanded(true)} />
            <AuditSnapshotViewer tableName={tableName} value={value} />
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(value, null, 2)}</pre>
        </CMDialog>}
    </div>;
}

export function AuditRecordCell({ changeId, recordId }: { changeId: number; recordId: number }) {
    const context = useDB3QueryContext();
    const [detail] = useQuery(getAdminLogItemInfo, { ...context, changeId }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    return <div><span>{recordId}</span>{detail.record && <AuditReferenceChip reference={detail.record} />}
        {detail.related.map(reference => <AuditReferenceChip key={reference.publicId} reference={reference} />)}</div>;
}

export function ActivityLogUserChip({ user }: { user: { publicId: string; name?: string } | null | undefined }) {
    const context = useDB3QueryContext();
    const locale = useLocale();
    if (!user) {
        return <span>{locale.getPlainString("auditLog.unknownActor")}</span>;
    }
    return <CMChip size="small" tooltip={user.publicId}>
        <a href={withMemberPresentation(`/backstage/user/${user.publicId}`, { ...context,
            bandPublicId: context.bandPublicId ? parsePublicId<"Band">(context.bandPublicId) : null })}
            target="_blank" rel="noreferrer" style={{ color: getHashedColor(user.publicId) }}>{user.name ?? ""}</a>
    </CMChip>;
}

export class JSONStringColumnClient extends IColumnClient<string, string | null> {
    constructor(args: ColumnPresentationArgs & { columnName: "oldValues" | "newValues" }) {
        super({ ...args, editable: false, visible: true, width: 400, className: "audit-json-cell", isAutoFocusable: false,
            headerNameKey: args.fieldCaptionKey, GridColProps: { sortable: false, filterable: false },
        });
    }
    renderForNewDialog = undefined;
    ApplyClientToPostClient = undefined;
    private cell = (row: { id?: unknown; table?: unknown }) => {
        if (typeof row.id !== "number" || typeof row.table !== "string" || (this.columnName !== "oldValues" && this.columnName !== "newValues")) {
            throw new Error("Audit JSON columns require an audit row and snapshot member.");
        }
        return <Suspense><AuditJSONCell changeId={row.id} tableName={row.table} member={this.columnName} /></Suspense>;
    };
    onSchemaConnected = () => {
        this.GridColProps = { ...this.GridColProps, renderCell: (params: GridRenderCellParams) => this.cell(params.row) };
    };
    renderViewer = (params: RenderViewerArgs<string | null>) => <NameValuePair name={this.fieldCaption} value={this.cell(params.row)} isReadOnly />;
}

export function AuditActorCell({ changeId, userId }: { changeId: number; userId: number | null }) {
    const context = useDB3QueryContext();
    const [detail] = useQuery(getAdminLogItemInfo, { ...context, changeId }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    return <div><span>{userId}</span><ActivityLogUserChip user={detail.user} /></div>;
}

export class AuditActorColumnClient extends IColumnClient<string, number | null> {
    constructor(columnName: string) {
        super({ columnName, editable: false, visible: true, width: 160, className: undefined, isAutoFocusable: false,
            headerNameKey: "db3.fields.member", fieldCaptionKey: "db3.fields.member", fieldDescriptionKey: null,
        });
    }
    renderForNewDialog = undefined;
    ApplyClientToPostClient = undefined;
    onSchemaConnected = () => {
        this.GridColProps = { sortable: false, filterable: false, renderCell: (params: GridRenderCellParams) =>
            <Suspense><AuditActorCell changeId={z.number().parse(params.id)} userId={z.number().nullable().parse(params.value)} /></Suspense> };
    };
    renderViewer = (params: RenderViewerArgs<number | null>) =>
        <Suspense><AuditActorCell changeId={z.number().parse(params.row.id)} userId={params.value} /></Suspense>;
}

export class AuditRecordColumnClient extends IColumnClient<string, number> {
    constructor(columnName: string) {
        super({ columnName, editable: false, visible: true, width: 200, className: undefined, isAutoFocusable: false,
            headerNameKey: "db3.fields.recordId", fieldCaptionKey: "db3.fields.recordId", fieldDescriptionKey: null,
        });
    }
    renderForNewDialog = undefined;
    ApplyClientToPostClient = undefined;
    onSchemaConnected = () => {
        this.GridColProps = { sortable: false, filterable: false, renderCell: (params: GridRenderCellParams) =>
            <Suspense><AuditRecordCell changeId={z.number().parse(params.id)} recordId={z.number().parse(params.value)} /></Suspense> };
    };
    renderViewer = (params: RenderViewerArgs<number>) => <Suspense><AuditRecordCell changeId={z.number().parse(params.row.id)} recordId={params.value} /></Suspense>;
}
