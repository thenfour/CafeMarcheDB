import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";

const EditEventsPage: BlitzPage = () => {
    if (!useAuthorization("edit events page", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Edit Events">
            <SettingMarkdown settingName="editEvents_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default EditEventsPage;
