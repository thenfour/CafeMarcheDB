
import { AdminResetPasswordButton } from "@/src/core/components/user/AdminResetPasswordButton";
import { ImpersonateUserButton } from "@/src/core/components/user/ImpersonateUserButton";
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { CMLinkButton } from "@/src/core/components/CMCoreComponents2";

const makeDisplayOnlyColumn = <T extends DB3Client.IColumnClient>(column: T): T => {
    // This grid may inspect security state, but generic DB3 mutation must not
    // echo those fields back during an otherwise ordinary insert or update.
    column.editable = false;
    column.renderForNewDialog = undefined;
    column.ApplyClientToPostClient = () => { };
    return column;
};

const UserListContent: React.FC<{}> = () => {
    const dashboardContext = useDashboardContext();

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "cssClass", cellWidth: 150 }),
            new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 200 }),
            makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ columnName: "isSysAdmin" })),
            //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            makeDisplayOnlyColumn(new DB3Client.ForeignSingleFieldClient({ columnName: "role", cellWidth: 180, })),
        ],
    });

    const extraActions = (args: DB3EditGridExtraActionsArgs) => {
        const userPayload = args.row as db3.UserPayload;
        const profileUrl = dashboardContext.routingApi.getURIForUser(userPayload);
        return <div>
            <ImpersonateUserButton userId={userPayload.id} />
            <AdminResetPasswordButton user={userPayload} />
            <CMLinkButton href={profileUrl}>Visit Profile</CMLinkButton>
        </div>;
    }

    return <DB3EditGrid tableSpec={tableSpec} renderExtraActions={extraActions} defaultSortModel={[{ field: "id", sort: "desc" }]} />;
};

const UserListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users" basePermission={Permission.sysadmin}>
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;
