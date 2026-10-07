
import { CMLinkButton } from "@/src/core/components/CMCoreComponents2";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { AdminResetPasswordButton } from "@/src/core/components/user/AdminResetPasswordButton";
import { ImpersonateUserButton } from "@/src/core/components/user/ImpersonateUserButton";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import { useClientAuth } from "src/core/db3/components/useClientAuth";
import { useLocale } from "src/locale/components/useLocale";

const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
    // This grid may inspect security state, but generic DB3 mutation must not
    // echo those fields back during an otherwise ordinary insert or update.
    column.editable = false;
    column.renderForNewDialog = undefined;
    column.projectMutation = () => ({});
    return column;
};

const UserListContent: React.FC<{}> = () => {
    const dashboardContext = useDashboardContext();
    const auth = useClientAuth();
    const locale = useLocale();

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.platformUserEditorView,
        columns: {
            publicId: DB3Client.publicIdFieldGen(),

            isDeleted: columnName => makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName })),
            name: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.name", columnName, cellWidth: 160 }),
            email: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.email", columnName, cellWidth: 150 }),
            phone: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.phone", columnName, cellWidth: 120 }),
            cssClass: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.cssClass", columnName, cellWidth: 150 }),
            createdAt: columnName => new DB3Client.CreatedAtColumn({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.createdAt", columnName, cellWidth: 200 }),
            isSysAdmin: columnName => makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sysadmin", columnName })),
        },
    });

    const extraActions = (args: DB3EditGridExtraActionsArgs<db3.ClientOf<typeof db3.platformUserEditorView>>) => {
        const userPayload = args.row;
        const profileUrl = dashboardContext.routingApi.getURIForUser(userPayload);
        return <div>
            <ImpersonateUserButton userId={userPayload.publicId} />
            <AdminResetPasswordButton user={userPayload} />
            {dashboardContext.memberPresentation.bandPublicId
                && (auth.userPublicId === userPayload.publicId || auth.hasPermission(Permission.view_users_basic_info))
                && <CMLinkButton href={profileUrl}>{locale.getPlainString("platformUser.visitProfile")}</CMLinkButton>}
        </div>;
    }

    return <><p>{locale.getPlainString("platformUser.description")}</p><DB3EditGrid
        tableSpec={tableSpec}
        view={db3.platformUserEditorView}
        includeDeleted={true}
        isCellEditable={(row, columnName) => db3.xPlatformUser.authorizeColumnForEdit({
            model: row, columnName, auth, fallbackOwnerId: null,
        })}
        renderExtraActions={extraActions}
        defaultSortModel={[{ field: "createdAt", sort: "desc" }]}
    /></>;
};

const UserListPage: BlitzPage = () => {
    const locale = useLocale();
    return (
        <DashboardLayout title={locale.getPlainString("platformUser.title")}>
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;

// MIGRATION_RESTORE: role-administration
// Source: ab71102f2df004302ff85cb652a1be4f49b54191:src/pages/backstage/adminUsers.tsx:1-74
// Reason: Single-band Role administration cannot execute against GlobalRole and BandRole.
// Restore: Restore role and permission editors, designations, account role assignment and continuity safeguards using GlobalRole/BandRole; never restore User.role.
// Verification: Adapt the preserved authorization and command tests; verify atomic designations, protected grants, fresh authorization, auditing and browser editors.
// SHA256: dfc7d8c03f2ce95e250eec9e98f5a265d10b102397161bdd316b09731a581e0a
// MIGRATION_REFERENCE_BEGIN
//
// import { CMLinkButton } from "@/src/core/components/CMCoreComponents2";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { AdminResetPasswordButton } from "@/src/core/components/user/AdminResetPasswordButton";
// import { ImpersonateUserButton } from "@/src/core/components/user/ImpersonateUserButton";
// import { BlitzPage } from "@blitzjs/next";
// import * as DB3Client from "src/core/db3/DB3Client";
// import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
//
// const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
//     // This grid may inspect security state, but generic DB3 mutation must not
//     // echo those fields back during an otherwise ordinary insert or update.
//     column.editable = false;
//     column.renderForNewDialog = undefined;
//     column.ApplyClientToPostClient = () => { };
//     return column;
// };
//
// const UserListContent: React.FC<{}> = () => {
//     const dashboardContext = useDashboardContext();
//     //const lifecycle = useUserLifecycleActions();
//
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.userEditorView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//
//             // isDeleted should require continuity checks and dedicated lifecycle actions.
//             // but this adds complexity to the grid capabilities; as this is sysadmin maintenance only,
//             // leave as-is.
//             isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
//             name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 160 }),
//             //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
//             email: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
//             phone: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
//             cssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
//             createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 200 }),
//             isSysAdmin: columnName => makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ columnName })),
//             //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
//             instruments: columnName => new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
//             tags: columnName => new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false, selectionView: db3.userTagEditorView }),
//             role: columnName => makeDisplayOnlyColumn(new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, })),
//         },
//     });
//
//     const extraActions = (args: DB3EditGridExtraActionsArgs) => {
//         const userPayload = args.row as db3.UserClientPayload; // DB3EditGrid supplies the user editor DTO.
//         const profileUrl = dashboardContext.routingApi.getURIForUser(userPayload);
//         return <div>
//             <ImpersonateUserButton userId={userPayload.publicId} />
//             <AdminResetPasswordButton user={userPayload} />
//             <CMLinkButton href={profileUrl}>Visit Profile</CMLinkButton>
//         </div>;
//     }
//
//     return <DB3EditGrid
//         tableSpec={tableSpec}
//         view={db3.userEditorView}
//         renderExtraActions={extraActions}
//         defaultSortModel={[{ field: "createdAt", sort: "desc" }]}
//     />;
// };
//
// const UserListPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Users">
//             <UserListContent />
//         </DashboardLayout>
//     );
// };
//
// export default UserListPage;
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: member-profile
// Source: 15d112e042f38d63f5a18b105120cf1165df7845:src/pages/backstage/adminUsers.tsx:1-88
// Reason: Shared accounts no longer own band instrument or tag assignments; legacy profile renderers are unreachable.
// Restore: Restore reachable profile tabs, attendance, credits, wiki contributions, permitted account controls, and profile activity recording with explicit ownership.
// Verification: Test tab URLs, self/admin/outsider permissions and context switches; exercise each restored profile workflow in the built app.
// SHA256: 7bdf7bb60797f530601f92e27c2f55cc750563077c5d29993fe3d1cf19e462bd
// MIGRATION_REFERENCE_BEGIN
//
// import { CMLinkButton } from "@/src/core/components/CMCoreComponents2";
// import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
// import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
// import { AdminResetPasswordButton } from "@/src/core/components/user/AdminResetPasswordButton";
// import { ImpersonateUserButton } from "@/src/core/components/user/ImpersonateUserButton";
// import { BlitzPage } from "@blitzjs/next";
// import * as DB3Client from "src/core/db3/DB3Client";
// import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
// import * as db3 from "src/core/db3/db3";
//
// const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
//     // This grid may inspect security state, but generic DB3 mutation must not
//     // echo those fields back during an otherwise ordinary insert or update.
//     column.editable = false;
//     column.renderForNewDialog = undefined;
//     column.ApplyClientToPostClient = () => { };
//     return column;
// };
//
// const UserListContent: React.FC<{}> = () => {
//     const dashboardContext = useDashboardContext();
//     //const lifecycle = useUserLifecycleActions();
//
//     const tableSpec = DB3Client.defineTableClientSpec({
//         view: db3.userEditorView,
//         columns: {
//             publicId: DB3Client.publicIdFieldGen(),
//
//             // isDeleted should require continuity checks and dedicated lifecycle actions.
//             // but this adds complexity to the grid capabilities; as this is sysadmin maintenance only,
//             // leave as-is.
//             isDeleted: columnName => new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.deleted", columnName }),
//             name: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.name", columnName, cellWidth: 160 }),
//             //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
//             email: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.email", columnName, cellWidth: 150 }),
//             phone: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.phone", columnName, cellWidth: 120 }),
//             cssClass: columnName => new DB3Client.GenericStringColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.cssClass", columnName, cellWidth: 150 }),
//             createdAt: columnName => new DB3Client.CreatedAtColumn({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.createdAt", columnName, cellWidth: 200 }),
//             isSysAdmin: columnName => makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "db3.fields.sysadmin", columnName })),
//             //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
//             instruments: columnName => new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({
//                 columnName,
//                 cellWidth: 150,
//                 fieldCaptionKey: "db3.fields.instruments",
//                 fieldDescriptionKey: null,
//                 selectStyle: "inline",
//                 allowDeleteFromCell: false,
//             }),
//             tags: columnName => new DB3Client.TagsFieldClient<db3.UserTagPayload>({
//                 columnName,
//                 cellWidth: 150,
//                 fieldCaptionKey: "db3.fields.tags",
//                 fieldDescriptionKey: null,
//                 selectStyle: "inline",
//                 allowDeleteFromCell: false,
//                 selectionView: db3.userTagEditorView,
//             }),
//         },
//     });
//
//     const extraActions = (args: DB3EditGridExtraActionsArgs) => {
//         const userPayload = args.row as db3.UserClientPayload; // DB3EditGrid supplies the user editor DTO.
//         const profileUrl = dashboardContext.routingApi.getURIForUser(userPayload);
//         return <div>
//             <ImpersonateUserButton userId={userPayload.publicId} />
//             <AdminResetPasswordButton user={userPayload} />
//             <CMLinkButton href={profileUrl}>Visit Profile</CMLinkButton>
//         </div>;
//     }
//
//     return <DB3EditGrid
//         tableSpec={tableSpec}
//         view={db3.userEditorView}
//         renderExtraActions={extraActions}
//         defaultSortModel={[{ field: "createdAt", sort: "desc" }]}
//     />;
// };
//
// const UserListPage: BlitzPage = () => {
//     return (
//         <DashboardLayout title="Users">
//             <UserListContent />
//         </DashboardLayout>
//     );
// };
//
// export default UserListPage;
// MIGRATION_REFERENCE_END
