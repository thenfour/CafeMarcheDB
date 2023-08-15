import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";

const ViewEventsPage: BlitzPage = () => {
    if (!useAuthorization("events page", Permission.view_events)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Events">
            <SettingMarkdown settingName="events_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default ViewEventsPage;
