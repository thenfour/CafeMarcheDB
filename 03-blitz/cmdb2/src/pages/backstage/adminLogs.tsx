import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { useRouter } from "next/router";
import { CMChip, CMChipContainer } from "src/core/components/CMCoreComponents";
import * as React from 'react';
import { StandardVariationSpec } from "shared/color";
import { useQuery } from "@blitzjs/rpc";
import getDistinctChangeFilterValues from "src/core/db3/queries/getDistinctChangeFilterValues";
import { CoerceToNumberOrNull, IsNullOrWhitespace, existsInArray, toggleValueInArray } from "shared/utils";
import { CMTextInputBase } from "src/core/components/CMTextField";

interface AdHocUser {
    name: string,
    id: number,
    email: string,
};

const AdHocUsersEqual = (a: AdHocUser, b: AdHocUser): boolean => {
    return a.id === b.id;
};

const MainContent = () => {
    const [recordIdFilter, setRecordIdFilter] = React.useState<string>("");
    const [tableNameFilter, setTableNameFilter] = React.useState<string>("");
    const [userNameFilter, setUserNameFilter] = React.useState<string>("");
    const [tableNames, setTableNames] = React.useState<string[]>([]);
    const [users, setUsers] = React.useState<AdHocUser[]>([]);

    const [filterSourceData, filterSourceDataOther] = useQuery(getDistinctChangeFilterValues, {});

    if (!useAuthorization("AdminLogsPage", Permission.sysadmin)) {
        throw new Error(`unauthorized`);
    }

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xChange,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "user", cellWidth: 120, }),

            new DB3Client.GenericStringColumnClient({ columnName: "action", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "context", cellWidth: 150 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "operationId", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "table", cellWidth: 150 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "sessionHandle", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "oldValues", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "newValues", cellWidth: 150 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "recordId", cellWidth: 150 }),
            new DB3Client.DateTimeColumn({ columnName: "changedAt" }),
        ],
    });

    const tableButton = (otherTableName: string) => {
        const selected = (tableNames.indexOf(otherTableName) !== -1);
        return <CMChip
            key={otherTableName}
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

    return <>
        <SettingMarkdown setting="AdminLogsPage_markdown"></SettingMarkdown>
        <DB3Client.NameValuePair
            isReadOnly={false}
            name={"Table"}
            value={
                <div>
                    <CMTextInputBase onChange={(e, v) => setTableNameFilter(v.toLowerCase())} value={tableNameFilter} />
                    <CMChipContainer>
                        {filterSourceData.tableNames.filter(n => IsNullOrWhitespace(tableNameFilter) ? true : n.tableName.toLowerCase().includes(tableNameFilter)).map(n => tableButton(n.tableName))}
                    </CMChipContainer>
                </div>
            }
        />
        <DB3Client.NameValuePair
            isReadOnly={false}
            name={"Users"}
            value={
                <div>
                    <CMTextInputBase onChange={(e, v) => setUserNameFilter(v.toLowerCase())} value={userNameFilter} />
                    <CMChipContainer>
                        {filterSourceData.users.filter(n => IsNullOrWhitespace(userNameFilter) ? true : (n.name.toLowerCase().includes(userNameFilter) || n.email.toLowerCase().includes(userNameFilter))).map(n => userButton(n))}
                    </CMChipContainer>
                </div>
            }
        />
        <DB3Client.NameValuePair
            isReadOnly={false}
            name={"Record ID"}
            value={
                <CMTextInputBase onChange={(e, v) => setRecordIdFilter(v)} value={recordIdFilter} />
            }
        />
        <DB3EditGrid
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
        <DashboardLayout title="Admin Logs">
            <MainContent />
        </DashboardLayout>
    )
}

export default AdminLogsPage;
