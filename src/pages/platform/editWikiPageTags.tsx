import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/editWikiPageTags";

function PlatformEditWikiPageTagsPage() {
    return <Page />;
}

defineCmdbPage("platformEditWikiPageTags", PlatformEditWikiPageTagsPage);
export default PlatformEditWikiPageTagsPage;
