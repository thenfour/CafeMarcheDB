import { BlitzPage } from "@blitzjs/next";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import DashboardLayout from "src/core/layouts/DashboardLayout";

const EditSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown settingName="editSongs_markdown"></SettingMarkdown>
        </DashboardLayout>
    )
}

export default EditSongsPage;
