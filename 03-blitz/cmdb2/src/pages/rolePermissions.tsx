// we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// and that's pretty deep into the UX and logic.
// here we need CELLS to act like DB rows.

import { BlitzPage } from "@blitzjs/next";
import CMDBRolePermission from "src/core/CMDBRolePermission";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthenticatedSession } from "@blitzjs/auth";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMAssociationMatrix } from "src/core/cmdashboard/CMAssociationMatrix";

const RolePermissionsMatrixPage: BlitzPage = () => {

    return (
        <DashboardLayout title="Users">
            <CMAssociationMatrix spec={CMDBRolePermission.RolePermissionEditGridSpec} />
        </DashboardLayout>
    );
};

export default RolePermissionsMatrixPage;
