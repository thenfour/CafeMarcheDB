import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";

const EventsTablePage: BlitzPage = () => {
    if (!useAuthorization("events table page", Permission.admin_events)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Events">
            <SettingMarkdown settingName="events_table_markdown"></SettingMarkdown>
            <CMEditGrid spec={EventsEditGridSpec} />
        </DashboardLayout>
    )
}

export default EventsTablePage;
