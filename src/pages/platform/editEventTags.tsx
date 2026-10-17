import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/editEventTags";

function PlatformEditEventTagsPage() {
    return <Page />;
}

defineCmdbPage("platformEditEventTags", PlatformEditEventTagsPage);
export default PlatformEditEventTagsPage;
