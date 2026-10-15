
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
import React, { Suspense } from "react";
import { AccountRoleAction } from "src/core/components/user/AccountRoleControl";
import { AccountAnalysisAction } from "src/core/components/user/UserMassAnalysisTab";
import { MergeUsersButton } from "src/core/components/user/MergeUsersButton";
import { portalHref } from "src/route/portalRouting";

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
    const hosting = dashboardContext.portalHosting;
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
            <Suspense><AccountRoleAction userId={userPayload.publicId} onChanged={() => args.refetch()} /></Suspense>
            {auth.hasPermission(Permission.sysadmin) && <AccountAnalysisAction userId={userPayload.publicId} />}
            {auth.hasPermission(Permission.merge_users) && auth.hasPermission(Permission.manage_global_users)
                && auth.userPublicId !== userPayload.publicId && <MergeUsersButton user={userPayload} />}
            <ImpersonateUserButton userId={userPayload.publicId} />
            <AdminResetPasswordButton user={userPayload} />
            <CMLinkButton href={portalHref(`/backstage/platform-user/${userPayload.publicId}`, {
                ...dashboardContext.memberPresentation, bandPublicId: null,
            }, hosting)}>{locale.getPlainString("membership.profile.accountTitle")}</CMLinkButton>
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
