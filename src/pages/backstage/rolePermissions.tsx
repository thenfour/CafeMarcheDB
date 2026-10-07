import { DeferredRoleAdministrationPage } from "src/core/components/DeferredFeaturePage";

export default DeferredRoleAdministrationPage;


// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/pages/backstage/rolePermissions.tsx:1-84
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: b3948361cfd40030511e373ead8c17554c0ca813b12931e920f952e7b446347e
// MIGRATION_REFERENCE_BEGIN
// // we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// // and that's pretty deep into the UX and logic.
// // here we need CELLS to act like DB rows.
//
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { BlitzPage } from "@blitzjs/next";
// import { FormControlLabel, Tooltip } from "@mui/material";
// import React from "react";
// import { gPermissionOrdered } from "shared/permissions";
// import { LocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
// import * as DB3Client from "src/core/db3/DB3Client";
// import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
// import * as db3 from "src/core/db3/db3";
// import { LocalizedStringColumnClient } from "src/core/db3/components/DB3CatalogFields";
//
//
// const MainContent = () => {
//     const [showUnknown, setShowUnknown] = React.useState<boolean>(false);
//
//     const RoleClientSchema = DB3Client.defineTableClientSpec({
//         view: db3.roleDashboardView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//             name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
//             description: columnName => new DB3Client.MarkdownStringColumnClient({ columnName, cellWidth: 200 }),
//             sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
//         },
//     });
//
//
//     const rolesField = new DB3Client.TagsFieldClient<NonNullable<db3.DtoOf<typeof db3.permissionRoleMatrixView>["roles"]>[number]>({
//         columnName: "roles",
//         cellWidth: 300,
//         allowDeleteFromCell: false,
//         selectionView: db3.roleEditorView,
//     });
//     const PermissionClientSchema = DB3Client.defineTableClientSpec({
//         view: db3.permissionRoleMatrixView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//             name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 200 }),
//             description: columnName => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
//             sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80 }),
//             isVisibility: columnName => new DB3Client.BoolColumnClient({ columnName }),
//             color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120 }),
//             iconName: columnName => new DB3Client.IconFieldClient({ columnName, cellWidth: 120 }),
//             roles: () => rolesField,
//         },
//     });
//
//     const codePermissions = gPermissionOrdered;
//
//     return <>
//         <LocalizedMarkdown setting="rolePermissionsMatrixPage_markdown"></LocalizedMarkdown>
//         <FormControlLabel label="Show unknown permissions" control={<input type="checkbox" checked={showUnknown} onChange={(e) => setShowUnknown(e.target.checked)} />} />
//         <DB3AssociationMatrix
//             localTableSpec={PermissionClientSchema}
//             foreignTableSpec={RoleClientSchema}
//             tagsField={rolesField}
//             associationCommand={db3.setRolePermissionCommand}
//             filterRow={(row) => {
//                 if (showUnknown) return true;
//                 return codePermissions.some(k => k === row.name);
//             }}
//             renderExtraActions={(x) => {
//                 return <div style={{ display: "flex" }}>{x.row.sortOrder}{codePermissions.some(k => k === x.row.name) ? (
//                     <Tooltip title="this permission is in sync with code."><div>🟢</div></Tooltip>)
//                     : (<Tooltip title="this permission is not known in code; it can probably be deleted.">
//                         <div style={{ display: "flex", whiteSpace: "nowrap" }}>🟥Unknown</div></Tooltip>)}</div>
//             }}
//         />
//     </>;
// };
//
//
// const RolePermissionsMatrixPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="RolePerm Matrix">
//             <MainContent />
//         </DashboardLayout>
//     );
// };
//
// export default RolePermissionsMatrixPage;
// MIGRATION_REFERENCE_END
