import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const SongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown setting="songs_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default SongsPage;
