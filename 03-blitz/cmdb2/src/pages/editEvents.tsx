import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { Permission } from "shared/permissions";
import { useAuthorization } from "src/auth/hooks/useAuthorization";

const EditEventsPage: BlitzPage = () => {
    if (!useAuthorization("edit events page", Permission.view_songs)) {
        throw new Error(`unauthorized`);
    }
    return (
        <DashboardLayout title="Songs">
            // events
        </DashboardLayout>
    )
}

export default EditEventsPage;
