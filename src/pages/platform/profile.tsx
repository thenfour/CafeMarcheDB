import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/profile";

function PlatformProfilePage() {
    return <Page />;
}

defineCmdbPage("platformProfile", PlatformProfilePage);
export default PlatformProfilePage;
