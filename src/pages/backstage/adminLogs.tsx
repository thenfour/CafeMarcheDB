import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";
import { useLocale } from "src/locale/components/useLocale";
import { getHashedColor } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { auditLogView } from "src/core/db3/shared/audit/auditViews";
import { DB3ReferenceStore } from "src/core/db3/shared/core/db3Hydration";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";

function toggleChoice(values: readonly string[], value: string): string[] {
    return values.includes(value) ? values.filter(entry => entry !== value) : [...values, value];
}

export function AuditLogContent() {
    const locale = useLocale();
    const context = useDB3QueryContext();
    const [filters] = useQuery(getDistinctChangeFilterValues, context, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const [tableText, setTableText] = React.useState("");
    const [userText, setUserText] = React.useState("");
    const [tableNames, setTableNames] = React.useState<string[]>([]);
    const [userIds, setUserIds] = React.useState<string[]>([]);
    // The detail reader supplies current actor and record links; the grid keeps the stored IDs.
    const references = React.useMemo(() => new DB3ReferenceStore(), []);
    const tableSpec = DB3Client.defineTableClientSpec({
        view: auditLogView,
        columns: {
            id: columnName => new DB3Client.PKColumnClient({ columnName }),
            userId: columnName => new DB3Client.AuditActorColumnClient(columnName),
            action: columnName => new DB3Client.GenericStringColumnClient({ fieldCaptionKey: "db3.fields.action", fieldDescriptionKey: null, columnName, cellWidth: 85 }),
            table: columnName => new DB3Client.GenericStringColumnClient({ fieldCaptionKey: "db3.fields.table", fieldDescriptionKey: null, columnName, cellWidth: 150,
                renderCell: params => <span style={{ color: getHashedColor(String(params.value ?? "")) }}>{params.value}</span>,
            }),
            recordId: columnName => new DB3Client.AuditRecordColumnClient(columnName),
            oldValues: () => new DB3Client.JSONStringColumnClient({ fieldCaptionKey: "db3.fields.oldValues", fieldDescriptionKey: null, columnName: "oldValues" }),
            newValues: () => new DB3Client.JSONStringColumnClient({ fieldCaptionKey: "db3.fields.newValues", fieldDescriptionKey: null, columnName: "newValues" }),
            changedAt: columnName => new DB3Client.DateTimeColumn({ fieldCaptionKey: "db3.fields.changedAt", fieldDescriptionKey: null, columnName }),
        },
    });
    const tableOptions = filters.tableNames.filter(row => tableNames.includes(row.tableName) || row.tableName.toLocaleLowerCase().includes(tableText.toLocaleLowerCase()));
    const users = [...filters.users].sort((left, right) => (left.name ?? "").localeCompare(right.name ?? ""));
    const userOptions = users.filter(user => userIds.includes(user.publicId) || `${user.name ?? ""} ${user.email ?? ""} ${user.publicId}`.toLocaleLowerCase().includes(userText.toLocaleLowerCase()));
    return <>
        <BandLocalizedMarkdown id="AdminLogsPage_markdown" />
        <NameValuePair name={locale.getPlainString("auditLog.tables")} value={<>
            <CMTextInputBase aria-label={locale.getPlainString("auditLog.filterTables")} value={tableText} onChange={(_event, value) => setTableText(value)} />
            <CMChipContainer>{tableOptions.map(({ tableName }) => <CMChip key={tableName} size="small"
                color={getHashedColor(tableName)} variation={{ enabled: true, selected: tableNames.includes(tableName), fillOption: "filled", variation: "strong" }}
                onClick={() => setTableNames(toggleChoice(tableNames, tableName))}>{tableName}</CMChip>)}</CMChipContainer>
        </>} />
        <NameValuePair name={locale.getPlainString("auditLog.users")} value={<>
            <CMTextInputBase aria-label={locale.getPlainString("auditLog.filterUsers")} value={userText} onChange={(_event, value) => setUserText(value)} />
            <CMChipContainer>{userOptions.map(user => <CMChip key={user.publicId} size="small" color={getHashedColor(user.publicId)}
                tooltip={`${user.name ?? ""} ${user.email ?? ""} ${user.publicId}`}
                variation={{ enabled: true, selected: userIds.includes(user.publicId), fillOption: "filled", variation: "strong" }}
                onClick={() => setUserIds(toggleChoice(userIds, user.publicId))}>{user.name}</CMChip>)}</CMChipContainer>
        </>} />
        <DB3EditGrid view={auditLogView} tableSpec={tableSpec} referenceProvider={references} readOnly tableParams={{ tableNames, userIds }} />
    </>;
}

function AdminLogsPage() {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("auditLog.title")}><AuditLogContent /></DashboardLayout>;
}

defineCmdbPage("adminLogs", AdminLogsPage);
export default AdminLogsPage;
