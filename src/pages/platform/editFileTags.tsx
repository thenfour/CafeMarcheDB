import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/editFileTags";

function PlatformEditFileTagsPage() {
    return <Page />;
}

defineCmdbPage("platformEditFileTags", PlatformEditFileTagsPage);
export default PlatformEditFileTagsPage;
