import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/adminUsers";

function PlatformAdminUsersPage() {
    return <Page />;
}

defineCmdbPage("platformAdminUsers", PlatformAdminUsersPage);
export default PlatformAdminUsersPage;
