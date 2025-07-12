import { CMTable, CMTableSlot } from "@/src/core/components/CMTable";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { getURIForFile } from "@/src/core/db3/clientAPILL";
import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { formatFileSize } from "shared/rootroot";
import { CalcRelativeTiming, DateTimeRange, formatMillisecondsToDHMS } from "shared/time";
import { InspectObject, KeyValueDisplay } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { ActivityLogUserChip } from "src/core/db3/DB3Client";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";
import getServerHealth from "src/core/db3/queries/getServerHealth";
import { GetServerHealthResult, ServerHealthFileResult, TableStatsQueryRow } from "src/core/db3/shared/apiTypes";

const UploadsStats = ({ serverHealthResults }: { serverHealthResults: GetServerHealthResult }) => {
    const [filterSourceData, filterSourceDataOther] = useQuery(getDistinctChangeFilterValues, {});
    const totalSize = serverHealthResults.uploads.files.reduce((sum, f) => sum + f.size, 0);

    const totalsRow: ServerHealthFileResult = {
        fileName: `${serverHealthResults.uploads.files.length} files`,
        isDirectory: false,
        size: totalSize,
        modified: new Date(),
        fileId: undefined,
        leafName: undefined,
        isDeleted: undefined,
        mimeType: undefined,
        uploadedByUserId: undefined,
        uploadedAt: undefined,
        externalURI: undefined,
    };

    return <CMTable
        rows={serverHealthResults.uploads.files}
        footerRow={totalsRow}
        columns={[
            { memberName: "fileId" },
            { memberName: "leafName" },
            { memberName: "isDeleted" },
            { memberName: "mimeType" },
            {
                memberName: "uploadedByUserId", render: args => {
                    return args.row.uploadedByUserId ? <ActivityLogUserChip userId={args.row.uploadedByUserId} cacheData={filterSourceData} /> : null;
                }
            },
            { memberName: "uploadedAt" },
            { memberName: "externalURI" },
            {
                memberName: "fileName", render: args => {
                    if (args.slot === CMTableSlot.Footer) {
                        return args.row.fileName;
                    }
                    return <a href={!args.row.fileName ? undefined : getURIForFile({
                        fileLeafName: args.row.leafName || "?",
                        storedLeafName: args.row.fileName,
                        externalURI: args.row.externalURI || null,
                    })} target="_blank" rel="noreferrer">{args.row.fileName}</a>
                }
            },
            {
                memberName: "modified", render: (args) => {
                    if (args.slot === CMTableSlot.Footer) {
                        return null;
                    }

                    const value = args.row.modified;

                    const range = new DateTimeRange({
                        durationMillis: 0,
                        isAllDay: false,
                        startsAtDateTime: args.row.modified,
                    });
                    //return <EventDateField dateRange={range} />;

                    const relativeTiming = CalcRelativeTiming(new Date(), range);
                    return <>{range.toString()} {relativeTiming.label}</>; // todo
                }
            },
            {
                memberName: "size", render: (args => {
                    return formatFileSize(args.row.size);
                }),
                valueBar: {
                    getValue: (row) => row.size,
                    color: '#08f2',
                }
            },
            {
                memberName: "isDirectory", render: args => {
                    if (args.slot === CMTableSlot.Footer) return null;
                    return args.defaultRenderer(args.row.isDirectory);
                }
            },
        ]}
    />;
};


const DatabaseStats = ({ serverHealthResults }: { serverHealthResults: GetServerHealthResult }) => {
    const totalValues: TableStatsQueryRow = serverHealthResults.database.tableStats.reduce((acc, v) => ({
        table_name: "",
        table_rows: acc.table_rows + v.table_rows,
        index_length: acc.index_length + v.index_length,
        data_length: acc.data_length + v.data_length,
    }), {
        table_name: "",
        table_rows: 0,
        index_length: 0,
        data_length: 0,
    });
    return <CMTable
        rows={serverHealthResults.database.tableStats}
        footerRow={totalValues}
        columns={[
            { memberName: "table_name" },
            {
                memberName: "table_rows", render: (args) => args.row.table_rows.toLocaleString(),
                valueBar: {
                    getValue: (row) => row.table_rows,
                }
            },
            {
                memberName: "index_length", render: (args) => formatFileSize(args.row.index_length),
                valueBar: {
                    getValue: (row) => row.index_length,
                }
            },
            {
                memberName: "data_length", render: (args) => formatFileSize(args.row.data_length),
                valueBar: {
                    getValue: (row) => row.data_length,
                }
            },
        ]}
    />
};

enum TabId {
    Database = "Database",
    Uploads = "Uploads",
    Env = "Env",
};


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const [tabId, setTabId] = React.useState<TabId>(TabId.Database);
    const [serverHealthResults, serverHealthQueryResult] = useQuery(getServerHealth, {});
    //console.log(serverHealthResults.env);
    return <div>
        <InspectObject src={serverHealthResults} />
        <KeyValueDisplay className="serverStartInfo" data={{
            ...dashboardContext.serverStartupState,
            uptime: formatMillisecondsToDHMS(dashboardContext.serverStartupState.uptimeMS),
            uptimeMS: undefined,
        }} />
        <CMTabPanel
            handleTabChange={(e, n) => setTabId(n as any)}
            selectedTabId={tabId}
        >
            <CMTab
                thisTabId={TabId.Database}
                summaryTitle={"Database"}
            >
                <DatabaseStats serverHealthResults={serverHealthResults} />
                <pre>{serverHealthResults.database.tableStatsQuery}</pre>
            </CMTab>
            <CMTab
                thisTabId={TabId.Uploads}
                summaryTitle={"Uploads directory"}
            >
                <UploadsStats serverHealthResults={serverHealthResults} />
            </CMTab>
            <CMTab
                thisTabId={TabId.Env}
                summaryTitle={"Env"}
            >
                <KeyValueDisplay data={serverHealthResults.env} />
            </CMTab>
        </CMTabPanel>

    </div>;
};


const ServerHealthPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Server health" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default ServerHealthPage;
