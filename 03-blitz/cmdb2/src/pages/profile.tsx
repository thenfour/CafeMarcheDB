import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";

const ProfilePage: BlitzPage = () => {
    if (!useAuthorization("songs page", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Songs">
            // your profile
        </DashboardLayout>
    )
}

export default ProfilePage;
