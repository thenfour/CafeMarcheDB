import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { Permission } from "shared/permissions";
import { formatFileSize } from "shared/rootroot";
import { CalcRelativeTiming, DateTimeRange, formatMillisecondsToDHMS, formatTimeSpan } from "shared/time";
import { CMTab, CMTable, CMTabPanel, KeyValueDisplay } from "src/core/components/CMCoreComponents2";
import { DashboardContext } from "src/core/components/DashboardContext";
import getServerHealth from "src/core/db3/queries/getServerHealth";
import { FileStatResult, GetServerHealthResult, TableStatsQueryRow } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const UploadsStats = ({ serverHealthResults }: { serverHealthResults: GetServerHealthResult }) => {
    const agg = serverHealthResults.uploads.files.map(f => ({
        max: f.size,
        sum: f.size,
    })).reduce((acc, v) => {
        return {
            max: Math.max(acc.max, v.sum),
            sum: acc.sum + v.sum,
        }
    }, {
        max: 1, // avoid div0
        sum: 0,
    });

    const totalsRow: FileStatResult = {
        fileName: `${serverHealthResults.uploads.files.length} files`,
        isDirectory: false,
        size: agg.sum,
        modified: new Date(),
    };

    return <CMTable
        rows={serverHealthResults.uploads.files}
        footerRow={totalsRow}
        columns={[
            { memberName: "fileName" },
            {
                memberName: "modified", render: (args) => {
                    const value = args.row.modified;

                    const range = new DateTimeRange({
                        durationMillis: 0,
                        isAllDay: false,
                        startsAtDateTime: args.row.modified,
                    });

                    const relativeTiming = CalcRelativeTiming(new Date(), range);
                    return <>{range.toString()} {relativeTiming.label}</>; // todo
                }
            },
            {
                memberName: "size", render: (args => {
                    return formatFileSize(args.row.size);
                }),
                getRowStyle: (args) => {
                    const fillAmt01 = args.row.size * 100 / agg.max;
                    return {
                        "--fill_percent": `${fillAmt01.toFixed(2)}%`,
                        "background": "linear-gradient(90deg, #08f2 0%, #08f2 var(--fill_percent), transparent var(--fill_percent))"
                    } as React.CSSProperties;
                }
            },
            { memberName: "isDirectory" },
        ]}
    />;
};


const DatabaseStats = ({ serverHealthResults }: { serverHealthResults: GetServerHealthResult }) => {
    const maxValues = serverHealthResults.database.tableStats.reduce((acc, v) => ({
        table_rows: Math.max(acc.table_rows, v.table_rows),
        index_length: Math.max(acc.index_length, v.index_length),
        data_length: Math.max(acc.data_length, v.data_length),
    }), {
        table_rows: 1,
        index_length: 1,
        data_length: 1,
    });
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
                memberName: "table_rows", render: (args) => args.row.table_rows.toLocaleString(), getRowStyle: (args) => {
                    const fillAmt01 = args.row.table_rows * 100 / maxValues.table_rows;
                    return {
                        "--fill_percent": `${fillAmt01.toFixed(2)}%`,
                        "background": "linear-gradient(90deg, #08f2 0%, #08f2 var(--fill_percent), transparent var(--fill_percent))"
                    } as React.CSSProperties;
                }
            },
            {
                memberName: "index_length", render: (args) => formatFileSize(args.row.index_length), getRowStyle: (args) => {
                    const fillAmt01 = args.row.index_length * 100 / maxValues.index_length;
                    return {
                        "--fill_percent": `${fillAmt01.toFixed(2)}%`,
                        "background": "linear-gradient(90deg, #08f2 0%, #08f2 var(--fill_percent), transparent var(--fill_percent))"
                    } as React.CSSProperties;
                }
            },
            {
                memberName: "data_length", render: (args) => formatFileSize(args.row.data_length), getRowStyle: (args) => {
                    const fillAmt01 = args.row.data_length * 100 / maxValues.data_length;
                    return {
                        "--fill_percent": `${fillAmt01.toFixed(2)}%`,
                        "background": "linear-gradient(90deg, #08f2 0%, #08f2 var(--fill_percent), transparent var(--fill_percent))"
                    } as React.CSSProperties;
                }
            },
        ]}
    />
};

enum TabId {
    Database = "Database",
    Uploads = "Uploads",
};


const MainContent = () => {
    const dashboardContext = React.useContext(DashboardContext);
    const [tabId, setTabId] = React.useState<TabId>(TabId.Database);
    const [serverHealthResults, serverHealthQueryResult] = useQuery(getServerHealth, {});
    return <div>
        <KeyValueDisplay className="serverStartInfo" data={{ ...dashboardContext.serverStartupState, uptime: formatMillisecondsToDHMS(dashboardContext.serverStartupState.uptimeMS), uptimeMS: undefined }} />
        <CMTabPanel
            handleTabChange={(e, n) => setTabId(n as any)}
            selectedTabId={tabId}
        >
            <CMTab
                thisTabId={TabId.Database}
                summaryTitle={"Database"}
            >
                <DatabaseStats serverHealthResults={serverHealthResults} />
            </CMTab>
            <CMTab
                thisTabId={TabId.Uploads}
                summaryTitle={"Uploads directory"}
            >
                <UploadsStats serverHealthResults={serverHealthResults} />
            </CMTab>
        </CMTabPanel>

    </div>;
};


const ServerHealthPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Admin Logs" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default ServerHealthPage;