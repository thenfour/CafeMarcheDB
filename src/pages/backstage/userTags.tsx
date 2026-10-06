import React from "react";
import type { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { MemberTagsControl } from "src/core/components/user/BandUserTags";
import { useLocale } from "src/locale/components/useLocale";

const UserTagsPage: BlitzPage = () => {
    const locale = useLocale();
    return <DashboardLayout title={locale.getPlainString("membership.tags.title")}><MemberTagsControl /></DashboardLayout>;
};
export default UserTagsPage;
