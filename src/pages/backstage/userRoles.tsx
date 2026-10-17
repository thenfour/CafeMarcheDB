import { defineCmdbPage } from "src/route/cmdbPage";
import React from "react";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { MemberRolesControl } from "src/core/components/user/BandUserRoles";
import { useLocale } from "src/locale/components/useLocale";

const UserRolesPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.roles.title")}><MemberRolesControl /></DashboardLayout>;
};
defineCmdbPage("bandUserRoles", UserRolesPage);
export default UserRolesPage;
