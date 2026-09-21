
import { CMLinkButton } from "@/src/core/components/CMCoreComponents2";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext } from "@/src/core/components/dashboardContext/DashboardContext";
import { AdminResetPasswordButton } from "@/src/core/components/user/AdminResetPasswordButton";
import { ImpersonateUserButton } from "@/src/core/components/user/ImpersonateUserButton";
import { BlitzPage } from "@blitzjs/next";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";

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
    //const lifecycle = useUserLifecycleActions();

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.userEditorView,
        columns: {
            id: DB3Client.pkFieldGen(),

            // isDeleted should require continuity checks and dedicated lifecycle actions.
            // but this adds complexity to the grid capabilities; as this is sysadmin maintenance only,
            // leave as-is.
            isDeleted: columnName => new DB3Client.BoolColumnClient({ columnName }),
            name: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 160 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
            email: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
            phone: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 120 }),
            cssClass: columnName => new DB3Client.GenericStringColumnClient({ columnName, cellWidth: 150 }),
            createdAt: columnName => new DB3Client.CreatedAtColumn({ columnName, cellWidth: 200 }),
            isSysAdmin: columnName => makeDisplayOnlyColumn(new DB3Client.BoolColumnClient({ columnName })),
            //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            instruments: columnName => new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false }),
            tags: columnName => new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName, cellWidth: 150, allowDeleteFromCell: false, selectionView: db3.userTagEditorView }),
            role: columnName => makeDisplayOnlyColumn(new DB3Client.ForeignSingleFieldClient({ columnName, cellWidth: 180, })),
        },
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

    return <DB3EditGrid
        tableSpec={tableSpec}
        view={db3.userEditorView}
        renderExtraActions={extraActions}
        defaultSortModel={[{ field: "id", sort: "desc" }]}
    />;
};

const UserListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;
