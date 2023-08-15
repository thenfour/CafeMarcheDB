import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";




const ProfilePage: BlitzPage = () => {
    // if (!useAuthorization("", Permission.)) {
    //     throw new Error(`unauthorized`);
    // }
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown settingName="profile_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default ProfilePage;
