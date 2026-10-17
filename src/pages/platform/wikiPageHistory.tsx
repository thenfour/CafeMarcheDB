import { defineCmdbPage } from "src/route/cmdbPage";
import Page from "../backstage/wikiPageHistory";

function PlatformWikiPageHistoryPage() {
    return <Page />;
}

defineCmdbPage("platformWikiPageHistory", PlatformWikiPageHistoryPage);
export default PlatformWikiPageHistoryPage;
