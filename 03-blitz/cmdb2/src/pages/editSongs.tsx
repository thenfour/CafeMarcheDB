import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";

const EditSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown settingName="editSongs_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default EditSongsPage;
