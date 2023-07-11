import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";

const EditSongsPage: BlitzPage = () => {
    // if (!useAuthorization("edit songs page", Permission.view_songs)) {
    //     throw new Error(`unauthorized`);
    // }
    return (
        <DashboardLayout title="Edit Songs">
            // edit songs
        </DashboardLayout>
    )
}

export default EditSongsPage;
