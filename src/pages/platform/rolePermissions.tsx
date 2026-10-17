import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/rolePermissions";

function PlatformRolePermissionsPage() {
    return <Page />;
}

defineCmdbPage("platformRolePermissions", PlatformRolePermissionsPage);
export default PlatformRolePermissionsPage;
