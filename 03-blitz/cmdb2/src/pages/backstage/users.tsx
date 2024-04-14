// next steps:
// - make things generic; use mui existing components as model
// - validation for all fields in all scenarios
// - authorization for pages, components, columns, db queries & mutations
// - fix some flicker problem what is going on? maybe just long loads too high in tree?
// - separate signup from google signup from admin create, regarding fields & auth
//   - note huge bug right now where adding a user makes you become that user.
// - impersonation
// - other datatypes (boolean, datetime...)
// - selected item scrolls off screen on the select item dialog

// there are 2 ways to select objects:
// from an edit cell
//   not much space, demanding a dialog which can allow:
//      - seeing more detailed view of all items
//      - filtering & adding new items
//      - with a dialog there's enough space to see ALL options
// from an existing dialog. like creating a new user, select a role for that new user.
//   so we can't show all items, need to find a compact way to do this.
//   mui auto-complete is perfect for this.
//   see https://mui.com/material-ui/react-autocomplete/#creatable

// - support pagination on the [SELECT...] selection dialog.
// main features to consider:
// x snackbar to notify async changes
// x confirmation dialog
// ADDING: let's not add directly in the grid.
//   doing so would result in weirdness wrt paging / sorting /filtering. Better to just display a modal or inline form specifically for adding items.
//   grid is just not a great UI regarding validation etc. better for modifying existing fields
// EDITING in grid: should not be a problem.
// DELETING
//   esp. for users, i think i should not actually cascade delete users. probably just mark users as inactive
// JOURNALING / AUDIT TRACING
//   register every mutation in a journal - done at the mutation level, not here in a datagrid.
// SERVER-BACKED DATA:
//   not completely trivial because now instead of the grid performing filtering, sorting, pagination, it must be passed to a query.
//  - filtering
//  - sorting
//  - pagination
// RESPONSIVE
//   list of cards feels the most useful: https://github.com/mui/mui-x/issues/6460#issuecomment-1409912710
// FILTERING
//   stuff like freeform text + tag text or something may require custom
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import { Button } from "@mui/material";
import impersonateUser from "src/auth/mutations/impersonateUser";
import { useMutation } from "@blitzjs/rpc";
import { useRouter } from "next/router";
import { Routes } from "@blitzjs/next"


const UserListContent = () => {
    if (!useAuthorization("users admin page", Permission.admin_users)) {
        throw new Error(`unauthorized`);
    }
    const router = useRouter()

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xUser,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 160 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "compactName", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "email", cellWidth: 150 }),
            new DB3Client.GenericStringColumnClient({ columnName: "phone", cellWidth: 120 }),
            new DB3Client.CreatedAtColumn({ columnName: "createdAt", cellWidth: 200 }),
            new DB3Client.BoolColumnClient({ columnName: "isSysAdmin" }),
            //new DB3Client.BoolColumnClient({ columnName: "isActive" }),
            new DB3Client.TagsFieldClient<db3.UserInstrumentPayload>({ columnName: "instruments", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.TagsFieldClient<db3.UserTagPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "role", cellWidth: 180, }),
        ],
    });

    const [impersonateUserMutation] = useMutation(impersonateUser);

    const extraActions = (args: DB3EditGridExtraActionsArgs) => {
        return (<Button onClick={() => {
            impersonateUserMutation({
                userId: args.row.id,
            }).then(() => {
                // navigate to home page
                void router.push(Routes.Home());
            }).catch((e) => {
                console.log(e);
            });
        }}>Impersonate</Button>);
    }

    return <DB3EditGrid tableSpec={tableSpec} renderExtraActions={extraActions} />;
};

const UserListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;
