import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/roles";

function PlatformRolesPage() {
    return <Page />;
}

defineCmdbPage("platformRoles", PlatformRolesPage);
export default PlatformRolesPage;
