import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/permissions";

function PlatformPermissionsPage() {
    return <Page />;
}

defineCmdbPage("platformPermissions", PlatformPermissionsPage);
export default PlatformPermissionsPage;
