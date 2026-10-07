import { DeferredRoleAdministrationPage } from "src/core/components/DeferredFeaturePage";

export default function RolesPage() {
    return <DeferredRoleAdministrationPage />;
}


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/pages/backstage/roles.tsx:1-128
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 9fc2a575d5a0149e49a96b7a1c7a52111649e135a06bb73f51d2cd4c31105d25
// MIGRATION_REFERENCE_BEGIN
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { useMutation } from "@blitzjs/rpc";
// import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from "@mui/material";
// import React from "react";
// import setRoleDesignation from "src/auth/mutations/setRoleDesignation";
// import {
//     RoleDesignation,
//     type RoleDesignationValue,
// } from "src/auth/roleDesignations";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
// import * as DB3Client from "src/core/db3/DB3Client";
// import type { RolePublicId } from "shared/publicId";
//
// const BuiltInRoleAssignments = () => {
//     const rolesClient = DB3Client.useDb3Query({
//         view: db3.roleDashboardView,
//     });
//     const roles = rolesClient.items;
//     const [setDesignation, mutationState] = useMutation(setRoleDesignation);
//     const [error, setError] = React.useState<string | null>(null);
//
//     const assignments: Array<{
//         designation: RoleDesignationValue;
//         flag: "isRoleForNewUsers" | "isPublicRole" | "isSysAdminRole";
//         label: string;
//     }> = [
//             {
//                 designation: RoleDesignation.newUsers,
//                 flag: "isRoleForNewUsers",
//                 label: "Role for new users",
//             },
//             {
//                 designation: RoleDesignation.public,
//                 flag: "isPublicRole",
//                 label: "Public role",
//             },
//             {
//                 designation: RoleDesignation.sysadmin,
//                 flag: "isSysAdminRole",
//                 label: "Sysadmin role",
//             },
//         ];
//
//     const handleAssignment = async (designation: RoleDesignationValue, roleId: RolePublicId) => {
//         setError(null);
//         try {
//             await setDesignation({ designation, roleId });
//             await rolesClient.refetch();
//         } catch {
//             setError("Role assignment failed.");
//         }
//     };
//
//     return <div style={{ margin: "16px 0" }}>
//         <h3>Built-in role assignments</h3>
//         <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
//             {assignments.map(assignment => {
//                 const matchingRoles = roles.filter(role => role[assignment.flag]);
//                 const selectedRoleId = matchingRoles.length === 1
//                     ? db3.xRole.getIdentity(matchingRoles[0]!)
//                     : "";
//                 const labelId = `role-designation-${assignment.designation}-label`;
//                 const helperText = matchingRoles.length === 1
//                     ? ""
//                     : `${matchingRoles.length} roles are currently assigned; select one to repair this.`;
//
//                 return <FormControl
//                     error={matchingRoles.length !== 1}
//                     key={assignment.designation}
//                     size="small"
//                     style={{ minWidth: 240 }}
//                 >
//                     <InputLabel id={labelId}>{assignment.label}</InputLabel>
//                     <Select
//                         disabled={mutationState.isLoading}
//                         label={assignment.label}
//                         labelId={labelId}
//                         value={selectedRoleId}
//                         onChange={event => void handleAssignment(
//                             assignment.designation,
//                             db3.xRole.parseIdentity(event.target.value),
//                         )}
//                     >
//                         {roles.map(role => {
//                             const identity = db3.xRole.getIdentity(role);
//                             return <MenuItem key={identity} value={identity}>{role.name}</MenuItem>;
//                         })}
//                     </Select>
//                     {helperText && <FormHelperText>{helperText}</FormHelperText>}
//                 </FormControl>;
//             })}
//         </div>
//         {error && <div className="error">{error}</div>}
//     </div>;
// };
//
// const MainContent = () => {
//     const RoleClientSchema = DB3Client.defineTableClientSpec({
//         view: db3.roleEditorView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//             name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
//             description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
//             sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
//             color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120 }),
//             permissions: columnName => new DB3Client.TagsFieldClient({ columnName, cellWidth: 300, allowDeleteFromCell: false }),
//         },
//     });
//
//     return <>
//         <LocalizedMarkdown setting="RolesAdminPage_markdown"></LocalizedMarkdown>
//         <BuiltInRoleAssignments />
//         <DB3EditGrid tableSpec={RoleClientSchema} view={db3.roleEditorView} />
//     </>;
// };
//
// const RolesListPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="User Roles">
//             <MainContent />
//         </DashboardLayout>
//     );
// };
//
// export default RolesListPage;
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: role-administration
// Source: 30ce7de7d429973877201a8cf94c27979333cfc6:src/auth/queries/getAllRoles.ts:1-23
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: 5244e8b648c4c6b5622153ec73ce512ed4d33942216cceab684928dc884d22dc
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { cmauthorize } from "@/src/auth/server/cmResolver";
// import { Permission } from "shared/permissions";
// import {
//     roleDashboardView,
// } from "src/core/db3/db3";
// import { queryView } from "src/core/db3/server/db3QueryCore";
// import { platformScope } from "../server/authorizationContext";
//
// export default resolver.pipe(
//     cmauthorize({ permission: Permission.sysadmin, scope: platformScope }),
//     async (_params: unknown, ctx) => {
//         const auth = await ctx.auth.refresh();
//         auth.requirePermission(Permission.sysadmin);
//         const result = await queryView({
//             view: roleDashboardView,
//             filter: { items: [] },
//             cmdbQueryContext: "getAllRoles",
//             orderBy: undefined,
//         }, auth);
//         return result.items;
//     },
// );
// MIGRATION_REFERENCE_END
