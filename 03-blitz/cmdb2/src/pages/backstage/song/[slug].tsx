import { BlitzPage, useParams } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";


const MyComponent = () => {
    const params = useParams();
    console.log(params);
    return <div>{params.slug}</div>;
};


const SongPage: BlitzPage = () => {
    // if (!useAuthorization("songs page", Permission.view_songs)) {
    //     throw new Error(`unauthorized`);
    // }
    //const params = useParams();
    return (
        <DashboardLayout title="Song">
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default SongPage;
