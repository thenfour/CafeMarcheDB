import React from "react";
import { z } from "zod";
import { Notes } from "@mui/icons-material";
import { CMChip } from "src/core/components/CMChip";
import { CMButton, SetlistBreakIcon } from "src/core/components/CMCoreComponents2";
import { CMDialog } from "src/core/components/CMDialog";
import { ColorSwatch } from "src/core/components/color/ColorSwatch";
import { gGeneralPaletteList, gStrong } from "src/core/components/color/palette";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import type { AuditReference } from "../../shared/audit/auditContracts";
import type { AuditValue } from "../../shared/audit/auditSnapshot";

export function AuditReferenceChip({ reference }: { reference: AuditReference | null }) {
    const locale = useLocale();
    if (!reference) {
        return <span>{locale.getPlainString("auditLog.unavailable")}</span>;
    }
    return <CMChip size="small" style={{ maxWidth: "100%" }}
        tooltip={`${reference.label} ${reference.publicId}${reference.deleted ? ` (${locale.getPlainString("auditLog.deleted")})` : ""}`}>
        <span style={{ display: "block", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reference.href ? <a href={reference.href} target="_blank" rel="noreferrer">{reference.label}</a> : reference.label}
            {reference.deleted && <> ({locale.getPlainString("auditLog.deleted")})</>}
        </span>
    </CMChip>;
}

interface ValueProps {
    value: AuditValue;
    member?: string;
}

function MarkdownValue({ value }: { value: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const locale = useLocale();
    return <>
        <span style={{ whiteSpace: "pre-wrap" }}>{value}</span>
        <CMButton tooltip={<Markdown markdown={value} />} onClick={() => setExpanded(true)}>{locale.getPlainString("auditLog.markdown")}</CMButton>
        {expanded && <CMDialog open onClose={() => setExpanded(false)} title={locale.getPlainString("auditLog.markdown")}
            actions={<CMButton onClick={() => setExpanded(false)}>{locale.getPlainString("auditLog.close")}</CMButton>}>
            <Markdown markdown={value} />
        </CMDialog>}
    </>;
}

export function AuditValueViewer({ value, member }: ValueProps) {
    if (value === null || typeof value === "boolean" || typeof value === "number") {
        return <span>{String(value)}</span>;
    }
    if (typeof value === "string") {
        if (member && /comment|description|markdown/i.test(member)) {
            return <MarkdownValue value={value} />;
        }
        return <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</span>;
    }
    if (Array.isArray(value)) {
        return <ol>{value.map((child, index) => <li key={index}><AuditValueViewer value={child} /></li>)}</ol>;
    }
    return <table><tbody>{Object.entries(value).map(([key, child]) => <tr key={key}>
        <th style={{ textAlign: "left", verticalAlign: "top" }}>{key}</th>
        <td><AuditValueViewer value={child} member={key} /></td>
    </tr>)}</tbody></table>;
}

const historyIdentity = z.union([z.string(), z.number()]).optional();
const historicalSong = z.object({ id: historyIdentity, songId: z.union([z.string(), z.number()]), sortOrder: z.number(), subtitle: z.string().optional() });
const historicalDivider = z.object({
    id: historyIdentity, sortOrder: z.number(), subtitle: z.string().optional(), color: z.string().nullish(), isInterruption: z.boolean().optional(),
});
const setlistV1 = z.array(historicalSong);
const setlistV2 = z.object({ songs: z.array(historicalSong), dividers: z.array(historicalDivider).optional() });

/** Immutable history deliberately supports both serialized song-list formats. */
export function AuditSnapshotViewer({ tableName, value }: ValueProps & { tableName: string }) {
    const locale = useLocale();
    if (tableName.toLowerCase() !== "eventsonglist") {
        return <AuditValueViewer value={value} />;
    }
    const v1 = setlistV1.safeParse(value);
    const v2 = setlistV2.safeParse(value);
    if (!v1.success && !v2.success) {
        return <AuditValueViewer value={value} />;
    }
    const songs = v1.success ? v1.data : v2.success ? v2.data.songs : [];
    const dividers = v2.success ? v2.data.dividers ?? [] : [];
    const rows = [
        ...songs.map(song => ({ type: "song" as const, value: song })),
        ...dividers.map(divider => ({ type: "divider" as const, value: divider })),
    ].sort((left, right) => left.value.sortOrder - right.value.sortOrder);
    const metadata = value && !Array.isArray(value) && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).filter(([member]) => member !== "songs" && member !== "dividers")) : null;
    return <>
        {metadata && <AuditValueViewer value={metadata} />}
        <table data-audit-setlist><thead><tr>
            <th>{locale.getPlainString("auditLog.order")}</th><th>{locale.getPlainString("auditLog.song")}</th><th>{locale.getPlainString("auditLog.comment")}</th>
        </tr></thead><tbody>{rows.map((row, index) => <tr key={index}>
            <td>{row.value.sortOrder}</td>
            <td>{row.type === "song" ? <AuditValueViewer value={row.value.songId} /> : <>
                <ColorSwatch color={gGeneralPaletteList.findEntry(row.value.color ?? null)} size="small" variation={gStrong} />
                {row.value.isInterruption ? <SetlistBreakIcon /> : <Notes />}
            </>}</td>
            <td>{row.value.subtitle}</td>
        </tr>)}</tbody></table>
    </>;
}
