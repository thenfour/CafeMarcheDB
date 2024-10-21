import { BlitzPage } from "@blitzjs/next";
import { useQuery } from "@blitzjs/rpc";
import * as React from 'react';
import { StandardVariationSpec } from "shared/color";
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, IsNullOrWhitespace, existsInArray, toggleValueInArray } from "shared/utils";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { NameValuePair } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { DashboardContext } from "src/core/components/DashboardContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Prisma } from "db";
import { WorkflowViewer } from "src/core/components/WorkflowEventComponents";

type AdHocUser = Prisma.UserGetPayload<{
    select: {
        name: true,
        id: true,
        email: true,
    }
}>;

//type ActivityLogCacheData = ReturnType<typeof useQuery<typeof getDistinctChangeFilterValues>>;

//type QueryResult<T> = { data: T, isLoading: boolean, error: Error | null };

// Then use it like so
type ActivityLogCacheData = Awaited<ReturnType<typeof getDistinctChangeFilterValues>>;

const AdHocUsersEqual = (a: AdHocUser, b: AdHocUser): boolean => {
    return a.id === b.id;
};

const MainContent = () => {
    const [recordIdFilter, setRecordIdFilter] = React.useState<string>("");
    const [tableNameFilter, setTableNameFilter] = React.useState<string>("");
    const [userNameFilter, setUserNameFilter] = React.useState<string>("");
    const [tableNames, setTableNames] = React.useState<string[]>([]);
    const [users, setUsers] = React.useState<AdHocUser[]>([]);
    const dashboardContext = React.useContext(DashboardContext);

    const [filterSourceData, filterSourceDataOther] = useQuery(getDistinctChangeFilterValues, {});

    const renderWorkflow = (workflowDef) => <WorkflowViewer value={workflowDef} />;

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xChange,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, size: "small" }),

            new DB3Client.GenericStringColumnClient({ columnName: "action", cellWidth: 80 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "context", cellWidth: 150 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "operationId", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "table", cellWidth: 150 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "recordId", cellWidth: 80, }),
            //new DB3Client.GenericStringColumnClient({ columnName: "sessionHandle", cellWidth: 150 }),
            new DB3Client.JSONStringColumnClient({ columnName: "oldValues", cacheData: filterSourceData, renderWorkflow }),
            new DB3Client.JSONStringColumnClient({ columnName: "newValues", cacheData: filterSourceData, renderWorkflow }),
            new DB3Client.DateTimeColumn({ columnName: "changedAt" }),
        ],
    });

    const tableButton = (otherTableName: string) => {
        const selected = (tableNames.indexOf(otherTableName) !== -1);
        return <CMChip
            key={otherTableName}
            size="small"
            variation={{ ...StandardVariationSpec.Strong, selected }}
            onClick={() => {
                setTableNames(toggleValueInArray(tableNames, otherTableName));
            }}
        >
            {otherTableName}
        </CMChip>;
    };

    const userButton = (user: AdHocUser) => {
        const selected = existsInArray(users, user, AdHocUsersEqual);// (tableNames.indexOf(otherTableName) !== -1);
        return <CMChip
            key={user.id}
            variation={{ ...StandardVariationSpec.Strong, selected }}
            size="small"
            onClick={() => {
                setUsers(toggleValueInArray(users, user, AdHocUsersEqual));
            }}
            tooltip={`id:${user.id} email:${user.email}`}
        >
            {user.name}
        </CMChip>;
    };

    filterSourceData.tableNames.sort((a, b) => a.tableName.localeCompare(b.tableName));
    filterSourceData.users.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // items that are filtered and selected need to still be shown despite filter
    // is filtered out
    // AND is in selection
    const tableNamePassesFilter = (n: { tableName: string }): boolean => IsNullOrWhitespace(tableNameFilter) ? true : n.tableName.toLowerCase().includes(tableNameFilter);
    const visibleFilteredTableNames = filterSourceData.tableNames.filter(n => !tableNamePassesFilter(n) && existsInArray(tableNames, n.tableName.toLowerCase()));

    const userPassesFilter = (n: AdHocUser): boolean => IsNullOrWhitespace(userNameFilter) ? true : (n.name.toLowerCase().includes(userNameFilter) || n.email.toLowerCase().includes(userNameFilter));
    const visibleFilteredUsers = filterSourceData.users.filter(n => !userPassesFilter(n) && existsInArray(users, n, AdHocUsersEqual));

    return <>
        <SettingMarkdown setting="AdminLogsPage_markdown"></SettingMarkdown>
        <NameValuePair
            isReadOnly={false}
            name={"Table"}
            value={
                <div>
                    <CMTextInputBase onChange={(e, v) => setTableNameFilter(v.toLowerCase())} value={tableNameFilter} />
                    <CMChipContainer>
                        {filterSourceData.tableNames
                            .filter(n => tableNamePassesFilter(n))
                            .map(n => tableButton(n.tableName))
                        }
                    </CMChipContainer>
                    <CMChipContainer>
                        {visibleFilteredTableNames
                            .map(n => tableButton(n.tableName))
                        }
                    </CMChipContainer>
                </div>
            }
        />
        <NameValuePair
            isReadOnly={false}
            name={"Users"}
            value={
                <div>
                    <CMTextInputBase onChange={(e, v) => setUserNameFilter(v.toLowerCase())} value={userNameFilter} />
                    <CMChipContainer>
                        {filterSourceData.users
                            .filter(n => IsNullOrWhitespace(userNameFilter) ? true : (n.name.toLowerCase().includes(userNameFilter) || n.email.toLowerCase().includes(userNameFilter)))
                            .map(n => userButton(n))
                        }
                    </CMChipContainer>
                    <CMChipContainer>
                        {visibleFilteredUsers
                            .map(n => userButton(n))
                        }
                    </CMChipContainer>
                </div>
            }
        />
        <NameValuePair
            isReadOnly={false}
            name={"Record ID"}
            value={
                <CMTextInputBase onChange={(e, v) => setRecordIdFilter(v)} value={recordIdFilter} />
            }
        />
        <DB3EditGrid
            readOnly={true}
            tableSpec={tableSpec}
            tableParams={{
                tableNames,
                userIds: users.map(u => u.id),
                recordId: CoerceToNumberOrNull(recordIdFilter),
            }}
        />
    </>;
};


const AdminLogsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Admin Logs" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    )
}

export default AdminLogsPage;
