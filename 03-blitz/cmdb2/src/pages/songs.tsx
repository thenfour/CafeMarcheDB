import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";

const SongsPage: BlitzPage = () => {
    if (!useAuthorization("songs page", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown settingName="songs_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default SongsPage;