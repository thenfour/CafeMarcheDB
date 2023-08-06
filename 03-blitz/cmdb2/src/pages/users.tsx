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
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
//import { UserTableSpec } from "src/core/CMDBUser";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";
import { ForeignSingleField, InsertFromStringParams, RenderAsChipParams } from "src/core/cmdashboard/dbcomponents2/CMForeignSingleField";
//import { CMEditGrid2 } from "src/core/cmdashboard/CMEditGrid2";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Role as DBRole, User as DBUser, Prisma } from "db";
//import getAllRoles from "src/auth/queries/getAllRoles";
import CreateRoleMutation from "src/auth/mutations/createRole";
import SoftDeleteUserMutation from "src/auth/mutations/deleteUser";
import insertUserMutation from 'src/auth/mutations/insertUser';
import NewUserMutationSpec from "src/auth/mutations/newUser";
import updateUserFromGrid from "src/auth/mutations/updateUserFromGrid";
import getAllRoles from 'src/auth/queries/getAllRoles';
import getUsers from "src/auth/queries/getUsers";
import { Chip } from "@mui/material";
import { CMTableSpec } from "src/core/cmdashboard/dbcomponents2/CMColumnSpec";
import { PKIDField, SimpleTextField } from "src/core/cmdashboard/dbcomponents2/CMBasicFields";
import { InsertUserSchema, UserEmailSchema, UserNameSchema, UpdateUserFromGrid as UpdateUserFromGridSchema } from "src/auth/schemas";

export class UserRoleField extends ForeignSingleField<DBUser, DBRole, Prisma.UserWhereInput, Prisma.RoleWhereInput> {
    constructor() {
        super({
            allowNull: true,
            cellWidth: 220,
            fkidMember: "roleId",
            member: "role",
            foreignSpec: {
                label: "Role",
                pkMember: "id",

                getQuickFilterWhereClause: (query: string): Prisma.RoleWhereInput => {
                    return { name: { contains: query } };
                },
                getAllOptionsQuery: getAllRoles,

                allowInsertFromString: true,
                insertFromStringMutation: CreateRoleMutation,
                insertFromString: async (params: InsertFromStringParams) => {
                    return await params.mutation({ name: params.input, description: "" });
                },

                doesItemExactlyMatchText: (item: DBRole, filterText: string) => {
                    return item.name.trim().toLowerCase() === filterText.trim().toLowerCase();
                },

                renderAsChip: (args: RenderAsChipParams<DBRole>) => {
                    if (!args.value) {
                        return <>--</>;
                    }
                    return <Chip
                        size="small"
                        label={`${args.value.name}`}
                        onDelete={args.onDelete}
                    />;
                },

                renderAsListItem: (props, value, selected) => {
                    return <li {...props}>
                        {selected && <DoneIcon />}
                        {value.name}
                        {selected && <CloseIcon />}
                    </li>
                },
            }
        });
    }

    getQuickFilterWhereClause = (query: string): Prisma.UserWhereInput => {
        return { role: { name: { contains: query } } };
    };
};

export const UserTableSpec = new CMTableSpec<DBUser, Prisma.UserWhereInput>({
    devName: "user",
    CreateMutation: insertUserMutation,
    CreateSchema: InsertUserSchema,
    GetPaginatedItemsQuery: getUsers,
    UpdateMutation: updateUserFromGrid,
    UpdateSchema: UpdateUserFromGridSchema,
    DeleteMutation: SoftDeleteUserMutation,
    GetNameOfRow: (row: DBUser) => { return row.name; },
    fields: [
        new PKIDField({ member: "id" }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Name", member: "name", zodSchema: UserNameSchema, allowNullAndTreatEmptyAsNull: false }),
        new SimpleTextField({ cellWidth: 220, initialNewItemValue: "", label: "Email", member: "email", zodSchema: UserEmailSchema, allowNullAndTreatEmptyAsNull: false }),
        new UserRoleField(),
    ],
});






const UserListContent = () => {
    if (!useAuthorization("users admin page", Permission.admin_users)) {
        throw new Error(`unauthorized`);
    }
    return <CMEditGrid2 spec={UserTableSpec} />;
};

const UserListPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <UserListContent />
        </DashboardLayout>
    );
};

export default UserListPage;
