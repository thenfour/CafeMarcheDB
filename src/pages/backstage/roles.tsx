import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import getAllRoles from "src/auth/queries/getAllRoles";
import setRoleDesignation from "src/auth/mutations/setRoleDesignation";
import {
    RoleDesignation,
    type RoleDesignationValue,
} from "src/auth/roleDesignations";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";

const BuiltInRoleAssignments = () => {
    const [roles, { refetch }] = useQuery(getAllRoles, {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const [setDesignation, mutationState] = useMutation(setRoleDesignation);
    const [error, setError] = React.useState<string | null>(null);

    const assignments: Array<{
        designation: RoleDesignationValue;
        flag: "isRoleForNewUsers" | "isPublicRole";
        label: string;
    }> = [
        {
            designation: RoleDesignation.newUsers,
            flag: "isRoleForNewUsers",
            label: "Role for new users",
        },
        {
            designation: RoleDesignation.public,
            flag: "isPublicRole",
            label: "Public role",
        },
    ];

    const handleAssignment = async (designation: RoleDesignationValue, roleId: number) => {
        setError(null);
        try {
            await setDesignation({ designation, roleId });
            await refetch();
        } catch {
            setError("Role assignment failed.");
        }
    };

    return <div style={{ margin: "16px 0" }}>
        <h3>Built-in role assignments</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {assignments.map(assignment => {
                const matchingRoles = roles.filter(role => role[assignment.flag]);
                const selectedRoleId = matchingRoles.length === 1 ? matchingRoles[0]!.id : "";
                const labelId = `role-designation-${assignment.designation}-label`;
                const helperText = matchingRoles.length === 1
                    ? ""
                    : `${matchingRoles.length} roles are currently assigned; select one to repair this.`;

                return <FormControl
                    error={matchingRoles.length !== 1}
                    key={assignment.designation}
                    size="small"
                    style={{ minWidth: 240 }}
                >
                    <InputLabel id={labelId}>{assignment.label}</InputLabel>
                    <Select
                        disabled={mutationState.isLoading}
                        label={assignment.label}
                        labelId={labelId}
                        value={selectedRoleId}
                        onChange={event => void handleAssignment(
                            assignment.designation,
                            Number(event.target.value),
                        )}
                    >
                        {roles.map(role => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
                    </Select>
                    {helperText && <FormHelperText>{helperText}</FormHelperText>}
                </FormControl>;
            })}
        </div>
        {error && <div className="error">{error}</div>}
    </div>;
};

const MainContent = () => {
    const RoleClientSchema = new DB3Client.xTableClientSpec({
        table: db3.xRole,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 200 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 120 }),
            new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 120 }),
            new DB3Client.TagsFieldClient({ columnName: "permissions", cellWidth: 300, allowDeleteFromCell: false }),
        ],
    });

    return <>
        <SettingMarkdown setting="RolesAdminPage_markdown"></SettingMarkdown>
        <BuiltInRoleAssignments />
        <DB3EditGrid tableSpec={RoleClientSchema} />
    </>;
};

const RolesListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="User Roles" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    );
};

export default RolesListPage;
