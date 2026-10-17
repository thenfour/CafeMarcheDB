import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/settings";

function PlatformSettingsPage() {
    return <Page />;
}

defineCmdbPage("platformSettings", PlatformSettingsPage);
export default PlatformSettingsPage;
