import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { CMEditGrid } from "src/core/cmdashboard/CMEditGrid";
//import { CMEditGrid2 } from "src/core/cmdashboard/CMEditGrid2";
import { SettingTableSpec } from "src/core/CMDBSettings";
import { UserTableSpec } from "src/core/CMDBUser";
import { CMEditGrid2 } from "src/core/cmdashboard/dbcomponents2/CMEditGrid2";

const EditSongsContent = (props) => {
    return <>
        {/* <CMEditGrid2 spec={SettingTableSpec}></CMEditGrid2> */}
        <CMEditGrid2 spec={UserTableSpec} />
    </>;
    //return <>aoeu</>;
};

const EditSongsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Songs">
            <SettingMarkdown settingName="editSongs_markdown"></SettingMarkdown>
            <EditSongsContent></EditSongsContent>
        </DashboardLayout>
    )
}

export default EditSongsPage;

// import { BlitzPage } from "@blitzjs/next";
// import DashboardLayout from "src/core/layouts/DashboardLayout";
// import { Permission } from "shared/permissions";
// import { useAuthorization } from "src/auth/hooks/useAuthorization";
// import { SettingMarkdown } from "src/core/components/SettingMarkdown";

// const SongsTablePage: BlitzPage = () => {
//     if (!useAuthorization("songs table page", Permission.admin_songs)) {
//         throw new Error(`unauthorized`);
//     }
//     return (
//         <DashboardLayout title="Songs">
//             <SettingMarkdown settingName="songs_table_markdown"></SettingMarkdown>
//         </DashboardLayout>
//     )
// }

// export default SongsTablePage;