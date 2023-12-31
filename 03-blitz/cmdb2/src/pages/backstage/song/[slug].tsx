import { BlitzPage, useParams } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization, useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { NavRealm } from "src/core/components/Dashboard2";


const MyComponent = () => {
    const params = useParams();
    console.log(params);
    return <div>{params.slug}</div>;
};


const SongPage: BlitzPage = () => {
    useAuthorizationOrThrow("songs page", Permission.view_songs);

    //const params = useParams();
    return (
        <DashboardLayout title="Song" navRealm={NavRealm.songs}>
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default SongPage;
