// we cannot use our normal EditGrid for this, because CMEditGrid treats rows like DB rows.
// and that's pretty deep into the UX and logic.
// here we need CELLS to act like DB rows.

import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { CMAssociationMatrix } from "src/core/cmdashboard/CMAssociationMatrix";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { PermissionClientSchema, RoleClientSchema } from "src/core/db3/DB3ClientSchema";
import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";


const MainContent = () => {
    if (!useAuthorization("admin role-permissions matrix page", Permission.admin_auth)) {
        throw new Error(`unauthorized`);
    }
    return <>
        <SettingMarkdown settingName="rolePermissionsMatrixPage_markdown"></SettingMarkdown>
        <DB3AssociationMatrix
            localTableSpec={RoleClientSchema}
            foreignTableSpec={PermissionClientSchema}
            //localMember="permissions"
            tagsField={RoleClientSchema.getColumn("permissions") as DB3Client.TagsFieldClient<db3.RolePermissionAssociationModel>}
        //getRowName={(a: db3.RoleLocalPayload) => a.name}
        //getTagName={(a: db3.RolePermissionAssociationModel) => a.permission.name}
        />
    </>;
};


const RolePermissionsMatrixPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Users">
            <MainContent />
        </DashboardLayout>
    );
};

export default RolePermissionsMatrixPage;
