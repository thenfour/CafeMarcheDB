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
import { UserEditGridSpec } from "src/core/CMDBUser";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";

const UserListPage: BlitzPage = () => {
    // const xxx = UserEditGridSpec;
    // const yyy = Obj;
    // console.log(`UserEditGridSpec check ${typeof xxx} and ${typeof yyy}`);
    return (
        <DashboardLayout title="Users">
            <CMEditGrid spec={UserEditGridSpec} />
        </DashboardLayout>
    );
};

//UserListPage.authenticate = { role: [Permission.can_edit_users] };

export default UserListPage;
